export const DEFAULT_SCHEDULING_SETTINGS = {
  beforeEventBuffer: 10, // 10 minutes buffer before events
  afterEventBuffer: 0, // No buffer after events
  minimumNotice: 1440, // 24 hours minimum notice (in minutes)
  timeSlotInterval: 30, // 30 minutes slots
  bookingWindowDays: 60, // 2 months booking window
};

// Export individual values for direct imports if needed
export const DEFAULT_BEFORE_EVENT_BUFFER = DEFAULT_SCHEDULING_SETTINGS.beforeEventBuffer;
export const DEFAULT_AFTER_EVENT_BUFFER = DEFAULT_SCHEDULING_SETTINGS.afterEventBuffer;
export const DEFAULT_MINIMUM_NOTICE = DEFAULT_SCHEDULING_SETTINGS.minimumNotice;
export const DEFAULT_TIME_SLOT_INTERVAL = DEFAULT_SCHEDULING_SETTINGS.timeSlotInterval;
export const DEFAULT_BOOKING_WINDOW_DAYS = DEFAULT_SCHEDULING_SETTINGS.bookingWindowDays;
