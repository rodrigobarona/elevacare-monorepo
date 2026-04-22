// Mock for @novu/framework - Vitest compatible
import { vi } from 'vitest';

type WorkflowHandler = (...args: unknown[]) => unknown;

export const workflow = vi.fn((workflowId: string, handler: WorkflowHandler) => ({
  workflowId,
  handler,
  trigger: vi.fn().mockResolvedValue({ success: true }),
}));

export const serve = vi.fn().mockReturnValue({
  handler: vi.fn(),
  GET: vi.fn(),
  POST: vi.fn(),
  OPTIONS: vi.fn(),
});

// Mock workflow step functions
export const step = {
  email: vi.fn().mockImplementation(() => ({
    stepId: 'email-step',
    handler: vi.fn(),
  })),
  inApp: vi.fn().mockImplementation(() => ({
    stepId: 'inApp-step',
    handler: vi.fn(),
  })),
  sms: vi.fn().mockImplementation(() => ({
    stepId: 'sms-step',
    handler: vi.fn(),
  })),
  push: vi.fn().mockImplementation(() => ({
    stepId: 'push-step',
    handler: vi.fn(),
  })),
  digest: vi.fn().mockImplementation(() => ({
    stepId: 'digest-step',
    handler: vi.fn(),
  })),
  delay: vi.fn().mockImplementation(() => ({
    stepId: 'delay-step',
    handler: vi.fn(),
  })),
  custom: vi.fn().mockImplementation(() => ({
    stepId: 'custom-step',
    handler: vi.fn(),
  })),
};

// Mock workflow payload and context
export const mockWorkflowPayload = {
  payload: {},
  step,
};

export const mockWorkflowContext = {
  payload: {},
  subscriber: {
    subscriberId: 'test-subscriber',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
  },
};
