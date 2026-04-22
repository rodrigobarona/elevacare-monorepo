// Manual mock for lib/novu-email-service.ts - Vitest compatible
// Mirror: lib/novu-email-service.ts exports elevaEmailService instance and other functions
import { vi } from 'vitest';

// Mock TemplateSelectionService class
export class TemplateSelectionService {
  selectTemplate = vi.fn().mockReturnValue(null);
  selectTemplateWithContext = vi.fn().mockReturnValue({
    template: null,
    metadata: {},
  });
  selectTemplateForExperiment = vi.fn().mockReturnValue({
    template: null,
    selectedVariant: undefined,
  });
}

// Mock instance
export const templateSelectionService = new TemplateSelectionService();

// Mock ElevaEmailService class
export class ElevaEmailService {
  renderEmailWithSelection = vi.fn().mockResolvedValue({
    html: '<html>Mock Email</html>',
    metadata: {},
  });
  renderAppointmentConfirmation = vi
    .fn()
    .mockResolvedValue('<html>Mock Appointment Email</html>');
  renderWelcomeEmail = vi.fn().mockResolvedValue('<html>Mock Welcome Email</html>');
  renderAppointmentReminder = vi.fn().mockResolvedValue('<html>Mock Reminder Email</html>');
  renderPaymentConfirmation = vi.fn().mockResolvedValue('<html>Mock Payment Email</html>');
  renderMultibancoPaymentReminder = vi
    .fn()
    .mockResolvedValue('<html>Mock Multibanco Reminder</html>');
  renderExpertPayoutNotification = vi
    .fn()
    .mockResolvedValue('<html>Mock Payout Notification</html>');
  renderExpertNotification = vi.fn().mockResolvedValue('<html>Mock Expert Notification</html>');
  renderGenericEmail = vi.fn().mockResolvedValue('<html>Mock Generic Email</html>');
  renderMultibancoBookingPending = vi
    .fn()
    .mockResolvedValue('<html>Mock Multibanco Pending</html>');
  renderSimpleNotification = vi.fn().mockReturnValue('<html>Mock Simple Notification</html>');
}

// Mock singleton instance
export const elevaEmailService = new ElevaEmailService();

// Mock functions
export const sendNovuEmailEnhanced = vi.fn().mockResolvedValue({ success: true });
export const sendNovuEmail = vi.fn().mockResolvedValue({ success: true });
export const sendNovuEmailWithCustomTemplate = vi.fn().mockResolvedValue({ success: true });
export const sendDirectResendEmail = vi.fn().mockResolvedValue({ success: true });
export const getSubscriberForEmail = vi.fn().mockResolvedValue({
  subscriberId: 'test-user-id',
});
export const triggerNovuWorkflow = vi.fn().mockResolvedValue({ success: true });
