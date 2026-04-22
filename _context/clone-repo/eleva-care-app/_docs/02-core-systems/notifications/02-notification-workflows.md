# Notification Workflows Guide for Eleva.care

> **🔧 Technical Implementation**: This guide covers business workflows and content strategy. For technical setup, configuration, and code implementation, see [`novu-notifications.md`](./novu-notifications.md).

## 1. Introduction

### Purpose of this Document

This document serves as a comprehensive guide for understanding, implementing, managing, and testing notification workflows within the Eleva.care platform. It is intended for developers, product managers, and administrators involved in the notification system.

> **📚 Related Documentation**:
>
> - **[Technical Implementation Guide](./novu-notifications.md)**: Setup, configuration, API usage, and troubleshooting
> - **[Notification Workflows Guide](./notification_workflows_guide.md)**: This document - business workflows and content strategy

### Overview of the Notification System using Novu.co

Eleva.care utilizes Novu.co as its primary notification infrastructure provider. Novu allows us to design, trigger, and manage multi-channel notifications (such as In-App, Email, and potentially SMS or Push notifications) from a centralized dashboard. This approach decouples notification logic from the main application code, providing flexibility and a rich feature set for delivering timely and relevant communications to our users (both customers and experts).

Our backend triggers notification events to Novu, passing specific payloads. Novu then processes these events based on predefined workflows and templates, delivering formatted notifications to the end-users on their preferred or configured channels.

> **⚙️ Technical Setup**: For detailed information on Novu configuration, provider setup, and code implementation patterns, refer to the [Technical Implementation Guide](./novu-notifications.md#setup-instructions).

### Importance of Notifications in the Telehealth Platform

Notifications are a critical component of the Eleva.care user experience. They serve multiple essential functions:

- **Transactional Information:** Confirming actions like bookings, payments, and account changes.
- **Reminders:** Helping users remember scheduled appointments, reducing no-shows.
- **Alerts:** Informing users about important security updates, verification statuses, or issues requiring their attention.
- **Engagement:** Keeping users informed about platform updates or relevant health information (though this guide primarily focuses on transactional and operational notifications).
- **Operational Efficiency:** Alerting experts to new bookings, cancellations, or payout statuses.
- **Trust and Reliability:** Providing timely and accurate information builds trust and enhances the perceived reliability of our platform.

Effective notifications ensure users are well-informed, prepared for their interactions, and confident in using Eleva.care services.

## 2. Core Concepts & Setup

### 2.1. Novu.co Overview

Novu.co is a versatile notification infrastructure service that provides several key features we leverage:

- **Workflow Management:** Visually design and manage notification sequences across multiple channels.
- **Multi-Channel Delivery:** Support for In-App, Email, SMS, Push, and Chat notifications through various providers.
- **Template Engine:** Create and manage notification content with support for variables (using Liquid templating syntax) and basic logic.
- **Subscriber Management:** Maintain a list of users (subscribers) with their preferences and attributes.
- **Activity Feeds & Logs:** Track notification delivery status and user engagement.
- **API & SDKs:** Allow programmatic triggering of notifications and integration with our application.
- **In-App Notification Center:** Provides UI components (like `PopoverNotificationCenter`) for an out-of-the-box in-app notification experience.

### 2.2. Initial Novu Setup (Recap)

The core integration with Novu is established through environment variables and configuration files within our application:

- **API Keys & Identifiers:**
  - `NOVU_SECRET_KEY`: A secret key used by our backend to authenticate with the Novu API for triggering events. This is stored securely as an environment variable.
  - `NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER`: A public identifier for our Novu application, used by frontend components like the `NovuProvider` to connect to the correct Novu instance. This is also an environment variable.
- **Backend Configuration (`config/novu.ts`):**
  - This file initializes the Novu Node.js SDK instance using the `NOVU_SECRET_KEY`.
  - The initialized `novu` object is then used throughout the backend (e.g., in `lib/notifications.ts`) to trigger notification events.
- **Environment Configuration (`config/env.ts`):**
  - This file centralizes the management of environment variables, including `NOVU_SECRET_KEY` and `NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER`. It ensures these variables are available to the application and may include validation checks.
- **Frontend Provider (`app/providers.tsx`):**
  - The `NovuProvider` component from `@novu/react` wraps our application (or relevant parts of it).
  - It's configured with the `NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER` and the current user's `subscriberId`.

### 2.3. Subscriber Management

Effective subscriber management is key to delivering personalized and correctly routed notifications.

- **Mapping Clerk User IDs to `subscriberId`:**
  - In Eleva.care, the primary user authentication is handled by Clerk. Each user in Clerk has a unique ID.
  - This **Clerk User ID is used as the `subscriberId` in Novu.**
  - When triggering a notification (e.g., via `novu.trigger()` in `lib/notifications.ts`), the `to.subscriberId` field is populated with the recipient's Clerk User ID.
  - Similarly, the `NovuProvider` on the frontend is initialized with the logged-in user's Clerk ID as the `subscriberId`.
  - This direct mapping ensures a consistent identifier across both systems.

- **Common Subscriber Data Sent to Novu:**
  - While Novu can store rich subscriber profiles, our current integration primarily focuses on sending essential data during the `novu.trigger()` call or when creating/updating subscribers directly in Novu (if done programmatically, though not currently a primary focus of our `createUserNotification` function which only sends `subscriberId` in the `to` field).
  - **Implicitly via Novu UI/SDK:** When a user interacts with Novu's In-App center, Novu's SDK might automatically collect some data like last seen time, device information, etc., as per Novu's capabilities.
  - **Explicitly if creating/updating subscribers:** If we were to explicitly create/update subscribers in Novu (e.g., via a separate backend process or API call to Novu), we would typically send:
    - `subscriberId`: (Clerk User ID - Mandatory)
    - `firstName`: (string, e.g., `user.firstName` from Clerk)
    - `lastName`: (string, e.g., `user.lastName` from Clerk)
    - `email`: (string, e.g., `user.primaryEmailAddress.emailAddress` from Clerk)
    - `phone`: (string, if available and needed for SMS)
    - `avatar`: (string, URL to profile picture, e.g., `user.imageUrl` from Clerk)
    - `locale`: (string, e.g., "en-US", "pt-PT", "es-ES", "pt-BR") - **Crucial for localization.**
    - Any other custom data relevant for segmentation or personalization.
  - Currently, the `firstName`, `email`, etc., are primarily passed within the **payload** of `novu.trigger()` (e.g., `payload.userName`) for direct use in templates, rather than relying on them being pre-set on the Novu subscriber profile for all cases. However, for features like `{{subscriber.firstName}}` in templates to work reliably, this data should be updated on the Novu subscriber record.

- **Managing `subscriber.locale` for Localization:**
  - To support multilingual notifications (English, Portuguese - Portugal, Portuguese - Brazil, Spanish - Spain), we need to manage the `subscriber.locale` attribute for each user in Novu.
  - **Source of Locale:** The user's locale preference should ideally be stored in our application's database (e.g., `UserTable` or `ProfileTable`) or derived from their browser settings / Clerk profile during sign-up or profile update.
  - **Passing Locale to Novu:**
    1.  **During Subscriber Creation/Update (Recommended for `{{subscriber.locale}}`):** When a user is created or updates their language preference in Eleva.care, a backend process should update their corresponding subscriber profile in Novu with the correct locale string.
        - Example API call to Novu (conceptual):
          ```javascript
          await novu.subscribers.identify('clerk_user_id_123', {
            firstName: 'John',
            email: 'john.doe@example.com',
            locale: 'en-US', // or 'pt-PT', 'es-ES', 'pt-BR'
          });
          ```
    2.  **In `novu.trigger()` (Alternative, for `{{payload.locale}}`):** While less ideal for subscriber-level preferences, you _could_ pass the locale in the event payload if it's context-specific:
        ```javascript
        novu.trigger('event-name', {
          to: { subscriberId: 'clerk_user_id_123' },
          payload: {
            userName: 'John',
            locale: 'en-US', // Passed with each event
            // ...other payload data
          },
        });
        ```
        However, using `subscriber.locale` (set via method 1) is generally preferred as it represents a persistent user preference and simplifies template logic.
  - **Supported Locale Strings:**
    - `en-US` for English (United States)
    - `pt-PT` for Portuguese (Portugal)
    - `pt-BR` for Portuguese (Brazil)
    - `es-ES` for Spanish (Spain)
  - **Using in Novu Templates:** As demonstrated in the multilingual examples, templates can then use Liquid logic like `{% assign lang_code = subscriber.locale | slice: 0, 2 %}` and `{% if lang_code == 'en' %}...{% elsif lang_code == 'es' %}...{% endif %}` to render localized content. Specific checks like `{% if subscriber.locale == 'pt-BR' %}` can be used for regional variations.
  - **Fallback:** Always include a default language (e.g., English) in your templates for cases where `subscriber.locale` might be missing or not one of the explicitly supported values.

## 3. General Novu Workflow Implementation

This section details the practical steps for creating and configuring notification workflows within the Novu.co dashboard. Consistent implementation across different notification types will ensure maintainability and a coherent user experience.

### 3.1. Creating a New Workflow

Workflows are the blueprints that define how notifications are structured, timed, and delivered across various channels for a specific event.

1.  **Navigate to Workflows:**
    - Log in to your Novu dashboard.
    - Locate and click on the "Workflows" (or similarly named) section in the main navigation menu. This is where all notification workflows are listed and managed.

2.  **Initiate Workflow Creation:**
    - Click on the "Create Workflow," "New Workflow," or an equivalent button.
    - You may be presented with options to use pre-built blueprints or to "Start from scratch." For most of our custom Eleva.care events, starting from scratch provides the necessary flexibility.

3.  **Name and Describe Your Workflow:**
    - **Workflow Name:** Assign a clear, descriptive name that reflects the purpose of the notification or the event it corresponds to. It's good practice to align this name closely with the Event Name/ID for easy identification (e.g., "Appointment Booking Confirmation - Customer," "Password Reset - Expert").
    - **Description (Optional):** Add a brief description if the functionality is complex or needs further context for other team members.
    - **Group/Tags (Optional):** Utilize groups or tags if available in Novu to organize workflows (e.g., by user type "Customer," "Expert," or by feature "Bookings," "Account").

### 3.2. Setting Up Event Triggers

The event trigger is the unique identifier that your Eleva.care backend application will use to invoke this specific workflow in Novu.

1.  **Access Trigger Configuration:**
    - Within the newly created workflow, the first step is typically to define the trigger. This might be labeled as "Trigger," "Event Trigger," or be an initial node in a visual workflow builder.

2.  **Define the Event Name/ID:**
    - In the designated field, enter the unique **Event Name** (also referred to as Event ID or Trigger ID).
    - **Critical:** This Event Name _must exactly match_ the string identifier used in the `novu.trigger("YOUR_EVENT_NAME", ...)` call within the Eleva.care backend (e.g., in `lib/notifications.ts`, the output of `mapNotificationTypeToNovuEvent` such as `appointment-booking-confirmation-customer` or `verification-help`).
    - Refer to the "Notification Event List" document for the definitive list of event names used in Eleva.care.

3.  **Define Payload Schema (Optional but Highly Recommended):**
    - Novu often provides an interface to define or paste a sample JSON schema for the payload that will accompany this event.
    - **Action:** Populate this with a representative JSON structure of the data your application will send for this event (e.g., for `appointment-booking-confirmation-customer`, include keys like `userName`, `expertName`, `appointmentDate`, `meetingLink`, etc.).
    - **Benefit:** Defining the schema here enables better autocompletion and preview capabilities when you are working in the template editor for different channels.

### 3.3. Adding Channel Steps

Workflows gain power by orchestrating messages across multiple communication channels. Each channel you want to use for a particular notification event will be a "step" in the workflow.

1.  **Add a Channel Step:**
    - In the workflow editor interface, find and click the "Add Step," "+", or similar icon/button. This allows you to append a new action or channel to your workflow sequence.

2.  **Select the Communication Channel:**
    - Choose the desired channel for this step from the available options. For Eleva.care, primary channels include:
      - **In-App:** For notifications delivered directly within the Eleva.care web application using the Novu `PopoverNotificationCenter` component. Suitable for immediate, contextual updates.
      - **Email:** For more persistent or detailed notifications. Essential for confirmations, summaries, and important alerts.
      - **SMS:** Can be used for highly urgent, time-sensitive notifications like very short-term appointment reminders or critical security alerts, if SMS providers are integrated and budget allows. Use judiciously.
      - **Push Notifications:** (Future consideration) If Eleva.care develops mobile applications, web push notifications could be integrated for real-time alerts.
    - Ensure the chosen channel has a corresponding active integration configured in Novu's "Integrations" section.

3.  **Order of Steps:**
    - Drag and drop steps to define their order if the workflow involves a sequence (e.g., In-App first, then Email).

4.  **Advanced Steps (Optional):**
    - **Delay:** Insert "Delay" steps to pause the workflow for a specified duration before proceeding to the next step (e.g., send an email only if an In-App message hasn't been read within 1 hour).
    - **Digest:** For lower-priority events, a "Digest" step can collect multiple triggers over a period and send a single summary notification (e.g., a daily digest of new articles or minor updates). This is less common for our core transactional notifications but useful for content updates.

### 3.4. Using the Template Editor

Each channel step requires a template that dictates the actual content of the notification.

1.  **Access the Editor:**
    - For any channel step you've added (e.g., Email, In-App), click the "Edit Template," "Open Editor," or an equivalent button to access the content editor for that specific channel.

2.  **Composing Content:**
    - **Static Content:** Type any fixed text directly into the editor. For emails, this includes the subject line and body. For In-App messages, this is typically the message content.
    - **Dynamic Content with Variables:**
      - **Payload Variables:** To insert data sent from your application (the `payload` object in `novu.trigger()`), use the Liquid templating syntax: `{{payload.variableName}}`.
        - Example: If your payload is `{"userName": "Alice", "appointmentDate": "July 28th"}`, you can write: `Hi {{payload.userName}}, your appointment is on {{payload.appointmentDate}}.`
        - For nested objects in the payload (e.g., `payload: { order: { id: "123" } }`), use dot notation: `Order ID: {{payload.order.id}}`.
      - **Subscriber Variables:** To insert data from the Novu subscriber profile (which should be populated with data from Clerk, including `locale`), use: `{{subscriber.variableName}}`.
        - Examples: `{{subscriber.firstName}}`, `{{subscriber.email}}`, `{{subscriber.locale}}`.
        - If a field might be missing, you can provide a fallback: `Hi {{subscriber.firstName | default: "there"}},`
    - **Rich Text vs. HTML vs. Plain Text:**
      - **Email:** Novu usually offers a rich text editor and an option to directly edit HTML for more complex layouts.
      - **In-App:** Typically a simpler text editor, may support basic markdown or limited HTML depending on the In-App component's capabilities.
      - **SMS:** Plain text only.

3.  **Previewing with Sample Data:**
    - Utilize the "Preview" tab or "Sample Data" feature within the template editor.
    - Input a sample JSON payload (matching what you defined for the trigger) and sample subscriber data to see how your variables render and to verify the overall appearance of the notification.

### 3.5. Implementing Multilingual Content (Liquid Templating)

To deliver notifications in the user's preferred language (en-US, pt-PT, pt-BR, es-ES), use Liquid templating logic within your channel templates.

1.  **Prerequisite: `subscriber.locale`:**
    - Ensure that the `subscriber.locale` field is consistently populated for all users in Novu with values like "en-US", "pt-PT", "pt-BR", or "es-ES". This is detailed in Section 2.3.

2.  **Liquid Logic for Language Switching:**
    - You can use `if/elsif/else` conditions or `case` statements based on `subscriber.locale`.
    - To simplify, you can first extract the primary language code (e.g., "en", "pt", "es"):
      ```liquid
      {% assign lang_code = subscriber.locale | slice: 0, 2 %}
      ```
    - Then, structure your template content:

      ```liquid
      {% comment %} Email Subject Example - if subject field supports Liquid, otherwise pass localized subject in payload {% endcomment %}
      {% if lang_code == 'es' %}Asunto en Español para {{payload.item}}
      {% elsif subscriber.locale == 'pt-BR' %}Assunto em Português Brasileiro para {{payload.item}}
      {% elsif lang_code == 'pt' %}Assunto em Português para {{payload.item}}
      {% else %}English Subject for {{payload.item}}
      {% endif %}

      {% comment %} Email Body Example {% endcomment %}
      {% if lang_code == 'es' %}
      Hola {{payload.userName | default: "Estimado Usuario"}},
      Este es el contenido de la notificación en español sobre {{payload.item}}.
      [Ver Detalles]({{payload.actionUrl}})
      {% elsif subscriber.locale == 'pt-BR' %}
      Olá {{payload.userName | default: "Prezado Usuário"}},
      Este é o conteúdo da notificação em português brasileiro sobre {{payload.item}}.
      [Ver Detalhes]({{payload.actionUrl}})
      {% elsif lang_code == 'pt' %}
      Olá {{payload.userName | default: "Estimado Utilizador"}},
      Este é o conteúdo da notificação em português sobre {{payload.item}}.
      [Ver Detalhes]({{payload.actionUrl}})
      {% else %}
      Hello {{payload.userName | default: "Valued User"}},
      This is the English notification content about {{payload.item}}.
      [View Details]({{payload.actionUrl}})
      {% endif %}
      ```

3.  **Handling Specific Locales (e.g., pt-PT vs. pt-BR):**
    - As shown above, after checking for the general language code `pt`, you can have a nested `if` or a more specific `elsif` for `subscriber.locale == 'pt-BR'` to handle regional variations if necessary. If no specific regional version is needed, the general `lang_code == 'pt'` block can serve both.

4.  **Default/Fallback Content:**
    - Always include an `{% else %}` block to provide default content (typically in English) if `subscriber.locale` is missing or doesn't match any of your specified languages.

5.  **Advanced Localization:**
    - For highly complex localization needs (e.g., significantly different layouts per language, right-to-left languages), investigate Novu's more advanced localization features. They might offer separate template versions per locale linked to a single workflow, which can be cleaner than very large Liquid blocks.

### 3.6. Saving and Testing Workflows

Thorough testing is crucial before notifications are sent to real users.

1.  **Save Changes:**
    - Frequently save your progress within the workflow editor and template editors using "Save," "Update," "Publish Changes," or similar buttons. Novu might have a distinction between saving a draft and publishing a version of the workflow that is live.

2.  **Use Novu's Testing Tools:**
    - **Test Trigger / Send Event:** Most Novu dashboards include a feature to manually simulate an event trigger for a specific workflow.
      - You will typically need to provide:
        1.  The **Event Name/ID** of the workflow you want to test.
        2.  The **Subscriber ID** of a test user (ensure this test subscriber has different `locale` values set in Novu for multilingual testing).
        3.  A **JSON Payload** containing sample data for all the variables your templates expect (e.g., `userName`, `appointmentDate`, `actionUrl`).
    - **Execute the Test:** Send the test event.

3.  **Review Test Results:**
    - **Activity Logs:** Check the "Logs," "Activity Feed," or a similar section in Novu. This will show if the event was received, which workflow was matched, the steps executed, and the status of each step (e.g., message sent, delivered, seen, read, failed, error).
    - **Rendered Content:** For channels like Email or In-App, Novu logs often allow you to view the actual content that was generated after processing your template and variables. Verify this against your expectations for different locales and payloads.
    - **Channel Delivery:** Check the actual channels (e.g., test email inbox, your application's In-App notification center logged in as the test subscriber) to confirm the notification was delivered and appears correctly.
    - **Error Debugging:** If a step failed, the logs should provide error messages or clues to help you debug issues in your templates, payload, or channel integration.

4.  **Iterate and Refine:**
    - Based on the test results, go back to your workflow settings, channel step configurations, or template editor to make necessary corrections. Repeat the testing process until the notifications behave exactly as intended for all scenarios and languages.

5.  **Activate/Publish Workflow:**
    - Once you are confident that the workflow is correct, ensure it is in a "Published" or "Active" state to be callable by your application's backend triggers.

## 4. Detailed Notification Workflows & Integration Points

This section provides a detailed breakdown of specific notification workflows implemented in Eleva.care. For each workflow, we outline its purpose, trigger, target audience, payload, content considerations, and integration points, particularly how events from services like Clerk are translated into Novu notification triggers.

### 4.1. User Account Management Notifications

These notifications relate to the user's lifecycle, account status, and security. Many of these are triggered by events originating from our authentication provider, Clerk.

---

#### 4.1.1. User Welcome Notification

- **Workflow Name:** `User Welcome - Customer`
- **Purpose:** To welcome new customers to the platform after they successfully sign up and guide them on initial steps.
- **Novu Event ID:** `CUSTOMER_WELCOME`
- **Target Audience:** Customer
- **Key Payload Variables:**
  - `userName`: string (Customer's first name)
  - `profileSetupLink`: string (URL to their profile completion page)
  - `bookingLink`: string (URL to the main booking/service discovery page)
- **Triggering Service/Event (Clerk):**
  - Clerk: After a new user completes the signup process. This can be handled via:
    1.  A Clerk webhook for the `user.created` event.
    2.  A callback in the application code immediately after a successful signup flow managed by Clerk's frontend components.
- **Data Acquisition Notes:**
  - `userName` (first name) can be obtained from the Clerk user object (e.g., `clerkUser.firstName`).
  - `profileSetupLink` and `bookingLink` are application-specific URLs generated by Eleva.care.
  - `subscriber.locale` should be determined at signup (e.g., from browser, user selection) and passed to Novu.
- **Conceptual Trigger Logic:**
  - _If using Clerk webhook for `user.created`_:
    ```javascript
    // Webhook Handler (e.g., /api/webhooks/clerk)
    async function handleClerkUserCreated(clerkUser) {
      const locale = determineUserLocale(clerkUser); // Implement this logic
      await novu.subscribers.identify(clerkUser.id, {
        // Best practice: identify subscriber with locale
        firstName: clerkUser.firstName,
        email: clerkUser.emailAddresses[0]?.emailAddress,
        locale: locale,
      });
      await createUserNotification({
        userId: clerkUser.id, // This is the Novu subscriberId
        type: 'CUSTOMER_WELCOME', // This will map to 'customer-welcome'
        title: 'Welcome to Eleva.care!', // Optional, as title can be fully managed in Novu template
        message: `Payload for welcome. User: ${clerkUser.firstName}`, // Message for Novu payload, not necessarily for display
        payload: {
          userName: clerkUser.firstName || 'there',
          profileSetupLink: 'https://eleva.care/account/profile', // Example
          bookingLink: 'https://eleva.care/booking', // Example
        },
      });
    }
    ```
- **Content Proposals (English):**
  - **Subject:** Welcome to Eleva.care, {{payload.userName}}!
  - **Body:**

    ```
    Hi {{payload.userName}},

    Welcome to Eleva.care! We're excited to help you on your wellness journey.

    To get started, you can complete your profile here: {{payload.profileSetupLink}}
    Or, browse available experts and book your first appointment: {{payload.bookingLink}}

    If you have any questions, don't hesitate to contact our support team.

    Thanks,
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Standard welcome greeting, calls to action (complete profile, book appointment).
  - Ensure link text within brackets (e.g., "[Complete Profile]") is translated if the links themselves are static in the template. If links are part of the payload, ensure the link text is translated there.
  - The salutation `Hi {{payload.userName}}` should be adapted appropriately for each language.
- **Primary Channels:** Email, In-App

---

#### 4.1.2. Email Verification Request

- **Workflow Name:** `User Email Verification`
- **Purpose:** To send a notification (typically email) containing a link or code that the user must use to verify their email address. _Note: Clerk often handles its own email verification flow by default. This Novu workflow would be for a custom flow or supplementary notifications._
- **Novu Event ID:** `USER_EMAIL_VERIFICATION_REQUEST`
- **Target Audience:** Customer, Expert (anyone signing up)
- **Key Payload Variables:**
  - `userName`: string
  - `verificationLink`: string (The unique link to verify the email)
  - `verificationCode`: string (Alternatively, a code to be entered manually)
  - `expiryTime`: string (e.g., "1 hour", "24 hours")
- **Triggering Service/Event (Clerk):**
  - Clerk: If Clerk is configured for manual email verification and emits an event or provides a hook when a verification email needs to be sent.
  - Application: More likely, if the application implements its own email verification logic post-signup (e.g., if Clerk's default is disabled or needs supplementing).
- **Data Acquisition Notes:**
  - `userName` from Clerk user object.
  - `verificationLink` or `verificationCode` generated by the application's custom email verification logic.
  - `subscriber.locale` for language.
- **Conceptual Trigger Logic:**
  - _If custom application logic_:

    ```javascript
    // After user signup, if custom verification is needed
    async function sendCustomVerificationEmail(clerkUser, verificationData) {
      const locale = determineUserLocale(clerkUser);
      // It's good practice to also update subscriber attributes in Novu if not done elsewhere
      await novu.subscribers.identify(clerkUser.id, {
        locale: locale,
        email: clerkUser.emailAddresses[0]?.emailAddress,
      });

      await createUserNotification({
        userId: clerkUser.id,
        type: 'USER_EMAIL_VERIFICATION_REQUEST',
        title: 'Verify Your Email Address',
        message: 'Please verify your email to activate your Eleva.care account.', // For payload
        payload: {
          userName: clerkUser.firstName || 'there',
          verificationLink: verificationData.link,
          // verificationCode: verificationData.code, // If using code
          expiryTime: '24 hours',
        },
      });
    }
    ```

- **Content Proposals (English):**
  - **Subject:** Verify Your Email Address for Eleva.care
  - **Body:**

    ```
    Hi {{payload.userName}},

    Please verify your email address to complete your Eleva.care registration and activate your account.
    Click the link below:
    {{payload.verificationLink}}

    {{#if payload.verificationCode}}Alternatively, enter this code: {{payload.verificationCode}}{{/if}}

    This link/code will expire in {{payload.expiryTime}}. If you didn't create an account, please ignore this email.

    Thanks,
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Crucial transactional email. All text, including instructions and expiry information, needs translation.
  - The phrase "Verify Your Email Address" needs careful translation for clarity.
- **Primary Channels:** Email (Primarily)

---

#### 4.1.3. Password Reset Request

- **Workflow Name:** `User Password Reset Request`
- **Purpose:** To send an email with a secure link allowing the user to reset their password.
- **Novu Event ID:** `USER_PASSWORD_RESET_REQUEST` (Can be `CUSTOMER_PASSWORD_RESET_REQUEST` or `EXPERT_PASSWORD_RESET_REQUEST` if content differs significantly)
- **Target Audience:** Customer, Expert
- **Key Payload Variables:**
  - `userName`: string
  - `passwordResetLink`: string
  - `resetLinkExpiryTime`: string (e.g., "30 minutes")
- **Triggering Service/Event (Clerk):**
  - Clerk: Typically, Clerk can be configured to handle the password reset flow and send its own emails.
  - If a custom flow is desired through Novu: The application would capture the password reset request, generate a unique token and link, and then trigger this Novu notification. This implies disabling Clerk's default password reset email.
- **Data Acquisition Notes:**
  - `userName` from the user's profile (fetched by email or username when they request a reset).
  - `passwordResetLink` generated by the application, containing a secure, single-use token.
  - `subscriber.locale`.
- **Conceptual Trigger Logic:**
  - _If custom application logic for password reset_:

    ```javascript
    // When user requests password reset via application form
    async function handlePasswordResetRequest(userAccount, resetData) {
      const locale = userAccount.locale || 'en-US'; // Assuming locale is stored
      // Update Novu subscriber with locale if not already fresh
      await novu.subscribers.setAttributes(userAccount.clerkId, { locale: locale });

      await createUserNotification({
        userId: userAccount.clerkId,
        type: 'USER_PASSWORD_RESET_REQUEST',
        title: 'Password Reset Requested',
        message: 'Instructions to reset password.', // For payload
        payload: {
          userName: userAccount.firstName || 'there',
          passwordResetLink: resetData.link,
          resetLinkExpiryTime: '30 minutes',
        },
      });
    }
    ```

- **Content Proposals (English):**
  - **Subject:** Eleva.care Password Reset Request
  - **Body:**

    ```
    Hi {{payload.userName}},

    We received a request to reset your password for your Eleva.care account.
    Please click the link below to set a new password:
    {{payload.passwordResetLink}}

    This link will expire in {{payload.resetLinkExpiryTime}}. If you did not request a password reset, please ignore this email or contact support if you have concerns.

    Thanks,
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Critical security email. All text must be accurately translated.
  - Emphasize the expiry time and the instruction to ignore if not requested.
- **Primary Channels:** Email (Only)

---

#### 4.1.4. Password Changed Confirmation

- **Workflow Name:** `User Password Changed Confirmation`
- **Purpose:** To inform the user that their password has been successfully changed.
- **Novu Event ID:** `USER_PASSWORD_CHANGED_CONFIRMATION` (Can be `CUSTOMER_PASSWORD_CHANGED_CONFIRMATION` or `EXPERT_PASSWORD_CHANGED_CONFIRMATION`)
- **Target Audience:** Customer, Expert
- **Key Payload Variables:**
  - `userName`: string
  - `loginLink`: string (Link to the login page)
  - `contactSupportLink`: string (Link to support page/contact info)
- **Triggering Service/Event (Clerk):**
  - Clerk: After a user successfully completes a password change. This can be handled via:
    1.  A Clerk webhook for the `user.updated` event (inspecting for password change flags, if available).
    2.  A callback in the application code after a successful password change flow.
  - Clerk might also send its own notification for this, so ensure no duplication if using Novu.
- **Data Acquisition Notes:**
  - `userName` from Clerk user object.
  - `loginLink`, `contactSupportLink` are application-specific URLs.
  - `subscriber.locale`.
- **Conceptual Trigger Logic:**
  - _If using Clerk webhook for `user.updated` (and can identify password change)_:

    ```javascript
    // Webhook Handler (e.g., /api/webhooks/clerk)
    async function handleClerkUserUpdated(clerkUser, eventDetails) {
      // Hypothetical: if (eventDetails.password_changed) { ... }
      const locale = determineUserLocale(clerkUser);
      await novu.subscribers.setAttributes(clerkUser.id, { locale: locale }); // Ensure locale is up-to-date

      await createUserNotification({
        userId: clerkUser.id,
        type: 'USER_PASSWORD_CHANGED_CONFIRMATION',
        title: 'Password Successfully Changed',
        message: 'Confirmation that your password has been updated.', // For payload
        payload: {
          userName: clerkUser.firstName || 'there',
          loginLink: 'https://eleva.care/sign-in', // Example
          contactSupportLink: 'https://eleva.care/support', // Example
        },
      });
    }
    ```

- **Content Proposals (English):**
  - **Subject:** Your Eleva.care Password Has Been Changed
  - **Body:**

    ```
    Hi {{payload.userName}},

    This email confirms that the password for your Eleva.care account was successfully changed.

    You can now log in using your new password here: {{payload.loginLink}}

    If you did not make this change, please contact our support team immediately: {{payload.contactSupportLink}}

    Thanks,
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Security-sensitive confirmation. Clear, direct language is important.
  - Instruction on what to do if the user _didn't_ make the change is crucial.
- **Primary Channels:** Email

---

### 4.2. Booking & Appointment Management Notifications

These notifications are central to the user journey for both customers and experts, covering the lifecycle of an appointment from booking to completion.

---

#### 4.2.1. Appointment Booking Confirmation - Customer

- **Workflow Name:** `Appointment Confirmation - Customer`
- **Purpose:** To confirm to the customer that their appointment has been successfully booked and provide all necessary details.
- **Novu Event ID:** `APPOINTMENT_BOOKING_CONFIRMATION_CUSTOMER`
- **Target Audience:** Customer
- **Key Payload Variables:**
  - `userName`: string (Customer's first name)
  - `expertName`: string
  - `appointmentDate`: string (e.g., "July 26, 2024")
  - `appointmentTime`: string (e.g., "10:00 AM PST" - including timezone)
  - `appointmentType`: string (e.g., "Initial Consultation")
  - `meetingLink`: string (URL for the video call)
  - `addToCalendarLink_Google`: string (URL to add to Google Calendar)
  - `addToCalendarLink_Outlook`: string (URL to add to Outlook Calendar)
  - `appointmentDetailsLink`: string (URL to view appointment details on the platform)
  - `cancellationPolicySummary`: string (optional, brief summary or link to policy)
- **Triggering Service/Event:**
  - Application Logic: Triggered after a successful appointment booking and payment transaction (if applicable) is recorded in the **Neon.tech PostgreSQL** database.
- **Data Acquisition Notes:**
  - All payload data is fetched from the newly created `MeetingTable` record and related `EventTable`, `UserTable` (for expert name), and customer's `UserTable` (for `userName` and `locale`) in the Neon.tech PostgreSQL database.
  - Calendar links are generated by the application.
- **Conceptual Trigger Logic:**
  - ```javascript
    // Inside application service after successful booking and DB commit:
    async function processNewBooking(bookingRecord, customer, expert) {
      const locale = customer.locale || 'en-US';
      // Ensure Novu subscriber has locale
      await novu.subscribers.setAttributes(customer.clerkId, { locale: locale });

      await createUserNotification({
        userId: customer.clerkId, // Novu subscriberId
        type: 'APPOINTMENT_BOOKING_CONFIRMATION_CUSTOMER',
        // title and message are primarily for Novu's internal logging if templates manage all content
        title: `Appointment Confirmed with ${expert.name}`,
        message: `Details for appointment on ${bookingRecord.startTime}`,
        payload: {
          userName: customer.firstName,
          expertName: `${expert.firstName} ${expert.lastName}`,
          appointmentDate: formatDate(bookingRecord.startTime, locale), // Implement formatDate
          appointmentTime: formatTime(bookingRecord.startTime, bookingRecord.timezone, locale), // Implement formatTime
          appointmentType: bookingRecord.event.name,
          meetingLink: bookingRecord.meetingUrl,
          addToCalendarLink_Google: generateGCalLink(bookingRecord), // Implement
          addToCalendarLink_Outlook: generateOutlookCalLink(bookingRecord), // Implement
          appointmentDetailsLink: `https://eleva.care/appointments/${bookingRecord.id}`, // Example
          cancellationPolicySummary: 'Cancel up to 24hrs before for a full refund.', // Example
        },
      });
    }
    ```

- **Content Proposals (English):**
  - **Subject:** Your Eleva.care Appointment with {{payload.expertName}} is Confirmed!
  - **Body:**

    ```
    Hi {{payload.userName}},

    Your {{payload.appointmentType}} with {{payload.expertName}} is confirmed!

    Date: {{payload.appointmentDate}}
    Time: {{payload.appointmentTime}}
    Join your meeting: {{payload.meetingLink}}

    Add to your calendar:
    [Google Calendar]({{payload.addToCalendarLink_Google}}) | [Outlook Calendar]({{payload.addToCalendarLink_Outlook}})

    View full appointment details here: {{payload.appointmentDetailsLink}}
    {{#if payload.cancellationPolicySummary}}Cancellation Policy: {{payload.cancellationPolicySummary}}{{/if}}

    We look forward to seeing you!
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Key transactional email. All elements (dates, times, CTAs) must be localized.
  - "Add to your calendar" and button texts need translation.
  - Consider date/time formatting carefully based on `locale` (ideally pre-formatted in payload).
- **Primary Channels:** Email, In-App

---

#### 4.2.2. Appointment Booking Notification - Expert

- **Workflow Name:** `New Appointment Alert - Expert`
- **Purpose:** To notify the expert that a new appointment has been booked with them.
- **Novu Event ID:** `NEW_APPOINTMENT_BOOKING_EXPERT`
- **Target Audience:** Expert
- **Key Payload Variables:**
  - `expertName`: string (Expert's first name)
  - `customerName`: string (Customer's name, or an anonymized identifier like "A Client")
  - `appointmentDate`: string
  - `appointmentTime`: string (including expert's timezone)
  - `appointmentType`: string
  - `appointmentDetailsLink`: string (URL to view this appointment in their dashboard)
  - `customerNotes`: string (optional, notes provided by customer during booking)
- **Triggering Service/Event:**
  - Application Logic: Triggered simultaneously with (or immediately after) `APPOINTMENT_BOOKING_CONFIRMATION_CUSTOMER`, after the booking is confirmed in the **Neon.tech PostgreSQL** database.
- **Data Acquisition Notes:**
  - Data fetched from `MeetingTable`, `EventTable`, customer's `UserTable`, and expert's `UserTable` in Neon.tech PostgreSQL.
  - Expert's `locale` from their Novu subscriber profile.
- **Conceptual Trigger Logic:**
  - ```javascript
    // Inside application service after successful booking, called alongside customer notification:
    async function notifyExpertOfNewBooking(bookingRecord, customer, expert) {
      const locale = expert.locale || 'en-US'; // Expert's preferred locale
      // Ensure Novu subscriber has locale
      await novu.subscribers.setAttributes(expert.clerkId, { locale: locale });

      await createUserNotification({
        userId: expert.clerkId, // Novu subscriberId
        type: 'NEW_APPOINTMENT_BOOKING_EXPERT',
        title: `New Booking: ${bookingRecord.event.name}`,
        message: `New appointment with ${customer.firstName} on ${bookingRecord.startTime}`,
        payload: {
          expertName: expert.firstName,
          customerName: `${customer.firstName} ${customer.lastName.charAt(0)}.`, // Example: "John D." for privacy
          appointmentDate: formatDate(bookingRecord.startTime, locale),
          appointmentTime: formatTime(bookingRecord.startTime, expert.timezone, locale),
          appointmentType: bookingRecord.event.name,
          appointmentDetailsLink: `https://eleva.care/expert/appointments/${bookingRecord.id}`, // Example
          customerNotes: bookingRecord.guestNotes,
        },
      });
    }
    ```

- **Content Proposals (English):**
  - **Subject:** New Booking: {{payload.appointmentType}} with {{payload.customerName}} on {{payload.appointmentDate}}
  - **Body:**

    ```
    Hi {{payload.expertName}},

    You have a new booking!
    Service: {{payload.appointmentType}}
    With: {{payload.customerName}}
    Date: {{payload.appointmentDate}}
    Time: {{payload.appointmentTime}}

    {{#if payload.customerNotes}}Customer Notes: {{payload.customerNotes}}{{/if}}

    Please review the appointment details in your dashboard:
    {{payload.appointmentDetailsLink}}

    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Key notification for expert operations.
  - Consider privacy for `customerName` (e.g., first name and last initial).
  - Translate "Customer Notes" and other labels.
- **Primary Channels:** Email, In-App (High Priority for Expert)

---

#### 4.2.3. Appointment Rescheduled Notification (Customer & Expert)

- **Workflow Name:** `Appointment Rescheduled`
- **Purpose:** To inform the relevant party (customer or expert) that an appointment has been rescheduled.
- **Novu Event ID:**
  - `APPOINTMENT_RESCHEDULED_CUSTOMER`
  - `APPOINTMENT_RESCHEDULED_EXPERT`
- **Target Audience:** Customer OR Expert
- **Key Payload Variables:**
  - `userName`: string (Recipient's first name)
  - `otherPartyName`: string (Name of the person who initiated the reschedule)
  - `oldAppointmentDate`: string
  - `oldAppointmentTime`: string
  - `newAppointmentDate`: string
  - `newAppointmentTime`: string
  - `appointmentType`: string
  - `reasonForReschedule`: string (optional, if provided)
  - `appointmentDetailsLink`: string
- **Triggering Service/Event:**
  - Application Logic: After an appointment is successfully rescheduled in the **Neon.tech PostgreSQL** database.
- **Data Acquisition Notes:**
  - Data fetched from the updated `MeetingTable` and related user tables.
  - Recipient's `locale`.
- **Conceptual Trigger Logic:**
  - ```javascript
    // After appointment reschedule in DB
    async function notifyOfReschedule(updatedBooking, recipientUser, initiatorUser, reason = null) {
      const eventType =
        recipientUser.role === 'customer'
          ? 'APPOINTMENT_RESCHEDULED_CUSTOMER'
          : 'APPOINTMENT_RESCHEDULED_EXPERT';
      const locale = recipientUser.locale || 'en-US';
      await novu.subscribers.setAttributes(recipientUser.clerkId, { locale: locale });

      await createUserNotification({
        userId: recipientUser.clerkId,
        type: eventType,
        title: `Appointment Rescheduled for ${updatedBooking.event.name}`,
        message: `Your appointment on ${formatDate(updatedBooking.oldStartTime)} has been moved.`, // oldStartTime from before update
        payload: {
          userName: recipientUser.firstName,
          otherPartyName: `${initiatorUser.firstName} ${initiatorUser.lastName.charAt(0)}.`,
          oldAppointmentDate: formatDate(updatedBooking.oldStartTime, locale), // Pass old start time
          oldAppointmentTime: formatTime(
            updatedBooking.oldStartTime,
            recipientUser.timezone,
            locale,
          ), // Pass old start time
          newAppointmentDate: formatDate(updatedBooking.startTime, locale), // startTime is new start time
          newAppointmentTime: formatTime(updatedBooking.startTime, recipientUser.timezone, locale), // startTime is new start time
          appointmentType: updatedBooking.event.name,
          reasonForReschedule: reason,
          appointmentDetailsLink: `https://eleva.care/appointments/${updatedBooking.id}`, // Adjust link per role
        },
      });
    }
    ```

- **Content Proposals (English - for Customer being notified):**
  - **Subject:** Your Eleva.care Appointment Has Been Rescheduled
  - **Body:**

    ```
    Hi {{payload.userName}},

    Your {{payload.appointmentType}} appointment originally scheduled for {{payload.oldAppointmentDate}} at {{payload.oldAppointmentTime}} has been rescheduled by {{payload.otherPartyName}}.

    New Appointment Details:
    Date: {{payload.newAppointmentDate}}
    Time: {{payload.newAppointmentTime}}

    {{#if payload.reasonForReschedule}}Reason: {{payload.reasonForReschedule}}{{/if}}

    View updated details: {{payload.appointmentDetailsLink}}
    If this new time doesn't work, please contact {{payload.otherPartyName}} or support.

    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Clearly state old vs. new times.
  - Translate "Reason" and contact instructions.
- **Primary Channels:** Email, In-App

---

#### 4.2.4. Appointment Cancelled Notification (Customer & Expert)

- **Workflow Name:** `Appointment Cancelled`
- **Purpose:** To inform the relevant party that an appointment has been cancelled.
- **Novu Event ID:**
  - `APPOINTMENT_CANCELLED_CUSTOMER`
  - `APPOINTMENT_CANCELLED_EXPERT`
- **Target Audience:** Customer OR Expert
- **Key Payload Variables:**
  - `userName`: string (Recipient's first name)
  - `otherPartyName`: string (Name of person who initiated cancellation)
  - `appointmentDate`: string
  - `appointmentTime`: string
  - `appointmentType`: string
  - `reasonForCancellation`: string (optional)
  - `refundStatusMessage`: string (optional, for customer, e.g., "A full refund of $XX.XX has been processed.")
  - `rebookingLink`: string (optional, for customer)
  - `viewScheduleLink`: string (optional, for expert)
- **Triggering Service/Event:**
  - Application Logic: After an appointment is successfully cancelled in the **Neon.tech PostgreSQL** database.
- **Data Acquisition Notes:**
  - Data from the (now cancelled) `MeetingTable` and related user tables.
  - Recipient's `locale`.
- **Conceptual Trigger Logic:**
  - ```javascript
    // After appointment cancellation in DB
    async function notifyOfCancellation(
      cancelledBooking,
      recipientUser,
      initiatorUser,
      reason = null,
      refundMsg = null,
    ) {
      const eventType =
        recipientUser.role === 'customer'
          ? 'APPOINTMENT_CANCELLED_CUSTOMER'
          : 'APPOINTMENT_CANCELLED_EXPERT';
      const locale = recipientUser.locale || 'en-US';
      await novu.subscribers.setAttributes(recipientUser.clerkId, { locale: locale });

      await createUserNotification({
        userId: recipientUser.clerkId,
        type: eventType,
        title: `Appointment Cancelled: ${cancelledBooking.event.name}`,
        message: `Your appointment on ${formatDate(cancelledBooking.startTime)} has been cancelled.`,
        payload: {
          userName: recipientUser.firstName,
          otherPartyName: `${initiatorUser.firstName} ${initiatorUser.lastName.charAt(0)}.`,
          appointmentDate: formatDate(cancelledBooking.startTime, locale),
          appointmentTime: formatTime(cancelledBooking.startTime, recipientUser.timezone, locale),
          appointmentType: cancelledBooking.event.name,
          reasonForCancellation: reason,
          refundStatusMessage: recipientUser.role === 'customer' ? refundMsg : null,
          rebookingLink: recipientUser.role === 'customer' ? 'https://eleva.care/booking' : null, // Example
          viewScheduleLink:
            recipientUser.role === 'expert' ? 'https://eleva.care/expert/schedule' : null, // Example
        },
      });
    }
    ```

- **Content Proposals (English - for Customer being notified):**
  - **Subject:** Your Eleva.care Appointment on {{payload.appointmentDate}} Has Been Cancelled
  - **Body:**

    ```
    Hi {{payload.userName}},

    This email confirms that your {{payload.appointmentType}} appointment with {{payload.otherPartyName}} scheduled for {{payload.appointmentDate}} at {{payload.appointmentTime}} has been cancelled.

    {{#if payload.reasonForCancellation}}Reason for cancellation: {{payload.reasonForCancellation}}{{/if}}
    {{#if payload.refundStatusMessage}}{{payload.refundStatusMessage}}{{/if}}

    We apologize for any inconvenience.
    {{#if payload.rebookingLink}}You can book a new appointment here: {{payload.rebookingLink}}{{/if}}

    If you have questions, please contact support.
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Clearly state cancellation and any refund information.
  - Provide appropriate next steps (rebook, view schedule).
- **Primary Channels:** Email, In-App

---

#### 4.2.5. Appointment Reminder (Customer & Expert - e.g., 24hr, 1hr)

- **Workflow Name:** `Appointment Reminder - 24hr`, `Appointment Reminder - 1hr`
- **Purpose:** To remind users (customer and expert) of an upcoming appointment.
- **Novu Event ID:**
  - `APPOINTMENT_REMINDER_CUSTOMER` (can add suffixes like `_24HR`, `_1HR` or use payload to differentiate in template)
  - `APPOINTMENT_REMINDER_EXPERT` (similarly)
- **Target Audience:** Customer, Expert
- **Key Payload Variables:**
  - `userName`: string (Recipient's first name)
  - `otherPartyName`: string (Customer name for expert, Expert name for customer)
  - `appointmentDate`: string
  - `appointmentTime`: string (including recipient's timezone)
  - `appointmentType`: string
  - `timeUntilAppointment`: string (e.g., "tomorrow", "in 1 hour", "today" - localized by backend)
  - `meetingLink`: string
  - `appointmentDetailsLink`: string
- **Triggering Service/Event:**
  - **QStash (Scheduled Job):** A QStash job runs periodically (e.g., hourly, daily).
- **Data Acquisition Notes:**
  - The QStash job queries the **Neon.tech PostgreSQL** database for appointments occurring within the relevant future window (e.g., next 24-25 hours for a 24-hour reminder).
  - It fetches details for each appointment and the `locale` for both the customer and expert from their user profiles.
- **Conceptual Trigger Logic:**
  - ```javascript
    // QStash Worker Logic (simplified)
    async function processAppointmentReminders() {
      const upcomingAppointments = await getAppointmentsNeedingRemindersFromDB(); // Fetches appointments for next X hours

      for (const appt of upcomingAppointments) {
        const customer = appt.customer; // Assume populated with user details including locale, clerkId
        const expert = appt.expert; // Assume populated with user details including locale, clerkId

        // Notify Customer
        const customerLocale = customer.locale || 'en-US';
        await novu.subscribers.setAttributes(customer.clerkId, { locale: customerLocale });
        await createUserNotification({
          userId: customer.clerkId,
          type: 'APPOINTMENT_REMINDER_CUSTOMER',
          title: `Reminder: Appointment with ${expert.firstName}`,
          message: `Your appointment is ${getLocalizedTimeUntil(appt.startTime, customerLocale)}`,
          payload: {
            userName: customer.firstName,
            otherPartyName: `${expert.firstName} ${expert.lastName.charAt(0)}.`,
            appointmentDate: formatDate(appt.startTime, customerLocale),
            appointmentTime: formatTime(appt.startTime, customer.timezone, customerLocale),
            appointmentType: appt.event.name,
            timeUntilAppointment: getLocalizedTimeUntil(appt.startTime, customerLocale),
            meetingLink: appt.meetingUrl,
            appointmentDetailsLink: `https://eleva.care/appointments/${appt.id}`,
          },
        });

        // Notify Expert
        const expertLocale = expert.locale || 'en-US';
        await novu.subscribers.setAttributes(expert.clerkId, { locale: expertLocale });
        await createUserNotification({
          userId: expert.clerkId,
          type: 'APPOINTMENT_REMINDER_EXPERT',
          title: `Reminder: Appointment with ${customer.firstName}`,
          message: `Your appointment is ${getLocalizedTimeUntil(appt.startTime, expertLocale)}`,
          payload: {
            userName: expert.firstName,
            otherPartyName: `${customer.firstName} ${customer.lastName.charAt(0)}.`,
            appointmentDate: formatDate(appt.startTime, expertLocale),
            appointmentTime: formatTime(appt.startTime, expert.timezone, expertLocale),
            appointmentType: appt.event.name,
            timeUntilAppointment: getLocalizedTimeUntil(appt.startTime, expertLocale),
            meetingLink: appt.meetingUrl,
            appointmentDetailsLink: `https://eleva.care/expert/appointments/${appt.id}`,
          },
        });
      }
    }
    ```

- **Content Proposals (English - for Customer):**
  - **Subject:** Reminder: Your Eleva.care Appointment is {{payload.timeUntilAppointment}}
  - **Body:**

    ```
    Hi {{payload.userName}},

    This is a friendly reminder that your {{payload.appointmentType}} with {{payload.otherPartyName}} is {{payload.timeUntilAppointment}}, on {{payload.appointmentDate}} at {{payload.appointmentTime}}.

    Join your meeting: {{payload.meetingLink}}
    View appointment details: {{payload.appointmentDetailsLink}}

    Please ensure you are in a quiet place with a stable internet connection before your session.
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - `timeUntilAppointment` needs to be a translatable string or derived from localized date math (best done in backend by `getLocalizedTimeUntil`).
  - Standard reminder phrasing.
- **Primary Channels:** Email, In-App. SMS could be considered for very short-term reminders (e.g., 1-hour reminder).

---

### 4.3. Payment & Billing Management Notifications

These notifications are crucial for keeping users informed about financial transactions, subscription statuses, and payout processes. Many of these are triggered by webhooks from Stripe or by application logic interacting with Stripe.

---

#### 4.3.1. Payment Successful - Customer

- **Workflow Name:** `Payment Confirmation - Customer`
- **Purpose:** To confirm to the customer that their payment for a service or product was successful.
- **Novu Event ID:** `PAYMENT_SUCCESS_CUSTOMER`
- **Target Audience:** Customer
- **Key Payload Variables:**
  - `userName`: string (Customer's first name)
  - `orderId`: string (Application's internal order/booking ID, if applicable)
  - `stripePaymentIntentId`: string (Stripe Payment Intent ID for reference)
  - `amountPaid`: string (e.g., "$50.00 USD", "€45.00 EUR")
  - `paymentDate`: string (Localized date of payment)
  - `serviceName`: string (Description of the service/product purchased)
  - `paymentMethodLast4`: string (e.g., "Visa ending in 1234")
  - `receiptLink`: string (Optional: Link to a detailed receipt/invoice page in the application)
- **Triggering Service/Event (Stripe):**
  - Stripe Webhook: `payment_intent.succeeded`.
  - Alternatively, application logic immediately after confirming payment success with Stripe SDK.
- **Data Acquisition Notes:**
  - Most data (`amountPaid`, `stripePaymentIntentId`, payment method details) comes directly from the Stripe `PaymentIntent` object (available in the webhook payload or API response).
  - `userName`, `orderId`, `serviceName`, `locale` are retrieved from the application's **Neon.tech PostgreSQL** database using the `customer_id` or `metadata` stored in the Stripe `PaymentIntent`.
- **Conceptual Trigger Logic:**
  - ```javascript
    // Stripe Webhook Handler (e.g., /api/webhooks/stripe)
    // Case: event.type === 'payment_intent.succeeded'
    async function handlePaymentIntentSucceeded(paymentIntent) {
      const customerId = paymentIntent.customer; // Stripe Customer ID
      const internalOrderRef = paymentIntent.metadata.internalOrderId; // Assuming you store this

      const user = await getUserByStripeCustomerId(customerId); // Fetch user from local DB
      const orderDetails = await getOrderDetails(internalOrderRef); // Fetch order details

      if (user && orderDetails) {
        const locale = user.locale || 'en-US';
        await novu.subscribers.setAttributes(user.clerkId, { locale: locale });

        await createUserNotification({
          userId: user.clerkId,
          type: 'PAYMENT_SUCCESS_CUSTOMER',
          title: `Payment Confirmed for ${orderDetails.serviceName}`,
          message: `Payment of ${paymentIntent.amount_received / 100} ${paymentIntent.currency.toUpperCase()} succeeded.`,
          payload: {
            userName: user.firstName,
            orderId: internalOrderRef,
            stripePaymentIntentId: paymentIntent.id,
            amountPaid: `${formatCurrency(paymentIntent.amount_received / 100, paymentIntent.currency)}`, // Pre-formatted
            paymentDate: formatDate(new Date(paymentIntent.created * 1000), locale), // Pre-formatted
            serviceName: orderDetails.serviceName,
            paymentMethodLast4: getPaymentMethodDetails(paymentIntent.payment_method), // Implement this
            receiptLink: `https://eleva.care/orders/${internalOrderRef}/receipt`, // Example
          },
        });
      }
    }
    ```

- **Content Proposals (English):**
  - **Subject:** Your Eleva.care Payment Confirmation (Order #{{payload.orderId}})
  - **Body:**

    ```
    Hi {{payload.userName}},

    This confirms your payment of {{payload.amountPaid}} for "{{payload.serviceName}}" on {{payload.paymentDate}} was successful.
    Your Order ID: {{payload.orderId}}
    Payment Method: {{payload.paymentMethodLast4}}

    {{#if payload.receiptLink}}You can view your full receipt here: [View Receipt]({{payload.receiptLink}}){{/if}}

    Thank you for your payment.
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Translate payment-related terms ("Payment Confirmation", "Order ID", "Payment Method", "View Receipt").
  - Ensure currency formatting is appropriate or clearly stated (best done in backend pre-formatting `amountPaid`).
- **Primary Channels:** Email

---

#### 4.3.2. Payment Failed - Customer

- **Workflow Name:** `Payment Failed - Customer`
- **Purpose:** To inform the customer that their payment attempt failed and guide them on next steps.
- **Novu Event ID:** `PAYMENT_FAILED_CUSTOMER`
- **Target Audience:** Customer
- **Key Payload Variables:**
  - `userName`: string
  - `serviceName`: string (What they were trying to pay for)
  - `amount`: string (The amount that failed, pre-formatted)
  - `failureReason`: string (If available from Stripe, simplified)
  - `updatePaymentLink`: string (Link to update their payment method)
  - `retryPaymentLink`: string (Optional, if a retry can be initiated)
  - `contactSupportLink`: string
- **Triggering Service/Event (Stripe):**
  - Stripe Webhook: `payment_intent.payment_failed`.
  - Stripe Webhook: `invoice.payment_failed` (for subscriptions).
- **Data Acquisition Notes:**
  - `failureReason` from Stripe event object (`last_payment_error.message` or similar).
  - Other data from application database based on `customer_id` or `metadata` in the Stripe event.
  - `locale` from Novu subscriber profile.
- **Conceptual Trigger Logic:**
  - ```javascript
    // Stripe Webhook Handler
    // Case: event.type === 'payment_intent.payment_failed'
    async function handlePaymentIntentFailed(paymentIntent) {
      const customerId = paymentIntent.customer;
      const user = await getUserByStripeCustomerId(customerId);
      // ... (fetch order/service details if needed via metadata)

      if (user) {
        const locale = user.locale || 'en-US';
        await novu.subscribers.setAttributes(user.clerkId, { locale: locale });
        await createUserNotification({
          userId: user.clerkId,
          type: 'PAYMENT_FAILED_CUSTOMER',
          title: 'Payment Failed',
          message: `Payment for ${paymentIntent.metadata.serviceName || 'your service'} failed.`,
          payload: {
            userName: user.firstName,
            serviceName: paymentIntent.metadata.serviceName || 'your service',
            amount: `${formatCurrency(paymentIntent.amount / 100, paymentIntent.currency)}`, // Pre-formatted
            failureReason:
              paymentIntent.last_payment_error?.message || 'No specific reason provided.',
            updatePaymentLink: `https://eleva.care/account/payment-methods`, // Example
            contactSupportLink: `https://eleva.care/support`,
          },
        });
      }
    }
    ```

- **Content Proposals (English):**
  - **Subject:** Action Required: Your Eleva.care Payment Failed
  - **Body:**

    ```
    Hi {{payload.userName}},

    Unfortunately, your recent payment of {{payload.amount}} for "{{payload.serviceName}}" could not be processed.
    Reason: {{payload.failureReason}}

    Please update your payment information to complete your purchase or ensure uninterrupted service:
    [Update Payment Method]({{payload.updatePaymentLink}})

    {{#if payload.retryPaymentLink}}You can also try the payment again here: [Retry Payment]({{payload.retryPaymentLink}}){{/if}}

    If you believe this is an error or need assistance, please contact our support team: {{payload.contactSupportLink}}

    Thanks,
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Clearly state the failure and required action.
  - Translate "Action Required", "Payment Failed", "Reason", "Update Payment Method".
- **Primary Channels:** Email, In-App

---

#### 4.3.3. Refund Issued - Customer

- **Workflow Name:** `Refund Processed - Customer`
- **Purpose:** To inform the customer that a refund has been processed.
- **Novu Event ID:** `REFUND_PROCESSED_CUSTOMER`
- **Target Audience:** Customer
- **Key Payload Variables:**
  - `userName`: string
  - `refundAmount`: string (Pre-formatted, e.g., "$50.00 USD")
  - `originalService`: string (Description of the service for which refund was issued)
  - `originalPaymentDate`: string (Optional, pre-formatted)
  - `refundProcessedDate`: string (Pre-formatted)
  - `expectedProcessingTime`: string (e.g., "5-10 business days")
  - `refundId`: string (Stripe Refund ID for reference)
- **Triggering Service/Event (Stripe):**
  - Stripe Webhook: `charge.refunded` (more specifically, the `refund.updated` or `charge.refund.updated` events related to a refund object's success).
- **Data Acquisition Notes:**
  - Data from the Stripe `Refund` object (part of the `charge.refunded` event or fetched via API).
  - `userName`, `originalService`, `locale` from application database via related payment/order.
- **Conceptual Trigger Logic:**
  - ```javascript
    // Stripe Webhook Handler
    // Case: event.type === 'charge.refunded' (or specific refund success event)
    async function handleChargeRefunded(charge) {
      // The charge object contains an array of refunds. Iterate if needed.
      const refund = charge.refunds.data[0]; // Assuming one refund for simplicity
      if (refund && refund.status === 'succeeded') {
        const customerId = charge.customer;
        const user = await getUserByStripeCustomerId(customerId);
        // ... (fetch original service details via charge.payment_intent or metadata)

        if (user) {
          const locale = user.locale || 'en-US';
          await novu.subscribers.setAttributes(user.clerkId, { locale: locale });
          await createUserNotification({
            userId: user.clerkId,
            type: 'REFUND_PROCESSED_CUSTOMER',
            title: 'Refund Processed',
            message: `Refund of ${formatCurrency(refund.amount / 100, refund.currency)} processed.`,
            payload: {
              userName: user.firstName,
              refundAmount: formatCurrency(refund.amount / 100, refund.currency), // Pre-formatted
              originalService: charge.metadata.serviceName || 'your recent purchase',
              refundProcessedDate: formatDate(new Date(refund.created * 1000), locale), // Pre-formatted
              expectedProcessingTime: '5-10 business days', // This could be localized or made more dynamic
              refundId: refund.id,
            },
          });
        }
      }
    }
    ```

- **Content Proposals (English):**
  - **Subject:** Your Eleva.care Refund Has Been Processed
  - **Body:**

    ```
    Hi {{payload.userName}},

    We have processed a refund of {{payload.refundAmount}} for your purchase of "{{payload.originalService}}".
    This was processed on {{payload.refundProcessedDate}}.

    Please allow {{payload.expectedProcessingTime}} for the amount to reflect in your account, depending on your bank or payment provider.
    Refund ID: {{payload.refundId}}

    If you have any questions, please contact support.
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Translate "Refund Processed", "expected processing time", banking terms.
  - `expectedProcessingTime` string needs translation.
- **Primary Channels:** Email

---

#### 4.3.4. Subscription Renewal Reminder - Customer (If applicable)

- **Workflow Name:** `Subscription Renewal Reminder - Customer`
- **Purpose:** To remind customers about an upcoming subscription renewal.
- **Novu Event ID:** `SUBSCRIPTION_RENEWAL_REMINDER_CUSTOMER`
- **Target Audience:** Customer (with active subscription)
- **Key Payload Variables:**
  - `userName`: string
  - `subscriptionName`: string (e.g., "Eleva.care Monthly Plan")
  - `renewalDate`: string (Localized date of renewal)
  - `renewalAmount`: string (Pre-formatted, e.g., "$29.99 USD")
  - `paymentMethodLast4`: string
  - `manageSubscriptionLink`: string
  - `cancellationDeadline`: string (optional, localized date/time)
- **Triggering Service/Event (Stripe & QStash):**
  - Stripe Webhook: `invoice.upcoming` (Stripe sends this typically 7 days before renewal).
  - OR QStash Scheduled Job: A job that queries application database for subscriptions nearing renewal (e.g., X days before `subscriptionCurrentPeriodEnd`).
- **Data Acquisition Notes:**
  - Data from Stripe `Invoice` object (if using webhook) or application's `UserTable` (which stores subscription details synced from Stripe).
  - `locale` from Novu subscriber profile.
- **Conceptual Trigger Logic (using Stripe `invoice.upcoming` webhook):**
  - ```javascript
    // Stripe Webhook Handler
    // Case: event.type === 'invoice.upcoming'
    async function handleInvoiceUpcoming(invoice) {
      const customerId = invoice.customer;
      const user = await getUserByStripeCustomerId(customerId);

      if (user && user.subscriptionStatus === 'active') {
        // Ensure user is still active
        const locale = user.locale || 'en-US';
        await novu.subscribers.setAttributes(user.clerkId, { locale: locale });
        await createUserNotification({
          userId: user.clerkId,
          type: 'SUBSCRIPTION_RENEWAL_REMINDER_CUSTOMER',
          title: 'Upcoming Subscription Renewal',
          message: `Your ${invoice.lines.data[0]?.plan.nickname || 'Eleva.care subscription'} renews soon.`,
          payload: {
            userName: user.firstName,
            subscriptionName: invoice.lines.data[0]?.plan.nickname || 'Eleva.care Subscription',
            renewalDate: formatDate(new Date(invoice.period_end * 1000), locale), // Pre-formatted
            renewalAmount: formatCurrency(invoice.total / 100, invoice.currency), // Pre-formatted
            paymentMethodLast4: user.stripeBankAccountLast4 || 'your card on file', // Fetch/store this
            manageSubscriptionLink: `https://eleva.care/account/billing`, // Example
          },
        });
      }
    }
    ```

- **Content Proposals (English):**
  - **Subject:** Your Eleva.care Subscription Renews Soon
  - **Body:**

    ```
    Hi {{payload.userName}},

    This is a reminder that your {{payload.subscriptionName}} subscription is scheduled to renew on {{payload.renewalDate}} for {{payload.renewalAmount}}.
    We will attempt to charge your payment method ({{payload.paymentMethodLast4}}) on file.

    To manage your subscription or update your payment details, please visit:
    {{payload.manageSubscriptionLink}}

    {{#if payload.cancellationDeadline}}If you wish to make changes, please do so before {{payload.cancellationDeadline}}.{{/if}}

    Thanks for being with Eleva.care!
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Translate "Subscription Renews Soon", "renewal date", "manage your subscription".
  - Terms like "card on file" need careful localization. `cancellationDeadline` also needs localization if used.
- **Primary Channels:** Email

---

#### 4.3.5. Payout Processed - Expert

- **Workflow Name:** `Payout Processed - Expert`
- **Purpose:** To inform experts that their earnings payout has been processed.
- **Novu Event ID:** `PAYOUT_PROCESSED_EXPERT` (Can differentiate `PAYOUT_INITIATED_EXPERT` vs `PAYOUT_SUCCESSFUL_EXPERT` if Stripe provides distinct events and different content is needed)
- **Target Audience:** Expert
- **Key Payload Variables:**
  - `expertName`: string
  - `payoutAmount`: string (Pre-formatted, e.g., "€250.75 EUR")
  - `payoutDate`: string (Localized date payout was sent/expected)
  - `bankAccountLast4`: string (Optional, e.g., "ending in 1234")
  - `stripePayoutId`: string (Stripe Payout ID for reference)
  - `payoutDetailsLink`: string (Optional, link to platform's payout history or Stripe Express dashboard)
- **Triggering Service/Event (Stripe):**
  - Stripe Webhook: `payout.paid` (when funds are actually sent).
  - Could also be `payout.created` or `payout.updated` if you want to notify about initiation.
- **Data Acquisition Notes:**
  - Data primarily from the Stripe `Payout` object in the webhook.
  - `expertName`, `locale` from application database using the `stripe_connect_account_id` often linked in payout metadata or by cross-referencing.
- **Conceptual Trigger Logic:**
  - ```javascript
    // Stripe Webhook Handler
    // Case: event.type === 'payout.paid'
    async function handlePayoutPaid(payout) {
      const connectAccountId = payout.destination; // This might vary based on payout object structure, ensure it's the Stripe Connect Account ID
      const expert = await getExpertByConnectAccountId(connectAccountId);

      if (expert) {
        const locale = expert.locale || 'en-US';
        await novu.subscribers.setAttributes(expert.clerkId, { locale: locale });
        await createUserNotification({
          userId: expert.clerkId,
          type: 'PAYOUT_PROCESSED_EXPERT', // Or PAYOUT_SUCCESSFUL_EXPERT
          title: 'Your Payout Has Been Processed',
          message: `Payout of ${formatCurrency(payout.amount / 100, payout.currency)} sent.`,
          payload: {
            expertName: expert.firstName,
            payoutAmount: formatCurrency(payout.amount / 100, payout.currency), // Pre-formatted
            payoutDate: formatDate(new Date(payout.arrival_date * 1000), locale), // Pre-formatted (arrival_date is when it's expected)
            bankAccountLast4: expert.stripeBankAccountLast4 || '', // If stored
            stripePayoutId: payout.id,
            payoutDetailsLink: `https://eleva.care/expert/payouts`, // Example
          },
        });
      }
    }
    ```

- **Content Proposals (English):**
  - **Subject:** Your Eleva.care Payout of {{payload.payoutAmount}} Has Been Processed!
  - **Body:**

    ```
    Hi {{payload.expertName}},

    Good news! Your Eleva.care payout of {{payload.payoutAmount}} was processed and is expected by {{payload.payoutDate}}.
    The funds should arrive in your bank account ({{#if payload.bankAccountLast4}}ending in {{payload.bankAccountLast4}}{{/if}}) shortly, if not already.

    Stripe Payout ID: {{payload.stripePayoutId}}
    {{#if payload.payoutDetailsLink}}You can view your payout history here: {{payload.payoutDetailsLink}}{{/if}}

    Thank you for your contributions to Eleva.care!
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Translate "Payout Processed", financial terms, "bank account ending in".
- **Primary Channels:** Email

---

### 4.4. Expert & Platform Specific Notifications

This subsection covers notifications related to the expert lifecycle (application, onboarding, status changes) and platform-wide announcements or alerts that may target specific user groups or all users.

---

#### 4.4.1. Expert Application Received

- **Workflow Name:** `Expert Application Received - Confirmation`
- **Purpose:** To confirm to the applicant that their expert application has been successfully received and is pending review.
- **Novu Event ID:** `EXPERT_APPLICATION_RECEIVED`
- **Target Audience:** Aspiring Expert (User who submitted an application)
- **Key Payload Variables:**
  - `applicantName`: string (Applicant's first name)
  - `applicationId`: string (Internal ID for their application)
  - `expectedReviewTimeframe`: string (e.g., "5-7 business days", "within 2 weeks")
  - `supportContact`: string (Email or link for application queries)
- **Triggering Service/Event:**
  - Application Logic: After an applicant successfully submits their expert application form, and the data is saved to the **Neon.tech PostgreSQL** database.
- **Data Acquisition Notes:**
  - `applicantName`, `applicationId` from the application submission data.
  - `expectedReviewTimeframe` can be a configurable system setting (localize this string if backend sends it).
  - Applicant's `locale` from their user profile (if they are already a basic user) or from the application form.
- **Conceptual Trigger Logic:**
  - ```javascript
    // After successful expert application form submission and DB save:
    async function confirmExpertApplication(applicationData, userProfile) {
      const locale = userProfile.locale || 'en-US';
      // Ensure Novu subscriber exists and has locale attribute
      await novu.subscribers.identify(userProfile.clerkId, {
        firstName: userProfile.firstName,
        email: userProfile.email,
        locale: locale,
      });

      await createUserNotification({
        userId: userProfile.clerkId, // Novu subscriberId
        type: 'EXPERT_APPLICATION_RECEIVED',
        title: 'Expert Application Received',
        message: `Confirmation for application ID ${applicationData.id}.`,
        payload: {
          applicantName: userProfile.firstName,
          applicationId: applicationData.id,
          expectedReviewTimeframe: '5-7 business days', // Example, should be localized if dynamic from backend
          supportContact: 'experts@eleva.care', // Example
        },
      });
    }
    ```

- **Content Proposals (English):**
  - **Subject:** We've Received Your Eleva.care Expert Application!
  - **Body:**

    ```
    Hi {{payload.applicantName}},

    Thank you for applying to become an expert on the Eleva.care platform!
    We have successfully received your application (ID: {{payload.applicationId}}).

    Our team will review your submission, and we aim to get back to you within {{payload.expectedReviewTimeframe}}.
    If you have any urgent questions in the meantime, please contact us at {{payload.supportContact}}.

    We appreciate your interest in joining Eleva.care!

    Sincerely,
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Translate "Expert Application Received", "review timeframe", contact details.
  - `expectedReviewTimeframe` string needs careful localization.
- **Primary Channels:** Email

---

#### 4.4.2. Expert Application Approved

- **Workflow Name:** `Expert Application Approved`
- **Purpose:** To inform the applicant that their expert application has been approved and outline next steps.
- **Novu Event ID:** `EXPERT_APPLICATION_APPROVED`
- **Target Audience:** Approved Expert
- **Key Payload Variables:**
  - `expertName`: string
  - `dashboardLink`: string (Link to their new expert dashboard)
  - `onboardingGuideLink`: string (Optional: Link to a guide for setting up profile, availability, payments)
  - `stripeConnectSetupLink`: string (Direct link to start Stripe Connect onboarding)
- **Triggering Service/Event:**
  - Application Logic: After an admin reviews and approves an expert application in the backend system (status updated in **Neon.tech PostgreSQL**).
- **Data Acquisition Notes:**
  - `expertName` from user profile.
  - Links are application-specific.
  - Expert's `locale` from their Novu subscriber profile.
- **Conceptual Trigger Logic:**
  - ```javascript
    // After admin approves expert application in the backend:
    async function notifyExpertOfApproval(expertUser) {
      const locale = expertUser.locale || 'en-US';
      // Subscriber profile should already exist with locale
      // await novu.subscribers.setAttributes(expertUser.clerkId, { locale: locale }); // Optionally re-ensure

      await createUserNotification({
        userId: expertUser.clerkId,
        type: 'EXPERT_APPLICATION_APPROVED',
        title: 'Congratulations! Your Expert Application is Approved',
        message: `Welcome aboard, ${expertUser.firstName}!`,
        payload: {
          expertName: expertUser.firstName,
          dashboardLink: 'https://eleva.care/expert/dashboard', // Example
          onboardingGuideLink: 'https://eleva.care/help/expert-onboarding', // Example
          stripeConnectSetupLink: `https://eleva.care/expert/stripe-connect`, // Example
        },
      });
    }
    ```

- **Content Proposals (English):**
  - **Subject:** Congratulations! Your Eleva.care Expert Application is Approved!
  - **Body:**

    ```
    Hi {{payload.expertName}},

    We are thrilled to inform you that your application to become an expert on Eleva.care has been approved! Welcome to the team!

    Here are your next steps to get started:
    1. Access your Expert Dashboard: {{payload.dashboardLink}}
    2. Set up your payout information via Stripe: {{payload.stripeConnectSetupLink}}
    3. Complete your public profile and set your availability.

    {{#if payload.onboardingGuideLink}}For a detailed guide on getting set up, please visit: {{payload.onboardingGuideLink}}{{/if}}

    We're excited to have you join our mission!

    Best regards,
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Celebratory tone. Clearly list next steps.
  - Translate "Congratulations", "Application Approved", "Next Steps", "Payout Information".
- **Primary Channels:** Email, In-App

---

#### 4.4.3. Expert Profile Under Review / Action Required

- **Workflow Name:** `Expert Profile Update - Review/Action`
- **Purpose:** To inform an expert if their submitted profile (or updates) are under review, or if further action is required for approval. This can also be used for `VERIFICATION_HELP` if the context aligns.
- **Novu Event ID:** `EXPERT_PROFILE_ACTION_REQUIRED` (or reuse `VERIFICATION_HELP`)
- **Target Audience:** Expert
- **Key Payload Variables:**
  - `expertName`: string
  - `statusMessage`: string (e.g., "Your profile is currently under review.", "We need a bit more information for your profile.")
  - `specificFeedback` (optional): string (Details on what needs to be changed or provided)
  - `profileEditLink`: string
  - `supportContactLink`: string
- **Triggering Service/Event:**
  - Application Logic: After an admin reviews a profile and flags it for review or requires changes (status updated in **Neon.tech PostgreSQL**).
  - Could also be triggered by automated checks (e.g., missing critical profile fields).
- **Data Acquisition Notes:**
  - `statusMessage` and `specificFeedback` often come from admin input or system rules (these strings need localization if they are not free-form admin text, or use keys for localization).
  - Expert's `locale`.
- **Conceptual Trigger Logic:**
  - ```javascript
    // After admin flags an expert's profile for requiring changes:
    async function notifyExpertProfileActionNeeded(expertUser, feedback) {
      const locale = expertUser.locale || 'en-US';
      await createUserNotification({
        userId: expertUser.clerkId,
        type: 'EXPERT_PROFILE_ACTION_REQUIRED',
        title: 'Action Required on Your Eleva.care Profile',
        message: feedback.statusMessage, // This should be a key or localized string if possible
        payload: {
          expertName: expertUser.firstName,
          statusMessage: localize(feedback.statusMessageKey, locale), // Example of localizing a status key
          specificFeedback: localize(feedback.detailsKey, locale, feedback.params), // Example
          profileEditLink: `https://eleva.care/expert/profile/edit`, // Example
          supportContactLink: `https://eleva.care/support`,
        },
      });
    }
    ```
- **Content Proposals (English):**
  - **Subject:** Update Regarding Your Eleva.care Expert Profile
  - **Body:**

    ```
    Hi {{payload.expertName}},

    This email is regarding your Eleva.care expert profile.
    Status: {{payload.statusMessage}}

    {{#if payload.specificFeedback}}Details: {{payload.specificFeedback}}{{/if}}

    Please review and update your profile here: {{payload.profileEditLink}}

    If you have any questions or need assistance, please contact our support team: {{payload.supportContactLink}}

    Thanks,
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Clear, actionable instructions. `statusMessage` and `specificFeedback` require careful localization (ideally by passing localized strings or using keys).
  - Translate "Update Regarding", "Status", "Details", "Review and update".
- **Primary Channels:** Email, In-App

---

#### 4.4.4. Payout Account Setup Reminder (Expert)

- **Workflow Name:** `Payout Account Setup Reminder - Expert`
- **Purpose:** To remind experts who have been approved but haven't yet set up their Stripe Connect account for payouts.
- **Novu Event ID:** `EXPERT_PAYOUT_SETUP_REMINDER`
- **Target Audience:** Approved Expert (who hasn't completed Stripe Connect onboarding)
- **Key Payload Variables:**
  - `expertName`: string
  - `stripeConnectSetupLink`: string
  - `deadlineText` (optional): string (e.g., "Please complete this within 7 days to ensure timely payouts.")
  - `supportContactLink`: string
- **Triggering Service/Event:**
  - Scheduled Job (QStash) or Application Logic:
    - QStash job runs periodically, checks **Neon.tech PostgreSQL** for approved experts with `stripeConnectOnboardingComplete == false` (or similar flag).
    - Could also be triggered after a certain time post-approval if not completed.
- **Data Acquisition Notes:**
  - Expert's status from `UserTable` in Neon.tech PostgreSQL.
  - Expert's `locale`.
- **Conceptual Trigger Logic:**
  - ```javascript
    // QStash job or periodic task:
    async function sendPayoutSetupReminders() {
      const expertsNeedingReminder = await getExpertsWithoutPayoutSetupFromDB();
      for (const expert of expertsNeedingReminder) {
        const locale = expert.locale || 'en-US';
        await novu.subscribers.setAttributes(expert.clerkId, { locale: locale });
        await createUserNotification({
          userId: expert.clerkId,
          type: 'EXPERT_PAYOUT_SETUP_REMINDER',
          title: 'Reminder: Set Up Your Payout Account',
          message: 'Complete your Stripe Connect setup to receive payments.',
          payload: {
            expertName: expert.firstName,
            stripeConnectSetupLink: `https://eleva.care/expert/stripe-connect`, // Example
            // deadlineText should be localized in the backend if dynamic
            deadlineText: getLocalizedText('payout_reminder_deadline', locale),
            supportContactLink: `https://eleva.care/support`,
          },
        });
      }
    }
    ```
- **Content Proposals (English):**
  - **Subject:** Reminder: Complete Your Eleva.care Payout Account Setup
  - **Body:**

    ```
    Hi {{payload.expertName}},

    This is a friendly reminder to set up your payout account on Eleva.care. This is required to receive payments for your sessions.
    Please complete your Stripe Connect onboarding here:
    {{payload.stripeConnectSetupLink}}

    {{#if payload.deadlineText}}{{payload.deadlineText}}{{/if}}

    If you've already done this or need help, please contact our support team: {{payload.supportContactLink}}.

    Thanks,
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Emphasize importance for receiving payments. `deadlineText` needs localization.
  - Translate "Payout Account Setup", "Reminder", "Stripe Connect onboarding".
- **Primary Channels:** Email, In-App

---

#### 4.4.5. New Feature Announcement / Platform Update

- **Workflow Name:** `Platform Update - General`
- **Purpose:** To inform users about new features, significant platform updates, or important general announcements.
- **Novu Event ID:** `PLATFORM_UPDATE_ANNOUNCEMENT` (or more specific like `NEW_FEATURE_ANNOUNCEMENT_XYZ`)
- **Target Audience:** All Users, Customers, Experts (can be segmented)
- **Key Payload Variables:**
  - `title`: string (The main title of the announcement - should be localized in payload)
  - `messageBody`: string (The main content of the announcement, can include markdown/HTML - should be localized in payload)
  - `featureName` (optional): string (Localized in payload if part of a sentence)
  - `learnMoreLink` (optional): string (URL, can be locale-specific if pointing to localized docs)
  - `callToActionText` (optional): string (e.g., "Try it now!" - localized in payload)
  - `callToActionLink` (optional): string
- **Triggering Service/Event:**
  - Manual Trigger: Often initiated by an admin from an internal admin panel or script, selecting the target audience and pre-translated content blocks.
- **Data Acquisition Notes:**
  - Content (`title`, `messageBody`, links) is typically drafted by marketing/product teams and **translated before being sent in the payload for each locale group.**
  - Recipient's `locale` is used to select the correct pre-translated content block to send to Novu, or Novu's own advanced localization features could be used if content is uploaded there. For this model, we assume pre-translated content is passed in the payload.
- **Conceptual Trigger Logic:**
  - ```javascript
    // Admin panel action or script:
    async function sendPlatformUpdate(targetAudienceFilter, languageSpecificContent) {
      // languageSpecificContent is an object like:
      // { 'en-US': { title: "Hello", body: "<p>News...</p>" }, 'es-ES': { title: "Hola", ... } }
      const usersToNotify = await getUsersForAnnouncement(targetAudienceFilter);

      for (const user of usersToNotify) {
        const userLocale = user.locale || 'en-US'; // Fallback locale
        const contentForLocale =
          languageSpecificContent[userLocale] || languageSpecificContent['en-US']; // Fallback content

        await novu.subscribers.setAttributes(user.clerkId, {
          firstName: user.firstName,
          email: user.email,
          locale: userLocale,
        });
        await createUserNotification({
          userId: user.clerkId,
          type: 'PLATFORM_UPDATE_ANNOUNCEMENT',
          title: contentForLocale.title, // Already localized
          message: contentForLocale.summary, // Short summary for Novu log, already localized
          payload: {
            // Pass the fully localized content block
            title: contentForLocale.title,
            messageBody: contentForLocale.body, // HTML/Markdown
            // featureName: contentForLocale.featureName, // If applicable
            learnMoreLink: contentForLocale.learnMoreLink,
            callToActionText: contentForLocale.ctaText,
            callToActionLink: contentForLocale.ctaLink,
            // userName: user.firstName // If greeting is {{payload.userName}} rather than {{subscriber.firstName}}
          },
        });
      }
    }
    ```

- **Content Proposals (English - template structure, actual content comes from payload):**
  - **Subject:** {{payload.title}}
  - **Body:**

    ```
    Hi {{subscriber.firstName | default: "Eleva.care User"}},

    {{payload.messageBody}} {{!-- This is the pre-translated HTML/Markdown content --}}

    {{#if payload.learnMoreLink}}Learn more here: {{payload.learnMoreLink}}{{/if}}

    {{#if payload.callToActionLink}}
    [{{payload.callToActionText | default: "Check it out"}}]({{payload.callToActionLink}})
    {{/if}}

    Thanks for being part of the Eleva.care community!
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - **Crucial:** The `title` and `messageBody` in the payload _must be pre-translated_ by the backend/admin tool before being sent to Novu for this event type. The Novu template itself would have minimal Liquid for language switching, mostly just rendering these pre-translated payload fields.
  - The generic salutation `Hi {{subscriber.firstName | default: "Eleva.care User"}}` and the sign-off would still use the standard Liquid localization based on `subscriber.locale`.
- **Primary Channels:** Email, In-App

---

#### 4.4.6. General Security Alert (Platform Wide)

- **Workflow Name:** `Platform Security Alert - General`
- **Purpose:** To inform users about a platform-wide security event or a vulnerability they should be aware of (distinct from individual account security alerts).
- **Novu Event ID:** `SYSTEM_SECURITY_ALERT` (could refine existing `SECURITY_ALERT`)
- **Target Audience:** All Users, or specific affected groups
- **Key Payload Variables:**
  - `alertTitle`: string (Localized in payload)
  - `alertDetails`: string (Localized in payload)
  - `recommendedActions`: string (Localized in payload, potentially with markdown for list formatting)
  - `faqLink` (optional): string
  - `severity`: string (e.g., "High", "Medium", "Low")
- **Triggering Service/Event:**
  - Manual Trigger: Initiated by admin/security team in response to an incident or threat.
- **Data Acquisition Notes:**
  - Content prepared by the security/admin team and **pre-translated** before sending to Novu, similar to Platform Updates.
- **Conceptual Trigger Logic:**
  - Similar to "Platform Update Announcement," triggered by an admin tool, with pre-translated content blocks per locale passed in the payload.
- **Content Proposals (English - template structure, actual content from payload):**
  - **Subject:** Important Security Notification from Eleva.care: {{payload.alertTitle}}
  - **Body:**

    ```
    Dear {{subscriber.firstName | default: "Eleva.care User"}},
    (Salutation to be localized in template based on subscriber.locale)

    This is an important security notification regarding {{payload.alertTitle}}.

    {{payload.alertDetails}}

    **Recommended Actions:**
    {{payload.recommendedActions}} {{!-- This could be markdown rendered by Novu --}}

    {{#if payload.faqLink}}For more information, please visit: {{payload.faqLink}}{{/if}}

    We take your security seriously and are committed to protecting your data.
    If you have any concerns, please contact our support team.

    Sincerely,
    The Eleva.care Security Team
    ```

- **Multilingual Content Notes:**
  - Critical information requires precise and clear pre-translation for `alertTitle`, `alertDetails`, `recommendedActions`.
  - The generic parts of the template (greeting, sign-off) use standard Liquid localization.
- **Primary Channels:** Email (High Priority), In-App (High Priority)

---

#### 4.4.7. Terms of Service Update

- **Workflow Name:** `Terms of Service Update Notification`
- **Purpose:** To inform users about changes to the Terms of Service or Privacy Policy.
- **Novu Event ID:** `LEGAL_UPDATE_NOTIFICATION`
- **Target Audience:** All Users (or as required by legal)
- **Key Payload Variables:**
  - `documentName`: string (Localized in payload, e.g., "Terms of Service", "Política de Privacidade")
  - `summaryOfChanges`: string (Localized in payload)
  - `effectiveDate`: string (Localized date in payload)
  - `fullDocumentLink`: string (Link to the fully translated document for that locale)
  - `actionRequiredText` (optional): string (Localized in payload, e.g., "By continuing to use our service...")
- **Triggering Service/Event:**
  - Manual Trigger: By legal/admin team.
- **Data Acquisition Notes:**
  - Content prepared by the legal team and **pre-translated** for each supported locale before sending to Novu. Each user receives the notification with payload fields already in their language.
- **Conceptual Trigger Logic:**
  - Similar to "Platform Update Announcement," with pre-translated content blocks per locale passed in the payload.
- **Content Proposals (English - template structure, actual content from payload):**
  - **Subject:** Important Update to Our {{payload.documentName}}
  - **Body:**

    ```
    Dear {{subscriber.firstName | default: "Eleva.care User"}},
    (Salutation to be localized in template based on subscriber.locale)

    We are writing to inform you about an important update to our {{payload.documentName}}. These changes will take effect on {{payload.effectiveDate}}.

    **Summary of Key Changes:**
    {{payload.summaryOfChanges}}

    We encourage you to review the full updated document here: {{payload.fullDocumentLink}}

    {{#if payload.actionRequiredText}}{{payload.actionRequiredText}}{{else}}Your continued use of Eleva.care after {{payload.effectiveDate}} constitutes your acceptance of these updated terms.{{/if}}
    (The 'else' part above should also be part of the pre-translated `actionRequiredText` or a separate localized payload variable for more control)

    If you have any questions, please contact our support team.

    Thank you,
    The Eleva.care Team
    ```

- **Multilingual Content Notes:**
  - Legal documents require very accurate pre-translation. The notification payload should carry the fully translated `documentName`, `summaryOfChanges`, `effectiveDate`, and `actionRequiredText`.
  - The `fullDocumentLink` must point to the correctly localized version of the legal document.
- **Primary Channels:** Email, In-App (potentially with a modal for acknowledgment)

---

## 5. Multilingual Content Strategy - Detailed

This section outlines our strategy for managing and implementing multilingual notification content using Novu.co.

### 5.1. Recap of `subscriber.locale` and Liquid Templating

The foundation of our multilingual strategy in Novu relies on two key elements:

- **`subscriber.locale`**:
  - Each subscriber (user) profile in Novu should have a `locale` attribute accurately set (e.g., `en-US`, `pt-PT`, `pt-BR`, `es-ES`).
  - This `locale` is the primary indicator of the user's preferred language and region. It is typically set during user signup or through user profile settings in Eleva.care and then synced to the Novu subscriber profile (see Section 2.3. Subscriber Management).
- **Liquid Templating Engine**:
  - Novu's template editor supports the Liquid templating language.
  - We use Liquid's conditional logic (`if/elsif/else`, `case`) to render different text strings and content blocks within a single template based on the value of `subscriber.locale` or a derived language code (e.g., `{% assign lang_code = subscriber.locale | slice: 0, 2 %}`).

This approach allows us to manage multiple language versions of a notification within one Novu template per channel for most transactional notifications. For announcements or legal updates, pre-translated content blocks are often passed in the payload.

### 5.2. Translation Management Approach

- **Hybrid Approach:**
  1.  **Transactional Notifications (e.g., confirmations, reminders):** Translations are primarily managed _within Novu templates_ using Liquid conditionals based on `subscriber.locale`. This is suitable for notifications with relatively static structures where only specific phrases or sentences change per language.
  2.  **Content-Heavy Notifications (e.g., announcements, legal updates):** For notifications where the entire body of text is unique per language (like platform updates or Terms of Service changes), the translated content blocks (e.g., HTML or Markdown for email bodies) are prepared _outside of Novu_ (e.g., by a translation team using dedicated software or a CMS). The Eleva.care backend then selects the appropriate pre-translated content block based on the user's locale and passes it in the `payload` to Novu. The Novu template for these events is simpler, primarily acting as a wrapper to render the pre-translated payload content along with common headers/footers (which themselves can still use Liquid for minor localization like greetings).
- **Structure within Templates (for Liquid-based approach):**
  - For each piece of text that needs translation, a Liquid conditional block will be used.
  - A default fallback language (typically English, `en-US`) must always be included.
- **Best Practices for Organizing Translated Content:**
  1.  **Clear Language Blocks:** Use comments in Liquid (`{% comment %} ... {% endcomment %}`) to clearly delineate language sections.
  2.  **Consistent Variable Naming:** Use the same payload variable names across all language versions.
  3.  **Review by Native Speakers:** All translated content, whether in templates or as pre-translated blocks, must be reviewed by native speakers.
  4.  **Centralized Translation Repository (for pre-translated blocks):** If managing pre-translated blocks outside Novu, maintain them in a structured way (e.g., resource files, CMS) that the backend can easily access.

### 5.3. Date, Time, and Number Formatting

Dynamic data such as dates, times, and numbers requires careful handling for locale-specific display.

- **Challenges:** Different global formats for dates (`MM/DD/YYYY` vs. `DD/MM/YYYY`), times (12/24hr), and numeric/currency separators (`,` vs. `.`). Timezones are also critical.
- **Novu's Liquid `date` Filter Limitations:** Standard Liquid date filters are not fully locale-aware for all regional conventions (e.g., named months in different languages, complex date styles).
- **Recommended Strategy:**
  - **Pre-format Strings in Backend (Strongly Preferred):** The Eleva.care backend should format dates, times, and currency amounts into localized strings _before_ sending them in the payload to Novu. The backend can use robust internationalization libraries (e.g., `date-fns-tz`, `Intl.DateTimeFormat`, `Intl.NumberFormat`) leveraging the user's `locale`.
    - Example Payload with pre-formatted data:
      ```json
      {
        "userName": "Maria",
        "appointmentDate": "28 de Julho de 2024", // Pre-formatted for pt-BR
        "appointmentTime": "14:00 (Horário de Brasília)", // Pre-formatted
        "amountPaid": "R$ 50,00" // Pre-formatted
      }
      ```
  - **Timezones:** All date/time data passed to Novu should either be in UTC and accompanied by the target timezone for Novu to potentially handle (if it has robust timezone features), or already converted to the user's local time in the pre-formatted string. The latter (pre-formatted string with timezone indicated, like "14:00 PST") is often safer.

### 5.4. Specific Workflow Examples with Full Multilingual Content

Below are three key notification examples, demonstrating the payload, multilingual content (managed within Novu templates using Liquid), and an illustrative Liquid snippet for the Email body channel. These assume `subscriber.locale` is populated and that dynamic data like dates and amounts in the payload are pre-formatted for the target locale by the backend.

---

#### Example 1: Appointment Booking Confirmation (Customer)

- **Event Name/ID:** `APPOINTMENT_BOOKING_CONFIRMATION_CUSTOMER`
- **Payload:**
  - `userName`: string
  - `expertName`: string
  - `appointmentDate`: string (Pre-formatted for locale)
  - `appointmentTime`: string (Pre-formatted for locale, including timezone)
  - `appointmentType`: string
  - `meetingLink`: string
  - `addToCalendarLink_Google`: string
  - `addToCalendarLink_Outlook`: string
  - `appointmentDetailsLink`: string

- **Content Proposals:**
  - **en-US (English - US)**
    - **Subject:** Your Eleva.care Appointment with {{payload.expertName}} is Confirmed!
    - **Body:**

      ```
      Hi {{payload.userName}},

      Your {{payload.appointmentType}} with {{payload.expertName}} is confirmed!

      Date: {{payload.appointmentDate}}
      Time: {{payload.appointmentTime}}
      Join your meeting: {{payload.meetingLink}}

      Add to your calendar:
      [Google Calendar]({{payload.addToCalendarLink_Google}}) | [Outlook Calendar]({{payload.addToCalendarLink_Outlook}})

      View full appointment details here: {{payload.appointmentDetailsLink}}

      We look forward to seeing you!
      The Eleva.care Team
      ```

  - **pt-PT (Portuguese - Portugal)**
    - **Subject:** A sua consulta na Eleva.care com {{payload.expertName}} está Confirmada!
    - **Body:**

      ```
      Olá, {{payload.userName}},

      A sua {{payload.appointmentType}} com {{payload.expertName}} está confirmada!

      Data: {{payload.appointmentDate}}
      Hora: {{payload.appointmentTime}}
      Aceda à sua consulta: {{payload.meetingLink}}

      Adicionar ao seu calendário:
      [Google Calendar]({{payload.addToCalendarLink_Google}}) | [Outlook Calendar]({{payload.addToCalendarLink_Outlook}})

      Veja todos os detalhes da consulta aqui: {{payload.appointmentDetailsLink}}

      Esperamos por si!
      A Equipa Eleva.care
      ```

  - **pt-BR (Portuguese - Brazil)**
    - **Subject:** Sua consulta na Eleva.care com {{payload.expertName}} está Confirmada!
    - **Body:**

      ```
      Olá, {{payload.userName}},

      Sua {{payload.appointmentType}} com {{payload.expertName}} está confirmada!

      Data: {{payload.appointmentDate}}
      Horário: {{payload.appointmentTime}}
      Acesse sua consulta: {{payload.meetingLink}}

      Adicionar ao seu calendário:
      [Google Calendar]({{payload.addToCalendarLink_Google}}) | [Outlook Calendar]({{payload.addToCalendarLink_Outlook}})

      Veja todos os detalhes da consulta aqui: {{payload.appointmentDetailsLink}}

      Estamos ansiosos para vê-lo(a)!
      A Equipe Eleva.care
      ```

  - **es-ES (Spanish - Spain)**
    - **Subject:** ¡Tu cita en Eleva.care con {{payload.expertName}} está Confirmada!
    - **Body:**

      ```
      Hola, {{payload.userName}},

      ¡Tu {{payload.appointmentType}} con {{payload.expertName}} está confirmada!

      Fecha: {{payload.appointmentDate}}
      Hora: {{payload.appointmentTime}}
      Accede a tu cita: {{payload.meetingLink}}

      Añadir a tu calendario:
      [Google Calendar]({{payload.addToCalendarLink_Google}}) | [Outlook Calendar]({{payload.addToCalendarLink_Outlook}})

      Consulta todos los detalles de la cita aquí: {{payload.appointmentDetailsLink}}

      ¡Te esperamos!
      El equipo de Eleva.care
      ```

- **Novu Liquid Template Snippet (Email Body):**

  ```liquid
  {% assign lang_code = subscriber.locale | slice: 0, 2 %}
  {% assign full_locale = subscriber.locale %}

  {% if lang_code == 'pt' and full_locale == 'pt-BR' %}
  Olá, {{payload.userName | default: "Prezado Usuário"}},

  Sua {{payload.appointmentType}} com {{payload.expertName}} está confirmada!

  Data: {{payload.appointmentDate}}
  Horário: {{payload.appointmentTime}}
  Acesse sua consulta: {{payload.meetingLink}}

  Adicionar ao seu calendário:
  [Google Calendar]({{payload.addToCalendarLink_Google}}) | [Outlook Calendar]({{payload.addToCalendarLink_Outlook}})

  Veja todos os detalhes da consulta aqui: {{payload.appointmentDetailsLink}}

  Estamos ansiosos para vê-lo(a)!

  Obrigado,
  A Equipe Eleva.care
  {% elsif lang_code == 'pt' %}
  Olá, {{payload.userName | default: "Estimado Utilizador"}},

  A sua {{payload.appointmentType}} com {{payload.expertName}} está confirmada!

  Data: {{payload.appointmentDate}}
  Hora: {{payload.appointmentTime}}
  Aceda à sua consulta: {{payload.meetingLink}}

  Adicionar ao seu calendário:
  [Google Calendar]({{payload.addToCalendarLink_Google}}) | [Outlook Calendar]({{payload.addToCalendarLink_Outlook}})

  Veja todos os detalhes da consulta aqui: {{payload.appointmentDetailsLink}}

  Esperamos por si!

  Obrigado,
  A Equipa Eleva.care
  {% elsif lang_code == 'es' %}
  Hola, {{payload.userName | default: "Estimado Usuario"}},

  ¡Tu {{payload.appointmentType}} con {{payload.expertName}} está confirmada!

  Fecha: {{payload.appointmentDate}}
  Hora: {{payload.appointmentTime}}
  Accede a tu cita: {{payload.meetingLink}}

  Añadir a tu calendario:
  [Google Calendar]({{payload.addToCalendarLink_Google}}) | [Outlook Calendar]({{payload.addToCalendarLink_Outlook}})

  Consulta todos los detalles de la cita aquí: {{payload.appointmentDetailsLink}}

  ¡Te esperamos!

  Gracias,
  El equipo de Eleva.care
  {% else %}
  Hi {{payload.userName | default: "Valued User"}},

  Your {{payload.appointmentType}} with {{payload.expertName}} is confirmed!

  Date: {{payload.appointmentDate}}
  Time: {{payload.appointmentTime}}
  Join your meeting: {{payload.meetingLink}}

  Add to your calendar:
  [Google Calendar]({{payload.addToCalendarLink_Google}}) | [Outlook Calendar]({{payload.addToCalendarLink_Outlook}})

  View full appointment details here: {{payload.appointmentDetailsLink}}

  We look forward to seeing you!

  Thanks,
  The Eleva.care Team
  {% endif %}
  ```

---

#### Example 2: Payment Successful (Customer)

- **Event Name/ID:** `PAYMENT_SUCCESS_CUSTOMER`
- **Payload:**
  - `userName`: string
  - `orderId`: string (or booking ID)
  - `amountPaid`: string (Pre-formatted for locale)
  - `paymentDate`: string (Pre-formatted for locale)
  - `serviceName`: string
  - `receiptLink`: string (optional)

- **Content Proposals:** (Content as previously defined - en-US, pt-PT, pt-BR, es-ES. Omitted for brevity in this final compilation; refer to previous generation where it was detailed.)

- **Novu Liquid Template Snippet (Email Body):**

  ```liquid
  {% assign lang_code = subscriber.locale | slice: 0, 2 %}
  {% assign full_locale = subscriber.locale %}

  {% if lang_code == 'pt' and full_locale == 'pt-BR' %}
  Olá, {{payload.userName | default: "Prezado Usuário"}},

  Confirmamos o seu pagamento de {{payload.amountPaid}} por {{payload.serviceName}} em {{payload.paymentDate}}.
  O ID do seu pedido: {{payload.orderId}}

  {% if payload.receiptLink %}Você pode ver seu recibo completo aqui: [Ver Recibo]({{payload.receiptLink}}){% endif %}

  Obrigado pelo seu pagamento.

  Obrigado,
  A Equipe Eleva.care
  {% elsif lang_code == 'pt' %}
  Olá, {{payload.userName | default: "Estimado Utilizador"}},

  Confirmamos o seu pagamento de {{payload.amountPaid}} por {{payload.serviceName}} em {{payload.paymentDate}}.
  O ID da sua encomenda: {{payload.orderId}}

  {% if payload.receiptLink %}Pode ver o seu recibo completo aqui: [Ver Recibo]({{payload.receiptLink}}){% endif %}

  Obrigado pelo seu pagamento.

  Obrigado,
  A Equipa Eleva.care
  {% elsif lang_code == 'es' %}
  Hola, {{payload.userName | default: "Estimado Usuario"}},

  Confirmamos tu pago de {{payload.amountPaid}} por {{payload.serviceName}} el {{payload.paymentDate}}.
  ID de tu pedido: {{payload.orderId}}

  {% if payload.receiptLink %}Puedes ver tu recibo completo aquí: [Ver Recibo]({{payload.receiptLink}}){% endif %}

  Gracias por tu pago.

  Gracias,
  El equipo de Eleva.care
  {% else %}
  Hi {{payload.userName | default: "Valued User"}},

  This confirms your payment of {{payload.amountPaid}} for {{payload.serviceName}} on {{payload.paymentDate}}.
  Your Order ID: {{payload.orderId}}

  {% if payload.receiptLink %}You can view your full receipt here: [View Receipt]({{payload.receiptLink}}){% endif %}

  Thank you for your payment.

  Thanks,
  The Eleva.care Team
  {% endif %}
  ```

---

#### Example 3: Appointment Reminder (Customer - 24hr)

- **Event Name/ID:** `APPOINTMENT_REMINDER_CUSTOMER` (or `APPOINTMENT_REMINDER_CUSTOMER_24HR`)
- **Payload:**
  - `userName`: string
  - `expertName`: string
  - `appointmentDate`: string (Pre-formatted for locale)
  - `appointmentTime`: string (Pre-formatted for locale, including timezone)
  - `appointmentType`: string
  - `timeUntilAppointment`: string (Localized, e.g., "tomorrow", "amanhã", "mañana")
  - `meetingLink`: string
  - `appointmentDetailsLink`: string

- **Content Proposals:** (As previously defined - en-US, pt-PT, pt-BR, es-ES. Omitted for brevity in this final compilation; refer to previous generation where it was detailed.)

- **Novu Liquid Template Snippet (Email Body):**

  ```liquid
  {% assign lang_code = subscriber.locale | slice: 0, 2 %}
  {% assign full_locale = subscriber.locale %}

  {% if lang_code == 'pt' and full_locale == 'pt-BR' %}
  Olá, {{payload.userName | default: "Prezado Usuário"}},

  Este é um lembrete amigável de que sua consulta de {{payload.appointmentType}} com {{payload.expertName}} é {{payload.timeUntilAppointment}}, no dia {{payload.appointmentDate}} às {{payload.appointmentTime}}.

  Acesse sua consulta: {{payload.meetingLink}}
  Ver detalhes da consulta: {{payload.appointmentDetailsLink}}

  Por favor, certifique-se de que você está em um local tranquilo e com uma conexão de internet estável antes da sua sessão.

  Obrigado,
  A Equipe Eleva.care
  {% elsif lang_code == 'pt' %}
  Olá, {{payload.userName | default: "Estimado Utilizador"}},

  Este é um lembrete amigável de que a sua consulta de {{payload.appointmentType}} com {{payload.expertName}} é {{payload.timeUntilAppointment}}, no dia {{payload.appointmentDate}} às {{payload.appointmentTime}}.

  Aceda à sua consulta: {{payload.meetingLink}}
  Ver detalhes da consulta: {{payload.appointmentDetailsLink}}

  Por favor, certifique-se de que está num local sossegado e com uma ligação estável à internet antes da sua sessão.

  Obrigado,
  A Equipa Eleva.care
  {% elsif lang_code == 'es' %}
  Hola, {{payload.userName | default: "Estimado Usuario"}},

  Este es un recordatorio amistoso de que tu cita de {{payload.appointmentType}} con {{payload.expertName}} es {{payload.timeUntilAppointment}}, el {{payload.appointmentDate}} a las {{payload.appointmentTime}}.

  Accede a tu cita: {{payload.meetingLink}}
  Ver detalles de la cita: {{payload.appointmentDetailsLink}}

  Por favor, asegúrate de estar en un lugar tranquilo con una conexión a internet estable antes de tu sesión.

  Gracias,
  El equipo de Eleva.care
  {% else %}
  Hi {{payload.userName | default: "Valued User"}},

  This is a friendly reminder that your {{payload.appointmentType}} appointment with {{payload.expertName}} is {{payload.timeUntilAppointment}}, on {{payload.appointmentDate}} at {{payload.appointmentTime}}.

  Join your meeting: {{payload.meetingLink}}
  View appointment details: {{payload.appointmentDetailsLink}}

  Please ensure you are in a quiet place with a stable internet connection before your session.

  Thanks,
  The Eleva.care Team
  {% endif %}
  ```

---

## 6. Maintaining and Evolving Notifications

The notification system is not static; it will evolve with the Eleva.care platform. This section provides guidance on adding new notifications, updating existing ones, and basic monitoring and troubleshooting using the Novu.co dashboard.

### 6.1. Tips for Adding New Notifications

As new features are added to Eleva.care or new communication needs arise, new notifications will need to be implemented. Follow this general process:

1.  **Define the Notification Event:**
    - **Purpose:** Clearly articulate why this notification is needed and what user action or information it conveys.
    - **Event Name/ID:** Choose a unique, descriptive Novu Event ID (e.g., `NEW_FEATURE_X_ANNOUNCEMENT`, `EXPERT_SESSION_SUMMARY_AVAILABLE`). Add this to the central "Notification Event List" document.
    - **Target Audience:** Define who should receive this notification (Customers, Experts, specific segments).
    - **Channels:** Decide which channels are appropriate (In-App, Email, SMS, etc.).

2.  **Define the Payload:**
    - List all dynamic data points required for the notification content (e.g., `userName`, `featureLink`, `summaryDetails`).
    - Consider what data is readily available when the event is triggered.

3.  **Draft Content (Multilingual):**
    - Write initial content for all supported languages (en-US, pt-PT, pt-BR, es-ES), including subject lines and body copy with placeholders for payload variables.
    - Follow the multilingual strategy outlined in Section 5.

4.  **Implement Application Trigger Logic:**
    - In the Eleva.care backend, identify where this event originates (e.g., after a specific user action, a new database entry, a scheduled job, a Stripe webhook).
    - Add code to call the `createUserNotification` function (in `lib/notifications.ts`) with the new Novu Event ID and the defined payload.
    - Ensure `subscriberId` (Clerk User ID) and `locale` are correctly passed or set for the subscriber in Novu.

5.  **Configure in Novu.co Dashboard:**
    - Create a new Workflow in Novu using the defined Event Name/ID.
    - Set up the necessary channel steps (Email, In-App, etc.).
    - Implement the templates for each channel, using the drafted multilingual content and payload variables.
    - Test thoroughly using Novu's "Test Trigger" functionality with sample payloads and different subscriber locales.

6.  **Consistency:**
    - Review existing workflows and templates to maintain consistency in tone, branding (e.g., email footers, logos), and common phrasing where applicable.
    - Use shared partials or snippets in Novu if the feature is available and appropriate for common elements like headers/footers.

7.  **Documentation:**
    - Update this guide (`notification_workflows_guide.md`) and any related documentation with details of the new notification workflow.

### 6.2. Best Practices for Updating Existing Notifications

Modifications to existing notifications might be needed for clarity, new branding, or changed functionality.

1.  **Scope the Changes:** Clearly define what needs to be updated (e.g., text changes, adding a new variable, changing a link, altering logic in a template).

2.  **Staging/Development Environment:**
    - **Novu Environments:** If your Novu plan supports multiple environments (e.g., Development, Staging, Production), always make and test changes in a non-production environment first. This prevents accidental impact on live user notifications.
    - **Application Staging:** Test the updated notification by triggering it from your staging Eleva.care application environment that points to your staging Novu environment.

3.  **Template Editing and Testing:**
    - Carefully edit the relevant templates in the Novu dashboard (for the correct environment).
    - Use the "Test Trigger" feature extensively with various payloads and subscriber locales to ensure the changes render correctly and don't introduce errors (e.g., broken Liquid syntax, missing variables).
    - Pay attention to how changes affect different languages.

4.  **Versioning or Duplicating Workflows (Major Changes):**
    - **Novu Versioning:** Check if Novu offers a built-in versioning system for workflows or templates. If so, use it to create a new version before making significant changes. This allows for easier rollback if issues arise.
    - **Manual Duplication:** If direct versioning isn't robust or available for the type of change, consider duplicating the existing workflow. Make changes to the duplicated version, test it thoroughly (perhaps by temporarily pointing a test event trigger to it), and then once satisfied, update your application to trigger the new workflow ID and deprecate/disable the old one. This provides a safe fallback.
    - **Minor Text Changes:** For very minor text edits, direct editing (with careful preview and testing) in the current workflow might be acceptable, especially if done in a staging Novu environment first.

5.  **Communicating Changes to Users:**
    - If the changes significantly alter the information presented, the call to action, or the timing/frequency of a notification, consider whether users need to be informed about this change (e.g., via a platform announcement or a brief note in the updated notification itself if appropriate). This is a product decision.

6.  **Deployment:**
    - Once changes are tested and approved, promote them to your production Novu environment according to your established deployment process. If application code changes were needed (e.g., to send a new payload variable), deploy those changes simultaneously.

### 6.3. Monitoring and Troubleshooting in Novu

The Novu dashboard is the primary tool for monitoring the health and status of your notification system.

1.  **Activity Logs / Feed:**
    - Regularly check the "Logs," "Activity Feed," or equivalent section in your Novu dashboard.
    - This feed provides a real-time or near real-time view of:
      - Events being triggered from your application.
      - Which workflows are being matched.
      - The status of each notification step (e.g., Sent, Delivered, Seen, Read, Failed, Error).
      - Details of the payload and subscriber data for each event.

2.  **Filtering and Searching Logs:**
    - Utilize Novu's log filtering capabilities to search by:
      - Workflow
      - Event Name/ID
      - Subscriber ID
      - Status (e.g., to find all "Failed" notifications)
      - Date range
    - This is invaluable for investigating issues reported by users or proactively identifying problems.

3.  **Identifying Common Issues:**
    - **Incorrect Subscriber ID:** If `novu.trigger()` is called with a `subscriberId` that doesn't exist in Novu or doesn't match the intended recipient, the notification won't reach the user's In-App center (though email/SMS might still send if those details are in the payload and the channel doesn't strictly require a pre-existing Novu subscriber for delivery). Check that the `userId` passed from Eleva.care is correct.
    - **Template Errors:**
      - **Syntax Errors:** Incorrect Liquid syntax in your templates (`{{ }}`, `{% %}`) can cause rendering failures. Novu's test feature should help catch these.
      - **Missing Variables:** Referencing a payload or subscriber variable in a template that wasn't actually sent or isn't available (e.g., `{{payload.missingItem}}`) will result in blank output for that variable or potential errors. Ensure your application sends all necessary data.
    - **Channel Integration Problems:**
      - An email provider integration might be misconfigured (e.g., incorrect API key, domain not verified).
      - SMS provider might have insufficient funds or be blocked.
      - The Novu logs for a specific channel step often provide details from the provider if a delivery attempt failed.
    - **Payload Mismatches:** Sending a payload structure that differs from what the template expects (e.g., a variable name changed in the backend but not updated in the template).
    - **API Key / Application ID Issues:** Ensure the `NOVU_SECRET_KEY` on the backend and `NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER` on the frontend are correct for the target Novu environment.

4.  **Debugging:**
    - When a notification fails, the Novu log entry for that event is the first place to look. It often contains error messages or codes that can pinpoint the issue.
    - Cross-reference with your application logs to see the exact data that was sent to `novu.trigger()`.

By following these maintenance and troubleshooting practices, you can ensure the Eleva.care notification system remains reliable, effective, and adaptable to future needs.

```

---
```
