/**
 * Internationalization module exports
 *
 * This file is used to re-export all internationalization utilities
 * to provide a consistent API for the rest of the application.
 * The actual middleware implementation is in middleware.ts
 * because it is combined with WorkOS authentication middleware.
 */

export * from './routing';
export * from './navigation';
export * from './cookie-translations';
export * from './utils';
