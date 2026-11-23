# How the Awwwards jury scores

Status: Reference. Checked on 2026-11-23 against pages saved from awwwards.com that day. Every fact has its source URL. Where a page does not say something, this note says so instead of filling the gap.

Sources used:

- Evaluation System: https://www.awwwards.com/about-evaluation/
- Developer Award: https://www.awwwards.com/developer-award/
- Developer guidelines (the Google Doc both pages link to): https://docs.google.com/document/d/1Gvmg6Z60UQ-4BOM3XyUcBKvq2shd4J-l_MoXT26JFEg/
- Jury: https://www.awwwards.com/jury/
- FAQs: https://www.awwwards.com/faqs/
- About us: https://www.awwwards.com/about-us/
- Site pages, for how scores are shown, for example https://www.awwwards.com/sites/heva-health and https://www.awwwards.com/sites/maxima-therapy

## 1. The four criteria and their weights

Source: https://www.awwwards.com/about-evaluation/

> "The evaluation system used to score the websites submitted to awwwards is based on the following 4 criteria: Design: 40% points, Usability: 30% points, Creativity: 20% points, Content: 10% points."

| Criterion  | Weight |
| ---------- | ------ |
| Design     | 40%    |
| Usability  | 30%    |
| Creativity | 20%    |
| Content    | 10%    |

Confirmed by arithmetic on a site page: each juror's "Overall" is the weighted sum of their four marks. On https://www.awwwards.com/sites/heva-health one juror gave 7, 6, 7, 6 and the page shows 6.60 (0.4×7 + 0.3×6 + 0.2×7 + 0.1×6).

**What each criterion covers: not stated.** The Evaluation System page names the four criteria and their weights and gives no definition, checklist or example for any of them. The FAQs and About pages add none. Any description of what "Usability" or "Content" means to the jury is an inference, not something Awwwards publishes on these pages.

## 2. The scale and how votes are combined

**Scale.** The Evaluation System page does not state the scale in words. Site pages show every score "/ 10", and individual juror marks are whole numbers (in the pages read, between 6 and 9). Source: https://www.awwwards.com/sites/heva-health

**Who votes, and how many.** Source: https://www.awwwards.com/about-evaluation/

> "Once approved, sites are sent to a minimum of 18 jury members, and the 3 jury scores furthest from the average are automatically eliminated by our system. The voting process lasts 5 days, but if a site receives a high score from the jury and at least 10 PRO users, it could win a SOTD before the end of the 5-day period."

So: at least 18 jurors, the 3 votes furthest from the average are dropped, voting runs 5 days.

**The users' vote.** Same page:

> "Users votes: only votes made by Professional users (who have passed through our validation system) will be taken into account. This is to avoid the creation of false accounts, set up to benefit or cause harm to particular nominees."

The FAQs describe two separate votes: "There are 2 voting process going on separately: JURY & USERS." (https://www.awwwards.com/faqs/). Site pages show the users' result on its own line, "Awwwards Users - Pro and Chief", beside the jury table, for example 7.72 on the HEVA page where the jury score is 7.11.

**Not stated:** how, or whether, the users' vote changes the published SOTD score. Also not stated: the exact formula for the published number. I checked six Site of the Day pages. Each lists 16 or 18 jurors. Neither the plain mean of the listed jurors nor the mean after dropping the three furthest reproduces the published score exactly (HEVA: published 7.11, plain mean 7.12, trimmed 7.07; Maxima Therapy: published 7.73, plain mean 7.66, trimmed 7.61). The page does not say whether the listed jurors are all the voters or only those kept.

**Who the jury is.** https://www.awwwards.com/about-us/: "A panel of expert digital creatives, made up of designers, developers, and agencies from all over the world". The Jury page (https://www.awwwards.com/jury/) is a filterable grid of members by year (2010 to 2026), type ("Code", "Design", "Young Jury") and country; it has no text on method. The FAQs say: "The standard criteria for people applying to join the Main Jury is for them to have won at least one Site of the Day. To apply for the Young Jury, you must be 25 years old or younger."

**Visibility of scores.** FAQs: "The score from the Jury is only visible to Site of the Day winners." That is why Honorable Mention and Nominee pages in the library carry no scores.

## 3. Thresholds

| Award             | What the site says                                                                                                                                                                                                                                                                                                                                                                                                        | Source                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Honorable Mention | "HMs are awarded to sites that are scored 6.5 or more from the jury." The FAQs add a second condition: "the score from the JURY needs to be 6.5 or higher, same as the score from the USES (Chief, Tribe, Pro, International accounts). If these two conditions are met the site will receive Honorable Mention." ("USES" is the page's own spelling.)                                                                    | https://www.awwwards.com/about-evaluation/ and https://www.awwwards.com/faqs/ |
| Site of the Day   | **No number is stated.** "only the sites scored the highest by the jury will be awarded the coveted SOTD ... as there's only 365 days in a year, not everyone who deserves a SOTD will win one." It is a ranking, one per day, not a pass mark. A site stays eligible for "up to 3 months since approved" (FAQs). For reference only: the Site of the Day pages read for this library show jury scores from 7.11 to 7.73. | https://www.awwwards.com/about-evaluation/ and https://www.awwwards.com/faqs/ |
| Site of the Month | "The eight highest-scoring sites each month are nominated for Site of the Month and reviewed by the Jury a second time. The awwwards users play an important part in deciding the winner; the site which receives the most user votes will carry extra weight in the Jury's final decision." No score threshold stated.                                                                                                   | https://www.awwwards.com/about-evaluation/                                    |
| Site of the Year  | "All Site of the Month winners are automatically nominated for SOTY, in addition to some of awwwards favorite sites. The winner is announced in February of the following year, after a rigorous voting process." No score threshold or voting formula stated.                                                                                                                                                            | https://www.awwwards.com/about-evaluation/                                    |

## 4. The Developer Award

**Who is judged and the threshold.** https://www.awwwards.com/about-evaluation/:

> "All SOTD winning sites are sent to the developer jury to be meticulously evaluated according to the Developer Guidelines, if the site is scored higher than a 7 it will be given a Developer Award."

So only Site of the Day winners are considered, and the pass mark is above 7 out of 10. (One listing in the cache shows a Developer Award beside an Honorable Mention, so the rule as written may have exceptions; the page does not explain them.)

**What it rewards.** https://www.awwwards.com/developer-award/: it "celebrates those who build quality code, interoperable across modern browsers and devices", naming "optimizing for mobile, ensuring accessibility for individuals with visual or hearing impairments, creating adaptable experiences for legacy browsers". The page itself gives no criteria or weights; it links to the guidelines document.

**Criteria and weights.** From the guidelines document (https://docs.google.com/document/d/1Gvmg6Z60UQ-4BOM3XyUcBKvq2shd4J-l_MoXT26JFEg/): "the judging system is divided into 6 categories, each one with different relative weights":

| Category                           | Weight | What the document lists under it (short)                                                                                                                                                                                                            |
| ---------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WPO (web performance optimization) | 0.20   | compression, critical rendering path, deferred scripts, optimized and lazy media, caching, fewer third parties, no console errors                                                                                                                   |
| RWD / Mobile                       | 0.20   | flexible grid and media, consistent breakpoints, readable responsive type, tap target size, responsive navigation, performance                                                                                                                      |
| Markup / Metadata                  | 0.15   | valid HTML, sectioning, metadata, Open Graph and Schema.org, images with alt, width and height                                                                                                                                                      |
| Semantics / SEO                    | 0.20   | unique titles and descriptions, URL structure, canonical tags, semantic headings, sitemaps, text-based content                                                                                                                                      |
| Animations / Transitions           | 0.15   | smooth stable frame rate, easing and timing, consistency, "avoid animations being too slow, too fast, too often, too different"                                                                                                                     |
| Accessibility                      | 0.10   | keyboard, mouse and touch input, labelled controls, focus management, legible font sizes, colour contrast, "No relevant information only on hover", captions, pause controls for animation over 5 seconds, content accessible with no CSS and no JS |

Confirmed by arithmetic: on https://www.awwwards.com/sites/heva-health a developer juror's marks of 7, 7, 7, 8, 8, 6 (Semantics, Animations, Accessibility, WPO, Responsive, Markup) give the 7.25 shown. On the six pages checked, the published Developer score equals the plain mean of the 3 or 5 developer jurors listed.

The document opens with a notice that an updated version of the guidelines will roll out "during the first quarter of the year" (no year given). The weights above are the ones in the document as saved.

## 5. Mobile evaluation

- **In the main jury score: not stated.** The Evaluation System page does not mention mobile, phones or responsive design. The four criteria carry no mobile sub-score.
- **In the Developer Award: yes.** "RWD / Mobile" is one of six categories at 0.20, and the Accessibility category repeats "Appropriate tap targets size" and "Viewport configuration" (guidelines document above). Site pages show it as "Responsive Design".
- **A separate mobile award: no page found.** https://www.awwwards.com/mobile-excellence/ and https://www.awwwards.com/mobile-guidelines/ both return "Error 404". Some listing rows still carry a "Mobile Of The Week" label, but no page read here explains how it is judged.
- Site pages show a desktop thumbnail and a mobile thumbnail for each entry (https://www.awwwards.com/sites/function-health), which tells us a mobile view is submitted, not how it is scored.

## What this means for Eleva

- 70% of the main score is Design plus Usability. Creativity is 20%. A calm, clear site is not penalised by the weights; the Site of the Day winners in the library score between 7.0 and 7.5 on Usability.
- The Developer Award is the closer match to what Eleva needs: speed, responsive layout, semantics and accessibility make up 70% of it, animation 15%.
- An Honorable Mention needs 6.5 from the jury and from validated users. Site of the Day has no pass mark; it is the best of the day.
