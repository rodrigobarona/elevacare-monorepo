# 🍪 React Cookie Manager

A powerful, customizable React component for cookie consent management with built-in tracking prevention. This component provides a modern, user-friendly way to obtain and manage cookie consent from your website visitors.

[![React Cookie Manager Hero](https://github.com/hypershiphq/react-cookie-manager/blob/main/assets/github-hero-banner.jpg?raw=true)](https://cookiekit.io)

![React Cookie Manager](https://github.com/hypershiphq/react-cookie-manager/blob/main/assets/react-cookie-manager.gif?raw=true)

## Contents

- [Features](#features)
- [Try it out](#-try-it-out)
- [CookieKit Integration](#cookiekit-integration)
- [Automatically Disable Tracking](#automatically-disable-tracking)
- [Installation](#installation)
- [Importing Styles](#importing-styles)
- [Basic Usage](#basic-usage)
- [Next.js Usage](#nextjs-usage)
- [Full Usage](#full-usage)
- [Advanced Usage with Hook](#advanced-usage-with-hook)
- [Props](#props)
- [Cookie Categories](#cookie-categories)
- [Hook API](#hook-api)
- [i18next support](#i18next-support)
- [Translation Options](#translation-options)
- [Contributing](#contributing)
- [License](#license)

## Features

- 🌐 Multiple display types (banner, popup, modal)
- 🛡️ Automatic tracking prevention (Google Analytics, etc.)
- 🎯 Granular cookie category controls (Analytics, Social, Advertising)
- 🎨 Light and dark theme support
- 📱 Responsive design
- 🔧 Highly customizable UI
- 💾 Persistent consent storage
- 🔒 Privacy-first approach
- 🇪🇺 GDPR compliance with CookieKit.io integration
- 🍪 Floating cookie button for easy access

## CookieKit Integration

Take your GDPR compliance to the next level with [CookieKit.io](https://cookiekit.io) integration!

### Features

- 📊 Real-time consent analytics dashboard
- 🔄 Automatic consent proof storage
- 📈 Advanced user segmentation
- 🆓 Completely free to use!

### Usage with CookieKit

```jsx
import { CookieManager } from 'react-cookie-manager';

function App() {
  return (
    <CookieManager
      cookieKitId="your-cookie-kit-website-id" // Get this from cookiekit.io
      translations={{
        title: 'Cookie Preferences',
        message: 'We use cookies to improve your experience.',
      }}
    >
      <YourApp />
    </CookieManager>
  );
}
```

When `cookieKitId` is provided, React Cookie Manager will automatically:

- Generate and track unique session IDs
- Send consent events to CookieKit.io
- Store consent proofs for GDPR compliance
- Provide analytics data in your CookieKit dashboard

Visit [cookiekit.io](https://cookiekit.io) to get started for free!

## 🎮 Try it out!

### [🔗 Live Demo](https://react-cookie-manager.hypership.dev/)

See React Cookie Manager in action and explore all its features in our interactive demo.

## Automatically Disable Tracking

Unlike other cookie consent managers and React components, this component automatically disables tracking for Google Analytics, Facebook Pixel, and other tracking services. This is done by blocking the tracking scripts from loading. Therefore, you don't need to manually disable tracking, saving you hours of work.

## Installation

```bash
npm install react-cookie-manager
# or
yarn add react-cookie-manager
```

## Importing Styles

The component requires its CSS file to be imported in your application. Add the following import to your app's entry point (e.g., `App.tsx` or `index.tsx`):

```javascript
import 'react-cookie-manager/style.css';
```

![React Cookie Manager Styles](https://github.com/hypershiphq/react-cookie-manager/blob/main/assets/banner-styles.jpg?raw=true)

## Basic Usage

```jsx
import { CookieManager } from 'react-cookie-manager';
import 'react-cookie-manager/style.css';

function App() {
  return (
    <CookieManager
      translations={{
        title: 'Cookie Preferences',
        message: 'We use cookies to improve your experience.',
      }}
      onManage={(preferences) => console.log('Cookie preferences:', preferences)}
    >
      <YourApp />
    </CookieManager>
  );
}
```

## Next.js Usage

For Next.js applications, you'll need to use dynamic imports to prevent SSR of the cookie manager:

```tsx
'use client';

import dynamic from 'next/dynamic';
// In your page component
import { useCookieConsent } from 'react-cookie-manager';

const CookieManager = dynamic(
  () => import('react-cookie-manager').then((mod) => mod.CookieManager),
  { ssr: false, loading: () => null },
);

// In your Providers component or layout
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CookieManager
      showManageButton={true}
      translations={{
        title: 'Cookie Preferences',
        message: 'We use cookies to improve your experience.',
      }}
      displayType="banner"
      theme="light"
    >
      {children}
    </CookieManager>
  );
}

export default function Home() {
  const { showConsentBanner, detailedConsent } = useCookieConsent();

  return (
    <div>
      <button onClick={showConsentBanner}>Manage Cookie Settings</button>
      {detailedConsent && (
        <div>
          Analytics: {detailedConsent.Analytics.consented ? 'Enabled' : 'Disabled'}
          Social: {detailedConsent.Social.consented ? 'Enabled' : 'Disabled'}
          Advertising: {detailedConsent.Advertising.consented ? 'Enabled' : 'Disabled'}
        </div>
      )}
    </div>
  );
}
```

## Full Usage

My cookiekit ID is `67c4aff8666e5176795fd7d1`

```jsx
import { CookieManager } from 'react-cookie-manager';
import 'react-cookie-manager/style.css';

function App() {
  return (
    <CookieManager
      translations={{
        title: 'Would You Like A Cookie? 🍪',
        message:
          'We value your privacy. Choose which cookies you want to allow. Essential cookies are always enabled as they are necessary for the website to function properly.',
        buttonText: 'Accept All',
        declineButtonText: 'Decline All',
        manageButtonText: 'Manage Cookies',
        privacyPolicyText: 'Privacy Policy',
      }}
      showManageButton={true}
      privacyPolicyUrl="https://example.com/privacy"
      theme="light"
      displayType="popup"
      cookieKitId="your-cookie-kit-id" // Optional: Enable CookieKit.io integration
      onManage={(preferences) => {
        if (preferences) {
          console.log('Cookie preferences updated:', preferences);
        }
      }}
    >
      <AppContent />
    </CookieManager>
  );
}
```

## Advanced Usage with Hook

```jsx
import { CookieManager, useCookieConsent } from 'react-cookie-manager';

function CookieSettings() {
  const { showConsentBanner, detailedConsent } = useCookieConsent();

  return (
    <div>
      <button onClick={showConsentBanner}>Manage Cookie Settings</button>
      {detailedConsent && (
        <div>
          Analytics: {detailedConsent.Analytics.consented ? 'Enabled' : 'Disabled'}
          Social: {detailedConsent.Social.consented ? 'Enabled' : 'Disabled'}
          Advertising: {detailedConsent.Advertising.consented ? 'Enabled' : 'Disabled'}
        </div>
      )}
    </div>
  );
}
```

## Floating Cookie Button

The floating cookie button provides a persistent, accessible way for users to manage their cookie preferences after they've made their initial choice. It appears as a small, animated cookie icon in the bottom-left corner of the screen.

### Enabling the Floating Button

```jsx
<CookieManager
  enableFloatingButton={true}
  theme="light" // or "dark"
  // ... other props
>
  <YourApp />
</CookieManager>
```

### Features

- 🎯 Automatically appears after initial consent
- 🎨 Matches your theme (light/dark mode)
- 🔄 Smooth animations and hover effects
- ❌ Dismissible with a close button
- 📱 Responsive and mobile-friendly
- 🎛️ Easy access to cookie preferences

### Behavior

1. The button appears after users make their initial cookie choice
2. Hovering reveals a close button to dismiss the floating button
3. Clicking opens the cookie preferences modal
4. The button remains hidden until page refresh after being closed
5. Maintains position during scroll

### Customization

The floating button automatically adapts to your chosen theme:

```jsx
// Light theme (default)
<CookieManager
  enableFloatingButton={true}
  theme="light"
>
  <YourApp />
</CookieManager>

// Dark theme
<CookieManager
  enableFloatingButton={true}
  theme="dark"
>
  <YourApp />
</CookieManager>
```

The button inherits your color scheme:

- Light theme: White background with gray text
- Dark theme: Black background with light gray text

### Accessibility

The floating button is fully accessible:

- Proper ARIA labels
- Keyboard navigation support
- Focus management
- High contrast ratios
- Screen reader friendly

## Props

| Prop                       | Type                                     | Default          | Description                               |
| -------------------------- | ---------------------------------------- | ---------------- | ----------------------------------------- |
| `children`                 | React.ReactNode                          | -                | Your app components                       |
| `translations`             | TranslationObject \| TranslationFunction | -                | Translation object or i18n TFunction      |
| `translationI18NextPrefix` | string                                   | -                | i18next key prefix, e.g. "cookies."       |
| `showManageButton`         | boolean                                  | false            | Whether to show the manage cookies button |
| `enableFloatingButton`     | boolean                                  | false            | Enable floating cookie button             |
| `privacyPolicyUrl`         | string                                   | -                | URL for the privacy policy                |
| `cookieKey`                | string                                   | 'cookie-consent' | Name of the cookie to store consent       |
| `cookieExpiration`         | number                                   | 365              | Days until cookie expires                 |
| `displayType`              | 'banner' \| 'popup' \| 'modal'           | 'banner'         | How the consent UI is displayed           |
| `position`                 | 'top' \| 'bottom'                        | 'bottom'         | Position of the banner                    |
| `theme`                    | 'light' \| 'dark'                        | 'light'          | Color theme                               |
| `disableAutomaticBlocking` | boolean                                  | false            | Disable automatic tracking prevention     |
| `blockedDomains`           | string[]                                 | []               | Additional domains to block               |
| `cookieKitId`              | string                                   | undefined        | Your CookieKit.io integration ID          |
| `onManage`                 | (preferences?: CookieCategories) => void | -                | Callback when preferences are updated     |

## Cookie Categories

The component manages three categories of cookies:

```typescript
interface CookieCategories {
  Analytics: boolean;
  Social: boolean;
  Advertising: boolean;
}
```

## Hook API

The `useCookieConsent` hook provides the following:

```typescript
interface CookieConsentHook {
  hasConsent: boolean | null;
  isDeclined: boolean;
  detailedConsent: DetailedCookieConsent | null;
  showConsentBanner: () => void;
  acceptCookies: () => void;
  declineCookies: () => void;
  updateDetailedConsent: (preferences: CookieCategories) => void;
}
```

## i18next support

```typescript
import { default as i18next } from "i18next";

function App() {
  return (
    <CookieManager
      translations={i18next.t}
      translationI18NextPrefix="cookies."
      ...
      />
  )
}
```

```json
// en.json
{
  "cookies": {
    "title": "Would You Like A Cookie? 🍪",
    "message": "We value your privacy. Choose which cookies you want to allow. Essential cookies are always enabled as they are necessary for the website to function properly.",
    "buttonText": "Accept All",
    "declineButtonText": "Decline All",
    "manageButtonText": "Manage Cookies",
    "privacyPolicyText": "Privacy Policy"
  }
  //...
}
```

## Translation Options

All available translation keys and their default values:

```typescript
{
  // Main consent banner/popup/modal
  title: "",  // Optional title
  message: "This website uses cookies to enhance your experience.",
  buttonText: "Accept",
  declineButtonText: "Decline",
  manageButtonText: "Manage Cookies",
  privacyPolicyText: "Privacy Policy",

  // Manage consent modal
  manageTitle: "Cookie Preferences",
  manageMessage: "Manage your cookie preferences below. Essential cookies are always enabled as they are necessary for the website to function properly.",

  // Essential cookies section
  manageEssentialTitle: "Essential",
  manageEssentialSubtitle: "Required for the website to function properly",
  manageEssentialStatus: "Status: Always enabled",
  manageEssentialStatusButtonText: "Always On",

  // Analytics cookies section
  manageAnalyticsTitle: "Analytics",
  manageAnalyticsSubtitle: "Help us understand how visitors interact with our website",

  // Social cookies section
  manageSocialTitle: "Social",
  manageSocialSubtitle: "Enable social media features and sharing",

  // Advertising cookies section
  manageAdvertTitle: "Advertising",
  manageAdvertSubtitle: "Personalize advertisements and measure their performance",

  // Status messages
  manageCookiesStatus: "Status: {{status}} on {{date}}", // Supports variables
  manageCookiesStatusConsented: "Consented",
  manageCookiesStatusDeclined: "Declined",

  // Buttons in manage modal
  manageCancelButtonText: "Cancel",
  manageSaveButtonText: "Save Preferences"
}
```

You can override any of these translations by passing them in the `translations` prop:

```jsx
<CookieManager
  translations={{
    title: 'Cookie Settings 🍪',
    message: 'We use cookies to improve your experience.',
    buttonText: 'Allow All',
    manageButtonText: 'Customize',
    // ... override any other translations
  }}
>
  <App />
</CookieManager>
```

### i18next Integration

When using i18next, make sure your translation files include all the keys under your chosen prefix:

```json
{
  "cookies": {
    "title": "Cookie Settings 🍪",
    "message": "We use cookies to improve your experience.",
    "buttonText": "Allow All",
    "declineButtonText": "Decline All",
    "manageButtonText": "Customize",
    "privacyPolicyText": "Privacy Policy",
    "manageTitle": "Cookie Preferences",
    "manageMessage": "Customize your cookie preferences below...",
    "manageEssentialTitle": "Essential Cookies"
    // ... include all other translation keys
  }
}
```

Then use it with the i18next translation function:

```jsx
import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation();

  return (
    <CookieManager translations={t} translationI18NextPrefix="cookies.">
      <YourApp />
    </CookieManager>
  );
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © Hypership
