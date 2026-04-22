import type { default as messagesEn } from './src/messages/en.json';

declare module 'next-intl' {
  interface AppConfig {
    // Define the Messages type based on the structure of your English messages
    Messages: typeof messagesEn;
  }
}

// Bun types are provided by @types/bun package
