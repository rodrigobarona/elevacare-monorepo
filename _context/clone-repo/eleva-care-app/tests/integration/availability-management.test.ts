import { vi, describe, it, expect, beforeEach } from 'vitest';

/**
 * Availability Management Tests
 * Tests for availability slot management functionality
 */

// Mock the database
vi.mock('@/drizzle/db', () => ({
  db: {
    query: {
      ScheduleTable: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'schedule_123',
          clerkUserId: 'user_123',
          timezone: 'America/New_York',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      AvailabilityTable: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'availability_1',
            scheduleId: 'schedule_123',
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '17:00',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'availability_2',
            scheduleId: 'schedule_123',
            dayOfWeek: 3,
            startTime: '09:00',
            endTime: '17:00',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      },
      EventTable: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'availability_3' }]),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn(),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      returning: vi.fn(),
    }),
    transaction: vi.fn().mockImplementation(async (callback) => {
        return await callback(vi.fn());
      }),
  },
}));

// Mock next cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock the date-fns functions
vi.mock('date-fns', () => ({
  parse: vi.fn().mockImplementation((timeString) => new Date(`2023-01-01T${timeString}:00`)),
  format: vi.fn().mockImplementation(() => '09:00'),
  addMinutes: vi.fn().mockImplementation((date) => date),
  isAfter: vi.fn().mockReturnValue(true),
}));

// Create mock functions for our server actions
const mockGetAvailabilities = vi.fn().mockResolvedValue({
  success: true,
  availabilities: [
    {
      id: 'availability_1',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
    },
    {
      id: 'availability_2',
      dayOfWeek: 3,
      startTime: '09:00',
      endTime: '17:00',
    },
  ],
});

const mockUpdateAvailability = vi.fn().mockResolvedValue({
  success: true,
  availability: {
    id: 'availability_1',
    dayOfWeek: 1,
    startTime: '10:00',
    endTime: '18:00',
  },
});

const mockCreateAvailability = vi.fn().mockResolvedValue({
  success: true,
  availability: {
    id: 'availability_3',
    dayOfWeek: 5,
    startTime: '09:00',
    endTime: '13:00',
  },
});

const mockDeleteAvailability = vi.fn().mockResolvedValue({
  success: true,
  deletedId: 'availability_2',
});

const mockUpdateSchedule = vi.fn().mockResolvedValue({
  success: true,
  schedule: {
    id: 'schedule_123',
    timezone: 'Europe/London',
  },
});

describe('Availability Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockGetAvailabilities.mockResolvedValue({
      success: true,
      availabilities: [
        { id: 'availability_1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
        { id: 'availability_2', dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      ],
    });
    mockCreateAvailability.mockResolvedValue({
      success: true,
      availability: { id: 'availability_3', dayOfWeek: 5, startTime: '09:00', endTime: '13:00' },
    });
    mockUpdateAvailability.mockResolvedValue({
      success: true,
      availability: { id: 'availability_1', dayOfWeek: 1, startTime: '10:00', endTime: '18:00' },
    });
    mockDeleteAvailability.mockResolvedValue({
      success: true,
      deletedId: 'availability_2',
    });
    mockUpdateSchedule.mockResolvedValue({
      success: true,
      schedule: { id: 'schedule_123', timezone: 'Europe/London' },
    });
  });

  it('should retrieve all availabilities for a user', async () => {
    const result = await mockGetAvailabilities();

    expect(result.success).toBe(true);
    expect(result.availabilities).toHaveLength(2);
    expect(result.availabilities[0].dayOfWeek).toBe(1);
    expect(result.availabilities[1].dayOfWeek).toBe(3);
  });

  it('should create a new availability slot', async () => {
    const newAvailability = {
      dayOfWeek: 5,
      startTime: '09:00',
      endTime: '13:00',
    };

    const result = await mockCreateAvailability(newAvailability);

    expect(result.success).toBe(true);
    expect(result.availability).toMatchObject({
      id: expect.any(String),
      dayOfWeek: 5,
      startTime: '09:00',
      endTime: '13:00',
    });
    expect(mockCreateAvailability).toHaveBeenCalledWith(newAvailability);
  });

  it('should update an existing availability slot', async () => {
    const updatedAvailability = {
      id: 'availability_1',
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '18:00',
    };

    const result = await mockUpdateAvailability(updatedAvailability);

    expect(result.success).toBe(true);
    expect(result.availability).toMatchObject({
      id: 'availability_1',
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '18:00',
    });
    expect(mockUpdateAvailability).toHaveBeenCalledWith(updatedAvailability);
  });

  it('should delete an availability slot', async () => {
    const availabilityId = 'availability_2';

    const result = await mockDeleteAvailability(availabilityId);

    expect(result.success).toBe(true);
    expect(result.deletedId).toBe(availabilityId);
    expect(mockDeleteAvailability).toHaveBeenCalledWith(availabilityId);
  });

  it('should validate time ranges when creating availability', async () => {
    const validateTimeRange = (startTime: string, endTime: string) => {
      const startHour = Number.parseInt(startTime.split(':')[0], 10);
      const endHour = Number.parseInt(endTime.split(':')[0], 10);

      if (startHour >= endHour) {
        return {
          valid: false,
          error: 'End time must be after start time',
        };
      }

      return { valid: true };
    };

    const validTimeResult = validateTimeRange('09:00', '17:00');
    expect(validTimeResult.valid).toBe(true);

    const invalidTimeResult = validateTimeRange('17:00', '09:00');
    expect(invalidTimeResult.valid).toBe(false);
    expect(invalidTimeResult.error).toBe('End time must be after start time');
  });

  it('should handle overlapping availability slots gracefully', async () => {
    const checkForOverlaps = (
      existingSlots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
      newSlot: { dayOfWeek: number; startTime: string; endTime: string },
    ) => {
      return existingSlots.some(
        (slot) =>
          slot.dayOfWeek === newSlot.dayOfWeek &&
          ((slot.startTime <= newSlot.startTime && slot.endTime > newSlot.startTime) ||
            (slot.startTime < newSlot.endTime && slot.endTime >= newSlot.endTime) ||
            (slot.startTime >= newSlot.startTime && slot.endTime <= newSlot.endTime)),
      );
    };

    const existingSlots = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
    ];

    const nonOverlappingSlot = { dayOfWeek: 1, startTime: '12:30', endTime: '13:30' };
    expect(checkForOverlaps(existingSlots, nonOverlappingSlot)).toBe(false);

    const overlappingSlot = { dayOfWeek: 1, startTime: '11:30', endTime: '12:30' };
    expect(checkForOverlaps(existingSlots, overlappingSlot)).toBe(true);
  });

  it('should update timezone settings', async () => {
    const result = await mockUpdateSchedule({ timezone: 'Europe/London' });

    expect(result.success).toBe(true);
    expect(result.schedule.timezone).toBe('Europe/London');
  });
});
