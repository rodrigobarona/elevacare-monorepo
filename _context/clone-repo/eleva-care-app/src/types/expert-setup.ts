/**
 * Expert Setup Types
 *
 * Type definitions for expert onboarding progress.
 * Separated from server actions to comply with "use server" directive.
 */
import { z } from 'zod';

/**
 * Valid setup step names
 */
export const SetupStep = z.enum([
  'profile',
  'availability',
  'events',
  'identity',
  'payment',
  'google_account',
]);

export type SetupStepType = z.infer<typeof SetupStep>;

/**
 * Setup status interface
 */
export interface SetupStatus {
  profile: boolean;
  availability: boolean;
  events: boolean;
  identity: boolean;
  payment: boolean;
  google_account: boolean;
}

/**
 * Setup statistics interface
 */
export interface SetupStats {
  total: number;
  complete: number;
  incomplete: number;
  completionRate: number;
  averageStepsCompleted: number;
}
