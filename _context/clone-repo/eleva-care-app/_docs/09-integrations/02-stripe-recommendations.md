# How I Stay Sane Implementing Stripe

I have set up Stripe far too many times. I've never enjoyed it. I've talked to the Stripe team about the shortcomings and they say they'll fix them...eventually.

Until then, this is how I recommend setting up Stripe. I don't cover everything - check out [things that are still your problem](#things-that-are-still-your-problem) for clarity on what I'm NOT helping with.

> If you want to stay sane implementing file uploads, check out my product [UploadThing](https://uploadthing.com/).

### Pre-requirements

- TypeScript
- Some type of JS backend
- Working auth (that is verified on your JS backend)
- A KV store (I use Redis, usually [Upstash](https://upstash.com/?utm_source=theo), but any KV will work)

### General philosophy

IMO, the biggest issue with Stripe is the "split brain" it inherently introduces to your code base. When a customer checks out, the "state of the purchase" is in Stripe. You're then expected to track the purchase in your own database via webhooks.

There are [over 258 event types](https://docs.stripe.com/api/events/types). They all have different amounts of data. The order you get them is not guaranteed. None of them should be trusted. It's far too easy to have a payment be failed in stripe and "subscribed" in your app.

These partial updates and race conditions are obnoxious. I recommend avoiding them entirely. My solution is simple: _a single `syncStripeDataToKV(customerId: string)` function that syncs all of the data for a given Stripe customer to your KV_.

The following is how I (mostly) avoid getting Stripe into these awful split states.

## The Flow

This is a quick overview of the "flow" I recommend. More detail below. Even if you don't copy my specific implementation, you should read this. _I promise all of these steps are necessary. Skipping any of them will make life unnecessarily hard_

1. **FRONTEND:** "Subscribe" button should call a `"generate-stripe-checkout"` endpoint onClick
1. **USER:** Clicks "subscribe" button on your app
1. **BACKEND:** Create a Stripe customer
1. **BACKEND:** Store binding between Stripe's `customerId` and your app's `userId`
1. **BACKEND:** Create a "checkout session" for the user
   - With the return URL set to a dedicated `/success` route in your app
1. **USER:** Makes payment, subscribes, redirects back to `/success`
1. **FRONTEND:** On load, triggers a `syncAfterSuccess` function on backend (hit an API, server action, rsc on load, whatever)
1. **BACKEND:** Uses `userId` to get Stripe `customerId` from KV
1. **BACKEND:** Calls `syncStripeDataToKV` with `customerId`
1. **FRONTEND:** After sync succeeds, redirects user to wherever you want them to be :)
1. **BACKEND:** On [_all relevant events_](#events-i-track), calls `syncStripeDataToKV` with `customerId`

This might seem like a lot. That's because it is. But it's also the simplest Stripe setup I've ever seen work.

Let's go into the details on the important parts here.

### Checkout flow

The key is to make sure **you always have the customer defined BEFORE YOU START CHECKOUT**. The ephemerality of "customer" is a straight up design flaw and I have no idea why they built Stripe like this.

Here's an adapted example from how we're doing it in [T3 Chat](https://t3.chat).

```ts
export async function GET(req: Request) {
  const user = auth(req);

  // Get the stripeCustomerId from your KV store
  let stripeCustomerId = await kv.get(`stripe:user:${user.id}`);

  // Create a new Stripe customer if this user doesn't have one
  if (!stripeCustomerId) {
    const newCustomer = await stripe.customers.create({
      email: user.email,
      metadata: {
        userId: user.id, // DO NOT FORGET THIS
      },
    });

    // Store the relation between userId and stripeCustomerId in your KV
    await kv.set(`stripe:user:${user.id}`, newCustomer.id);
    stripeCustomerId = newCustomer.id;
  }

  // ALWAYS create a checkout with a stripeCustomerId. They should enforce this.
  const checkout = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    success_url: "https://t3.chat/success",
    ...
  });
```

### syncStripeDataToKV

This is the function that syncs all of the data for a given Stripe customer to your KV. It will be used in both your `/success` endpoint and in your `/api/stripe` webhook handler.

The Stripe api returns a ton of data, much of which can not be serialized to JSON. I've selected the "most likely to be needed" chunk here for you to use, and there's a [type definition later in the file](#custom-stripe-subscription-type).

Your implementation will vary based on if you're doing subscriptions or one-time purchases. The example below is with subcriptions (again from [T3 Chat](https://t3.chat)).

```ts
// The contents of this function should probably be wrapped in a try/catch
export async function syncStripeDataToKV(customerId: string) {
  // Fetch latest subscription data from Stripe
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: 'all',
    expand: ['data.default_payment_method'],
  });

  if (subscriptions.data.length === 0) {
    const subData = { status: 'none' };
    await kv.set(`stripe:customer:${customerId}`, subData);
    return subData;
  }

  // If a user can have multiple subscriptions, that's your problem
  const subscription = subscriptions.data[0];

  // Store complete subscription state
  const subData = {
    subscriptionId: subscription.id,
    status: subscription.status,
    priceId: subscription.items.data[0].price.id,
    currentPeriodEnd: subscription.current_period_end,
    currentPeriodStart: subscription.current_period_start,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    paymentMethod:
      subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
        ? {
            brand: subscription.default_payment_method.card?.brand ?? null,
            last4: subscription.default_payment_method.card?.last4 ?? null,
          }
        : null,
  };

  // Store the data in your KV
  await kv.set(`stripe:customer:${customerId}`, subData);
  return subData;
}
```

### `/success` endpoint

> [!NOTE]
> While this isn't 'necessary', there's a good chance your user will make it back to your site before the webhooks do. It's a nasty race condition to handle. Eagerly calling syncStripeDataToKV will prevent any weird states you might otherwise end up in

This is the page that the user is redirected to after they complete their checkout. For the sake of simplicity, I'm going to implement it as a `get` route that redirects them. In my apps, I do this with a server component and Suspense, but I'm not going to spend the time explaining all that here.

```ts
export async function GET(req: Request) {
  const user = auth(req);
  const stripeCustomerId = await kv.get(`stripe:user:${user.id}`);
  if (!stripeCustomerId) {
    return redirect('/');
  }

  await syncStripeDataToKV(stripeCustomerId);
  return redirect('/');
}
```

Notice how I'm not using any of the `CHECKOUT_SESSION_ID` stuff? That's because it sucks and it encourages you to implement 12 different ways to get the Stripe state. Ignore the siren calls. Have a SINGLE `syncStripeDataToKV` function. It will make your life easier.

### `/api/stripe` (The Webhook)

This is the part everyone hates the most. I'm just gonna dump the code and justify myself later.

```ts
export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature');

  if (!signature) return NextResponse.json({}, { status: 400 });

  async function doEventProcessing() {
    if (typeof signature !== 'string') {
      throw new Error("[STRIPE HOOK] Header isn't a string???");
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    waitUntil(processEvent(event));
  }

  const { error } = await tryCatch(doEventProcessing());

  if (error) {
    console.error('[STRIPE HOOK] Error processing event', error);
  }

  return NextResponse.json({ received: true });
}
```

> [!NOTE]
> If you are using Next.js Pages Router, make sure you turn this on. Stripe expects the body to be "untouched" so it can verify the signature.
>
> ```ts
> export const config = {
>   api: {
>     bodyParser: false,
>   },
> };
> ```

### `processEvent`

This is the function called in the endpoint that actually takes the Stripe event and updates the KV.

```ts
async function processEvent(event: Stripe.Event) {
  // Skip processing if the event isn't one I'm tracking (list of all events below)
  if (!allowedEvents.includes(event.type)) return;

  // All the events I track have a customerId
  const { customer: customerId } = event?.data?.object as {
    customer: string; // Sadly TypeScript does not know this
  };

  // This helps make it typesafe and also lets me know if my assumption is wrong
  if (typeof customerId !== 'string') {
    throw new Error(`[STRIPE HOOK][CANCER] ID isn't string.\nEvent type: ${event.type}`);
  }

  return await syncStripeDataToKV(customerId);
}
```

### Events I Track

If there are more I should be tracking for updates, please file a PR. If they don't affect subscription state, I do not care.

```ts
const allowedEvents: Stripe.Event.Type[] = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.pending_update_applied',
  'customer.subscription.pending_update_expired',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'invoice.upcoming',
  'invoice.marked_uncollectible',
  'invoice.payment_succeeded',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
];
```

### Custom Stripe subscription type

```ts
export type STRIPE_SUB_CACHE =
  | {
      subscriptionId: string | null;
      status: Stripe.Subscription.Status;
      priceId: string | null;
      currentPeriodStart: number | null;
      currentPeriodEnd: number | null;
      cancelAtPeriodEnd: boolean;
      paymentMethod: {
        brand: string | null; // e.g., "visa", "mastercard"
        last4: string | null; // e.g., "4242"
      } | null;
    }
  | {
      status: 'none';
    };
```

## More Pro Tips

Gonna slowly drop more things here as I remember them.

### DISABLE "CASH APP PAY".

I'm convinced this is literally just used by scammers. over 90% of my cancelled transactions are Cash App Pay.
![image](https://github.com/user-attachments/assets/c7271fa6-493c-4b1c-96cd-18904c2376ee)

### ENABLE "Limit customers to one subscription"

This is a really useful hidden setting that has saved me a lot of headaches and race conditions. Fun fact: this is the ONLY way to prevent someone from being able to check out twice if they open up two checkout sessions 🙃 More info [in Stripe's docs here](https://docs.stripe.com/payments/checkout/limit-subscriptions)

## Things that are still your problem

While I have solved a lot of stuff here, in particular the "subscription" flows, there are a few things that are still your problem. Those include...

- Managing `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` env vars for both testing and production
- Managing `STRIPE_PRICE_ID`s for all subscription tiers for dev and prod (I can't believe this is still a thing)
- Exposing sub data from your KV to your user (a dumb endpoint is probably fine)
- Tracking "usage" (i.e. a user gets 100 messages per month)
- Managing "free trials"
  ...the list goes on

Regardless, I hope you found some value in this doc.

## YouTube video transcript

https://youtu.be/Wdyndb17K58?si=JhFK0ErTRMmhFPoT

it's genuinely hard to overstate how important stripe was for changing how we do modern software development they were an early Pioneer in developer first solutions that really prioritize things like apis sdks documentation and more they wanted to make it easy for developers to add payments to their apps and they did a phenomenal job which is why it's so amazing that today in 2025 it genuinely sucks to use and setup stripe like it's so bad it's like the whole world caught up to where they were and then kept going and strife just slowly got worse in parallel and it feels terrible the amount of weird edges you have to deal with the amount of different event web hook types and just I've been through it I've set up a lot of apps with stripe I've learned a lot I've done a lot of things wrong I've been through significant significant amounts of pain throughout and I decided to take the time to open source my learnings and document it all I just put up this repo my stripe recommendations that is a list of all of the things I think you should know when you're setting up stripe but man there's a lot to go into here and I think it deserves a video hopefully you agree but at the very least we should much pain I've been through with stripe normally I make it Mark's problem and he's been dealing with it too with all the stuff we did with T3 chat which if setting up stripe was the biggest pain Point throughout the development yeah it was worse than o I would confidently say it was worth than o it wasn't fun but uh yeah I will also say that through my flaming of stripe they've actually been really receptive and we actually have a call scheduled for for next week so I'll make sure this video isn't published until that call has happened so I can make any adjustments as necessary depending on how that call goes anyways here is the things I recommend when setting stripe up the first thing that we have to understand is the split brain problem inherent to stripe a split brain occurs when there is data that exists in two places that has to be kept in sync between them so if I have my service you know Services they're always squares so here is my API if I have my API and then I have a user as we know users are always circles this user wants to send a message on the server we have to check things like is this a signed in user things like does the message require a paid tier things like has the user paid and once my API has made the decision it will either respond by telling the user F off or doing the thing so generated message but this depends again on whether or not the user is doing a thing that requires being paid and whether or not the user is in a state that indicates that they have paid usually this API is going to check these things in your database and databases are rhombuses so we have our database here maybe we check that the user's authenticated let's just pretend we already know the user's off because it'll make this part less painful so they go and they check paid user and then the database responds with yes paid or no but how does that data get to the database here is where the problems begin stripe has their own API and you might think oh that's really simple just take this database delete it and hit the stripe API instead it's like yeah easiest thing ever problem solved right I'm going to die there are a lot of reasons that this does not work and they are all stupid the first one is that your users have IDs and that user ID is not a field you can use to look things up on Stripes API because stripe customers have an ID that stripe generates so if you are asking Stripes API hey is this user paid you have to ask them with the checkout ID with the actual customer ID that was generated during checkout or ideally before checkout if you don't have that ID attached to your user you have no way of looking that up via the stripe API and even if you did the stripe API has really aggressive rate limits so per second you can send 100 reads and 100 wrs to their API that means if you have 101 messages sent in a given second and all of us have to check the stripe API to make sure you're good or not good you're the other thing worth noting is that every time you hit the stripe API it takes 3 to 10 seconds to resolve so if everything on your site requires that you're checking stripe to make sure the user has or hasn't paid you just made your entire service run at the speed of stripe which is not particularly fast it is actually pretty horrible and that's all ignoring the fact that you also have to store the customer ID inside inside of your database to get there in the first place because of that stripe recommends doing this differently we're going to bring back our database because what stripe recommends is when the user checks out you send the info from stripe to your site via a web hook this web Hook is an event that comes from stripe to your API that says hey this user subscribed this user unsubscribed those events don't have a guaranteed order so it's possible that you get a confirmation of a sub before the sub is created it's possible that you get a payment event before the customer is created it is not good and it is so likely you'll end up in a weird State through all of this that I cannot recommend purely relying on the web hookes in the data they send almost ever and on top of that now we have to manage the stripe API sending partial events to our API that we then Hope We sync the right parts to our database to then check in the API when a user does something it's see how messy this is getting and it gets worse once you think about checkouts and all the other parts there don't get me started on the fact that you can do a checkout before you have a customer ID what the I'm I'm going to explode if I think about this too much I just need to show you guys how to do it right okay so the problem here is that Stripes API is the thing that owns all of the data it is slow it is bad it is not giving you updates accurately and consistently enough and you're going to suffer if you rely on their API for data so you have to rely on web hooks but the web hooks aren't a good thing to rely on either because they can come out of order they can give you partial updates they can just be wrong sometimes it's not reliable so my solution is fundamentally different instead of the stripe API firing a web hook to tell you what to write to the database I use the stripe web hook as an indication of something and I can show you my doc but I'm just going to show you the code instead here is the actual code we have for processing web hooks from stripe I have my function for digesting it making sure it's actual event I might do event processing if there's no signature we throw this is this only happens if a user is trying to hit us at our stripe like web hook endpoint but they aren't striped because stripe will sign the request so you know it's actually them people can't send a fake thing to your server to pretend they subbed when they didn't so once you've processed the signature from the stripe request we have the web Hook from their SDK this is just imported from stripe this lets us check that the hook actually came from stripe and just sign it make sure we're good and then I call wait until here because this is next day I don't want to delay the response to stripe telling them we're good so white Intel means we can respond to stripe and do this function in the background so we as quickly as possible return to stripe a 200 in this case we just say received true to let them know hey we got this stop spamming us with this event we're okay and then they'll stop hitting you with the specific event for this specific thing then I have all of the events that I care about these have to be put here and they have to be configured in stripe we haven't even gotten to the payment ID and the price ID split brain problem either we'll get there in a minute but first we need to talk about a lot events these are the different events that I've have configured stripe to send us when a thing happens so whenever a sub is created updated deleted pause resumed Etc whenever an invoice is handled payment intent is hit these will all fire an event so you would think okay I'm going to do a lot of work to read this event find the things that matter and put them in my database right wrong I will never trust an event stripe sends me because I never know if it's real or not even if we've signed it we don't know if it's in the right order if it's a partial if it's the truth we don't know anything from those events so instead of dealing with them I have a wonderful function here if the event we got is one of my allowed events I grab the customer ID because I only allow events with customer IDs the fact that stripe can send any type of payment event without a customer ID shows how little they understand about modern software development it is horrifying so I make sure we get a customer ID I throw an error if we didn't and now that I have a customer ID I can call my update KV with latest stripe data function when I want to update my stripe State I don't wait for an event from stripe I call this function where I grab the subscription with a given customer ID get all of the data return nothing if there isn't anything and set it in KV as well but if there is data I create the thing I want to store in my database and I throw it in my KV that is dedicated to just dealing with stripes yeah this one function has made my life of dealing with stripe at least five times easier it is far from everything you need but having a dumb key value store I'm just using up stash here could be literally anything redis Cloud flare KV whatever you want to use just something that you give it a key which is the customer ID and a value which is the subscription status and now I have everything I need in my KV to access when I want to check if a user has paid or not because that is the goal here is to have a thing that I can check in my apis in my routes in wherever I need to know if the user paid or not I need something I own that is fast because Stripes API is super rate limited and super slow because of that this function can take 3 to 4 seconds to run but it only matters when a new event comes in and it's updating the state in our KV so you're only ever out of sync for up to like 4 seconds which is not a big deal to have the update for your state for your like payments in your service 4 seconds later than stripe does in fact I would go as far as I say it's probably going to be faster if you set it up this way than if you do all the partial update that they recommend so this is how I actually get the data to my database so how do I use it how do I make sure that I'm actually like checking if a user paid let me find any of those functions quick here's my get sub tier function this is a server action so I can just call it via client but imagine you can use this in a getter a post endpoint whatever you want to use it in I get off from my off provider if there's no user then they're free tier I then get the sub from my KV using their user ID the customer ID should be linked to the user ID I'll show you how I do that in a minute but this function here will get the customer ID from a separate KV using the user ID now I have the customer ID I return null if there isn't one but then if there is I get their data from my KV with the actual stripe data that I can then use to check things like if this user is paid so if the sub status is active I return Pro otherwise we default to free tier this is how much simpler my off code for checking paid status is as a result of dealing with these helpers as I mentioned before you need to have the customer ID handled too so I have this stripe customer ID KV this has a generate key function which returns user colon user ID colon stripe customer ID a get which calls rus. get for that and a set which calls rus. set for that I do the basically the exact same thing for the stripe KV for the actual stripe data I have my generate key function it's what I use for the getter and Setter same basic thing but instead I'm storing the actual stripe State here so I have two KV things I am storing here I have the user ID to customer ID and I have the customer ID to the actual state of the account there's one more important piece here that I want to make sure is not missed here is our actual create checkout session code this is the code that gets called via use server action when the user clicks the checkout button first thing we do is we check if they're authenticated if they're not I redirect them to go get authenticated because don't do this if you're not already off duh then I check if you already have a sub if you do then I throw because you shouldn't be able to hit this button I you should not be able to get this in a state where you can hit that button unless you had two tabs open you subscribe in one and then you go to the other and hit it this prevents that because stripe does not prevent that for you a user can subscribe twice it is actually quite hard to make it so they can't we'll go over that in a minute too I then get the stripe customer ID from my KV but it might not exist so I have this undefined case if there isn't one I create the customer and this is important you should never ever ever ever let someone check out through stri until you have generated a customer ID for them you will have nothing but pain and suffering if you do that when I create the customer I include metadata with their user ID as well as the email from their off because it makes it way easier to find things in the stripe dashboard which you have to use because they don't expose half the data you need except for in the dashboard so make sure you tag that customer with the things you need to know who they are but if you don't have a customer object in stripe before someone checks out you will regret every single thing you've done implementing stripe you will have nothing but pain in the future once you realize one person in your service could theoretically have five customer IDs none of which are linked to the customers like user object you are in hell so create the customer first do not let the user go any further until you know you have a customer that is mapped to them in their SDK so this if check here makees sure if we didn't already have a customer ID saved that we generate one so now we have their customer ID awesome make sure you throw that in a KV somewhere because there is no way with stripe to go from your user ID and metadata to a customer ID so you have to manage that relation yourself so manage it throw it in a KV now I can get that what I need in the future and if we call this again if a user starts checking out cancels and then comes back now I have that handled here you could also handle stripe customer creation on like account creation I don't think it matters I prefer doing it here because it makes it less likely the code gets deprecated in a way that breaks everything but if your off layer allows you to easily do this when a user signs in for the first time cool awesome do that but since Stripes apis take 3 to 5 Seconds personally I don't want to make my signin page take 3 to 5 Seconds longer because Stripes API is garbage just a personal preference and then I have a wonderful let's session with a try catch because their SDK throws errors randomly in here I await stripe checkout session create couple important fields in here I have the line items we'll talk about price IDs in a bit so unnecessary but they have to be implemented or nothing works mode subscription subscription data because just having the metadata in the customer object is Never Enough throw it in subscription data as well this is a metadata field for you to keep track of things it's nice and make sure you know which user owns Which sub helpful when the customer ID thing falls apart so I'd recommend throwing an identifier of some form here if you can but make sure you always always always pass a customer ID that already exists in the customer field they should type type error if you don't have this because it will generate a customer when they check out not when they go if they go to the checkout page it has a temporary customer generated that it will just randomly throw out sometimes it's super unreliable so again make sure you're passing a customer ID here or you will suffer and now I have the URL that I actually want the user to go to for their checkout session finally this is 75 lines of code that should not be necessary but effectively are 100% necessary if you want want to do stripe off and payments properly as just part of the whole formula to be clear so now we've handled customers we have handled checkouts and sessions but there's a couple edge cases that suck here specifically when the user gets redirected back to your service if stripe hasn't finished sending the web Hooks and letting you update your KV they'll come back to your site but your website is going to show them that they're still on the free tier because it hasn't processed the event yet from the back end and wor case they can go check out again so we need to handle these two things we need to ideally make it so that the website is updated as soon as the user is done checking out and we need to make it so they can't check out twice because it is not easy to do that first thing that redirector make sure that they're off and the payment is handled when they come back I recommend redirecting to a/ suuccess URL or something similar to this here is my success page I'm using nextjs so this is just a server component you can do this via an API endpoint with redirects to doesn't really matter but it does have to run on back end so know that part I grab the stripe session ID from search pams but I actually don't use it I log it so we have it for our own logs for debugging when weird things happen which they always will I recommend logging a bunch of stuff throughout this process if you can but I have here my confirm stripe session component this component is under a suspense boundary because it takes a decent bit of time to run the reason it takes a bit to run is because in it I call trigger stripe sync for user this gets their user ID there isn't one I just see early return I then get their customer ID from the KV there isn't one I early return and then I call update KV with latest stripe data this function is only implemented in two places it is implemented as the web hook Handler for whenever any web hook comes in Via stripe and it is implemented as a thing that is called on this/ suuccess Route so that I can make sure that when the user finally gets redirected back to my website that the state of things in KV is actually up to date and if it is if we call this successfully and there isn't an error I redirect you to/ chat which is the equivalent of our homepage effectively and now we've updated the KV so the state when the user fetches it on the page should finally actually consistently be up to date and we still haven't handled double Subs we did a little bit with the checkout thing here where if you are already authenticated and you already have a sub as we check here we throw an error but what if I hit that checkout button twice what if I check out and then go back when it's checking out and do it again again yeah we had this happen I had all of this done I was really happy and then we had I think five customers who successfully checked out twice they had two active Subs how the reason is because stripe doesn't care if a user Subs twice they somewhat recently and when I say somewhat recently I mean so recently that no llms know about it added the ability to limit to one subscription I did not know this was a thing I am very thankful that it is a thing but there is a hidden field deep in settings it's settings checkout and payment links subscriptions multiple subscriptions they have this wonderful limit customers to one subscription why the is that not the default there are so many bad defaults in stripe it is unbelievable I can make a whole list of them don't get me started on the fact that oh God if you hit their usage based endpoint that's like hey my user sent five messages hey they sent seven more me they sent seven messages the endpoint where you send updates to how much usage the user has if you call it within a 5minute window it will sum them but if you call them outside of the 5-minute window it sets it as the total there are different behaviors depending on how close you call the endpoint what how is that the God I'm going to explode I don't not stripe please take this seriously your whole platform is held up on like toothpicks on quickstand it is unbelievable that people actually use this in a state so make sure this box is checked seriously make sure this box is checked no matter how well you think you're hand handling the edge cases it is still strip's problem and they are not handling the edge case so check this we've only had one user successfully check out twice since we turned this on I have no idea how they did it and strip's trying to figure it out too but turn this on I don't know why they even have this they have an option for cash app pay that is on by default just for for reference cash app payments on T3 chat I think we got 17 of them total one was a real customer who checked out the other 16 were people who were trying to scam us why are they using cash at pay the reason they're using cash at pay is because when you pick cash at pay it gives you the info on where to send it and then it sends you back to your app early so that you can go to cash app and scan the code and send it whenever you feel like scammers love this option because most Services blindly assume that once the user has been redirected to the success URL because they checked out that the payment came through and since getting this all right is so hard to do they'll have some amount of time when they wait for the server to sync or get the web hooks or maybe just never even check where your account thinks is in a paid State even though you never paid so of the 17 or so attempts to do cash out pay checkouts 16 were people trying to get a free sub by using cash app pay to redirect down a path that looks like the Happy path but isn't to get the subscription for free so just turn off cash app pay it should not be on by default it is a Scourge I would I would put down a lot of money that the majority of cash app pay requests that go through stripe are never fulfilled it is a feature they should probably get rid of entirely people would be too pissed if they did it so at the very least it needs to be off by default like a lot of the other sketchy options are what the stripe this turn this off I think I covered most of it here oh I didn't even go into price ATS holy if you already use stripe you know about this but if you don't if you want to be able to keep track of which Subs people have and have actual information about it you need to generate a price ID in stripe that represents that item this doesn't seem too bad initially except for the fact that this has to exist in Dev and in prod separately this is absolutely something I should be able to hard code I should be able to code either what the subscription is or the ID itself it's not information I care to keep private but I have to make an environment variable because I needed to be different in Dev and in prod what and now if I update in stripe like let's say I delete this price ID or I change the sub tiers I have to go redeploy my service with the new environment variables for it to catch up what the fact that I have to manage everything my hand myself to keep my Dev environment my prod environment my UI my payment options and my existing subscriptions all in sync by hand what so how do we get out of this hopefully now if you're still using stripe you know everything you need to not want to die check out my doc if you want this all in a text format or you want to send it to somebody else there are other options one of them was lemon squeezy lemon squeezy was a merchant of record which means that instead of the payments going to your business which means you have to be incorporated all the different countries handle all the taxes all that lemon squeezy is Incorporated in all those different places for you they have their own stripe setup they'll pay you instead but your users check out through lemon squeezy which means on their credit cards statements on their billing everything else it's going to say lemon squeezy because that's the official Merchant they went through they're The Merchant of record the thing on their records is lemon squeezy but now they can handle all of that and give you a better path the path was so much better that they got acquired by stripe and the founder Jr is the person at stripe who's trying to lead the charge to work with me to fix the hell that I just described so I am excited for a future where the lemon squeezy acquisition can fix the hell that is setting up and managing all of this stuff if lemon squeezy just becomes the the sane path to you stripe that would be really cool but there are other options polar is a really cool other option they are trying to make modern DX for doing stripe it is as easy as Polar do checkouts custom create product ID success URL and now you can just redirect the user it is all still built through stripe you can use them as a merchant of record but I also think you can plug it into your own stripe I might be wrong they are only slightly more expensive than stripe which is crazy because they are using stripe under the hood I'm pretty sure stripe is 3% plus 30 cents they're 4% plus 40 so they're going to make less money per transaction than stripe does which is hilarious but it seems like they're really figuring out how to do this in a way that doesn't feel insane and I'm very excited they've been all over my Twitter giving me examples they're also open source which is really nice um they should show that all over the website did not know it was Python and typescript hybrid interesting yeah they were open source lemon squeezy and paddle alternative so you can host it yourself you can go through them pricing is relatively good seems like a genuinely really good option and honestly I probably would have went with it if I had given it a more serious look before setting up things for T3 chat but it always felt weird to use stripe rappers like I just think stripe needs to fix their I say as a person who sells a rapper for S3 and open Ai and agor web RTC sdks that we're not going to think about that one too much okay if using a framework like larel or rails they have their own payment stuff built in that can be good but I found it is often quite limited and not fully inter gred and sometimes even has the same edge cases that I just broke down how painful and miserable they are there is one last thing and I almost feel bad bringing it up because I'm really mad clerk the oth company is working on a stripe integration and if they actually ship this it'll be incredible because you can link stripe to clerk you can describe in clerk what sub tiers exist and whether a user subs or an org subs or both create all of those options for users and now when they go to their user profile they'll just have all the things for their billing right there all integrated and billing is a consistent enough thing especially like recurring monthly billing that it should be this simple it should be integrated with your off layer because it should be tied to users this was a post that the CEO of clerk made in April of last year and it has not shipped they hired somebody full-time to work on it and it still hasn't shipped I don't even have Early Access yet I'm not convinced this will ever ship if it does it'll be a great option and if anything it'll make it so I go from liking clerk to not knowing to build apps without it I would love for this to actually happen but I'm going to keep shaming them until it does because at this point I think it's vaporware I don't actually believe this exists because if it did they would have given it to me so yeah we're nearing the one year mark since they first said they were doing this we'll see if it ever comes out so there you go this is how I kind of stay sane setting up stripe hopefully you don't think I'm insane now but hopefully the hair the wrinkled shirt and the yelling show just how painful it is to do stripe correctly I'm going to talk with the stripe team very soon see what we can do to smooth this out in the future but for now you have a lot to deal with hopefully the doc in this video help you understand how to integrate stripe properly or at the very least you now understand why it's not worth doing let me know what you guys think this was a painful one to film even more painful to build hopefully this helps some of yall adding Payment Processing to your apps until next time set up payment very very very carefully seriously I don't think you understand how bad this is I got h
