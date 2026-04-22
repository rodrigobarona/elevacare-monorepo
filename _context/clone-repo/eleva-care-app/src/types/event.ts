export interface Event {
  id: string;
  workosUserId: string;
  name: string;
  durationInMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
