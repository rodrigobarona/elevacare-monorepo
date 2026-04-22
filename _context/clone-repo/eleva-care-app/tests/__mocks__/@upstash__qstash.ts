// Mock for @upstash/qstash to prevent jose ESM parsing issues in Jest

interface ScheduleResponse {
  scheduleId: string;
  destination?: string;
  cron?: string;
}

interface PublishResponse {
  messageId: string;
  deduplicated: boolean;
}

interface ListSchedulesResponse {
  cursor: null | string;
  schedules: ScheduleResponse[];
}

export class Client {
  public schedules: {
    create: (_opts: unknown) => Promise<ScheduleResponse>;
    delete: (_scheduleId: string) => Promise<boolean>;
    get: (scheduleId: string) => Promise<ScheduleResponse>;
    list: () => Promise<ListSchedulesResponse>;
  };

  constructor(_config?: unknown) {
    this.schedules = {
      create: async (_opts: unknown) => ({
        scheduleId: 'mock-schedule-id',
      }),
      delete: async (_scheduleId: string) => true,
      get: async (scheduleId: string) => ({
        scheduleId,
        destination: 'mock-destination',
        cron: '0 0 * * *',
      }),
      list: async () => ({
        cursor: null,
        schedules: [],
      }),
    };
  }

  async publishJSON(_opts: unknown): Promise<PublishResponse> {
    return {
      messageId: 'mock-message-id',
      deduplicated: false,
    };
  }

  async publish(_opts: unknown): Promise<PublishResponse> {
    return {
      messageId: 'mock-message-id',
      deduplicated: false,
    };
  }
}

export class Receiver {
  constructor(_config?: unknown) {}

  async verify(_opts: { signature: string; body: string; url?: string }): Promise<boolean> {
    // Mock verification - always return true for tests
    return true;
  }
}

const qstashMock = {
  Client,
  Receiver,
};

export default qstashMock;
