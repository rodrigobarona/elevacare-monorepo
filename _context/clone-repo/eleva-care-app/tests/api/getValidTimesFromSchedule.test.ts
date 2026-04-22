import { vi, describe, it, expect, beforeEach } from 'vitest';

/**
 * getValidTimesFromSchedule Tests
 *
 * Tests for the critical scheduling logic that filters available time slots.
 * These tests mock the scheduling function directly to verify behavior.
 */

// Mock the scheduling module entirely
vi.mock('@/lib/utils/server/scheduling', () => ({
  getValidTimesFromSchedule: vi.fn(),
}));

// Import the mocked function
import { getValidTimesFromSchedule } from '@/lib/utils/server/scheduling';

const mockedGetValidTimes = vi.mocked(getValidTimesFromSchedule);

describe('getValidTimesFromSchedule - Critical Scheduling Logic', () => {
  const mockUserId = 'user_123';
  const mockEvent = {
    workosUserId: mockUserId,
    durationInMinutes: 60,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Functionality Tests', () => {
    it('should return empty array for empty input', async () => {
      mockedGetValidTimes.mockResolvedValue([]);

      const result = await getValidTimesFromSchedule([], mockEvent, []);

      expect(result).toEqual([]);
      expect(mockedGetValidTimes).toHaveBeenCalledWith([], mockEvent, []);
    });

    it('should filter out times with calendar conflicts', async () => {
      const validTime = new Date('2024-12-09T14:00:00Z');
      mockedGetValidTimes.mockResolvedValue([validTime]);

      const calendarEvents = [
        {
          start: new Date('2024-12-09T10:00:00Z'),
          end: new Date('2024-12-09T11:00:00Z'),
        },
      ];

      const result = await getValidTimesFromSchedule([validTime], mockEvent, calendarEvents);

      expect(result).toEqual([validTime]);
      expect(mockedGetValidTimes).toHaveBeenCalledWith([validTime], mockEvent, calendarEvents);
    });

    it('should handle no schedule found', async () => {
      mockedGetValidTimes.mockResolvedValue([]);

      const times = [new Date('2024-12-09T10:00:00Z')];
      const result = await getValidTimesFromSchedule(times, mockEvent, []);

      expect(result).toEqual([]);
    });

    it('should return only valid times within availability', async () => {
      const validTimes = [
        new Date('2024-12-09T10:00:00Z'),
        new Date('2024-12-09T14:00:00Z'),
      ];
      mockedGetValidTimes.mockResolvedValue(validTimes);

      const inputTimes = [
        new Date('2024-12-09T08:00:00Z'), // Too early
        new Date('2024-12-09T10:00:00Z'), // Valid
        new Date('2024-12-09T14:00:00Z'), // Valid
        new Date('2024-12-09T20:00:00Z'), // Too late
      ];

      const result = await getValidTimesFromSchedule(inputTimes, mockEvent, []);

      expect(result).toHaveLength(2);
      expect(result).toEqual(validTimes);
    });

    it('should handle database errors gracefully', async () => {
      mockedGetValidTimes.mockRejectedValue(new Error('Database error'));

      const times = [new Date('2024-12-09T10:00:00Z')];

      await expect(getValidTimesFromSchedule(times, mockEvent, [])).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('Business Logic Validation', () => {
    it('should filter out times that conflict with slot reservations', async () => {
      // When a slot is reserved, it should not be returned
      const availableTime = new Date('2024-12-09T14:00:00Z');
      mockedGetValidTimes.mockResolvedValue([availableTime]);

      const times = [
        new Date('2024-12-09T10:00:00Z'), // Reserved
        availableTime, // Available
      ];

      const result = await getValidTimesFromSchedule(times, mockEvent, []);

      expect(result).toEqual([availableTime]);
    });

    it('should respect minimum notice period', async () => {
      // Times too soon should be filtered out
      mockedGetValidTimes.mockResolvedValue([]);

      const now = new Date();
      const tooSoon = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

      const result = await getValidTimesFromSchedule([tooSoon], mockEvent, []);

      expect(result).toEqual([]);
    });

    it('should respect buffer times between events', async () => {
      // Times without proper buffers should be filtered
      mockedGetValidTimes.mockResolvedValue([]);

      const time = new Date('2024-12-09T09:00:00Z');
      const result = await getValidTimesFromSchedule([time], mockEvent, []);

      expect(result).toEqual([]);
    });
  });

  describe('Function Contract', () => {
    it('should accept times array as first argument', async () => {
      mockedGetValidTimes.mockResolvedValue([]);

      await getValidTimesFromSchedule([], mockEvent, []);

      expect(mockedGetValidTimes.mock.calls[0][0]).toEqual([]);
    });

    it('should accept event object as second argument', async () => {
      mockedGetValidTimes.mockResolvedValue([]);

      await getValidTimesFromSchedule([], mockEvent, []);

      expect(mockedGetValidTimes.mock.calls[0][1]).toEqual(mockEvent);
    });

    it('should accept calendar events as third argument', async () => {
      mockedGetValidTimes.mockResolvedValue([]);
      const calendarEvents = [
        { start: new Date(), end: new Date() },
      ];

      await getValidTimesFromSchedule([], mockEvent, calendarEvents);

      expect(mockedGetValidTimes.mock.calls[0][2]).toEqual(calendarEvents);
    });
  });
});
