// Manual mock for app/utils/novu.ts - Vitest compatible
// Mirror: app/utils/novu.ts exports
import { vi } from 'vitest';

export const triggerWorkflow = vi.fn().mockResolvedValue({ success: true });

export const updateSubscriber = vi.fn().mockResolvedValue({ success: true });

export const getNovuStatus = vi.fn().mockReturnValue({
  initialized: true,
  initializationError: null,
  config: {
    hasSecretKey: true,
    hasApiKey: false,
    hasAppId: true,
    baseUrl: 'https://api.novu.co',
    socketUrl: undefined,
    adminSubscriberId: undefined,
    keyPrefix: 'novu-...',
  },
});

export const runNovuDiagnostics = vi.fn().mockResolvedValue({
  client: {
    initialized: true,
    initializationError: null,
  },
  workflows: [],
  errors: [],
  recommendations: [],
  summary: {
    healthy: true,
    criticalErrors: 0,
    warnings: 0,
  },
});

export const novu = {
  trigger: vi.fn().mockResolvedValue({ success: true }),
  subscribers: {
    create: vi.fn().mockResolvedValue({ success: true }),
  },
};
