'use server';

import * as Sentry from '@sentry/nextjs';
import { db } from '@/drizzle/db';
import {
  EventsTable,
  MeetingsTable,
  ProfilesTable,
  TransactionCommissionsTable,
} from '@/drizzle/schema';
import { and, count, countDistinct, desc, eq, gt, gte, lt, sql, sum } from 'drizzle-orm';

const { logger } = Sentry;

// ============================================================================
// Types
// ============================================================================

export interface DashboardMeeting {
  id: string;
  eventName: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  meetingUrl: string | null;
  guestName: string;
  guestEmail: string;
  expertFirstName: string | null;
  expertLastName: string | null;
}

export interface PatientStats {
  upcomingSessions: number;
  totalBookings: number;
  uniqueExperts: number;
  nextAppointment: {
    eventName: string;
    expertName: string;
    startTime: Date;
  } | null;
}

export interface ExpertStats {
  upcomingSessions: number;
  totalSessions: number;
  sessionsThisMonth: number;
  uniquePatients: number;
}

export interface ExpertEarnings {
  totalNetEarnings: number;
  monthlyNetEarnings: number;
  pendingCommissions: number;
  currency: string;
}

// ============================================================================
// Shared: Upcoming & Recent Meetings
// ============================================================================

export async function getUpcomingMeetings(
  workosUserId: string,
  role: 'patient' | 'expert',
  limit = 5,
): Promise<DashboardMeeting[]> {
  return Sentry.withServerActionInstrumentation(
    'dashboard.getUpcomingMeetings',
    { recordResponse: true },
    async () => {
      try {
        const now = new Date();
        const whereCondition =
          role === 'expert'
            ? and(eq(MeetingsTable.workosUserId, workosUserId), gt(MeetingsTable.startTime, now))
            : and(eq(MeetingsTable.guestWorkosUserId, workosUserId), gt(MeetingsTable.startTime, now));

        const meetings = await db
          .select({
            id: MeetingsTable.id,
            eventName: EventsTable.name,
            startTime: MeetingsTable.startTime,
            endTime: MeetingsTable.endTime,
            timezone: MeetingsTable.timezone,
            meetingUrl: MeetingsTable.meetingUrl,
            guestName: MeetingsTable.guestName,
            guestEmail: MeetingsTable.guestEmail,
            expertFirstName: ProfilesTable.firstName,
            expertLastName: ProfilesTable.lastName,
          })
          .from(MeetingsTable)
          .innerJoin(EventsTable, eq(MeetingsTable.eventId, EventsTable.id))
          .leftJoin(ProfilesTable, eq(MeetingsTable.workosUserId, ProfilesTable.workosUserId))
          .where(whereCondition)
          .orderBy(MeetingsTable.startTime)
          .limit(limit);

        return meetings;
      } catch (error) {
        logger.error('Failed to fetch upcoming meetings', { error, workosUserId, role });
        return [];
      }
    },
  );
}

export async function getRecentMeetings(
  workosUserId: string,
  role: 'patient' | 'expert',
  limit = 5,
): Promise<DashboardMeeting[]> {
  return Sentry.withServerActionInstrumentation(
    'dashboard.getRecentMeetings',
    { recordResponse: true },
    async () => {
      try {
        const now = new Date();
        const whereCondition =
          role === 'expert'
            ? and(eq(MeetingsTable.workosUserId, workosUserId), lt(MeetingsTable.startTime, now))
            : and(eq(MeetingsTable.guestWorkosUserId, workosUserId), lt(MeetingsTable.startTime, now));

        const meetings = await db
          .select({
            id: MeetingsTable.id,
            eventName: EventsTable.name,
            startTime: MeetingsTable.startTime,
            endTime: MeetingsTable.endTime,
            timezone: MeetingsTable.timezone,
            meetingUrl: MeetingsTable.meetingUrl,
            guestName: MeetingsTable.guestName,
            guestEmail: MeetingsTable.guestEmail,
            expertFirstName: ProfilesTable.firstName,
            expertLastName: ProfilesTable.lastName,
          })
          .from(MeetingsTable)
          .innerJoin(EventsTable, eq(MeetingsTable.eventId, EventsTable.id))
          .leftJoin(ProfilesTable, eq(MeetingsTable.workosUserId, ProfilesTable.workosUserId))
          .where(whereCondition)
          .orderBy(desc(MeetingsTable.startTime))
          .limit(limit);

        return meetings;
      } catch (error) {
        logger.error('Failed to fetch recent meetings', { error, workosUserId, role });
        return [];
      }
    },
  );
}

// ============================================================================
// Patient: Booking Summary
// ============================================================================

export async function getPatientStats(workosUserId: string): Promise<PatientStats> {
  return Sentry.withServerActionInstrumentation(
    'dashboard.getPatientStats',
    { recordResponse: true },
    async () => {
      try {
        const now = new Date();

        const [statsResult, nextAppointment] = await Promise.all([
          db
            .select({
              totalBookings: count(),
              upcomingSessions: count(
                sql`CASE WHEN ${MeetingsTable.startTime} > ${now} THEN 1 END`,
              ),
              uniqueExperts: countDistinct(MeetingsTable.workosUserId),
            })
            .from(MeetingsTable)
            .where(eq(MeetingsTable.guestWorkosUserId, workosUserId)),

          db
            .select({
              eventName: EventsTable.name,
              expertFirstName: ProfilesTable.firstName,
              expertLastName: ProfilesTable.lastName,
              startTime: MeetingsTable.startTime,
            })
            .from(MeetingsTable)
            .innerJoin(EventsTable, eq(MeetingsTable.eventId, EventsTable.id))
            .leftJoin(ProfilesTable, eq(MeetingsTable.workosUserId, ProfilesTable.workosUserId))
            .where(
              and(
                eq(MeetingsTable.guestWorkosUserId, workosUserId),
                gt(MeetingsTable.startTime, now),
              ),
            )
            .orderBy(MeetingsTable.startTime)
            .limit(1),
        ]);

        const stats = statsResult[0];
        const next = nextAppointment[0];

        return {
          upcomingSessions: Number(stats?.upcomingSessions ?? 0),
          totalBookings: Number(stats?.totalBookings ?? 0),
          uniqueExperts: Number(stats?.uniqueExperts ?? 0),
          nextAppointment: next
            ? {
                eventName: next.eventName,
                expertName: [next.expertFirstName, next.expertLastName].filter(Boolean).join(' ') || 'Expert',
                startTime: next.startTime,
              }
            : null,
        };
      } catch (error) {
        logger.error('Failed to fetch patient stats', { error, workosUserId });
        return {
          upcomingSessions: 0,
          totalBookings: 0,
          uniqueExperts: 0,
          nextAppointment: null,
        };
      }
    },
  );
}

// ============================================================================
// Expert: Session Stats
// ============================================================================

export async function getExpertStats(workosUserId: string): Promise<ExpertStats> {
  return Sentry.withServerActionInstrumentation(
    'dashboard.getExpertStats',
    { recordResponse: true },
    async () => {
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [statsResult] = await Promise.all([
          db
            .select({
              totalSessions: count(),
              upcomingSessions: count(
                sql`CASE WHEN ${MeetingsTable.startTime} > ${now} THEN 1 END`,
              ),
              sessionsThisMonth: count(
                sql`CASE WHEN ${MeetingsTable.startTime} >= ${startOfMonth} THEN 1 END`,
              ),
              uniquePatients: countDistinct(MeetingsTable.guestWorkosUserId),
            })
            .from(MeetingsTable)
            .where(eq(MeetingsTable.workosUserId, workosUserId)),
        ]);

        const stats = statsResult[0];

        return {
          upcomingSessions: Number(stats?.upcomingSessions ?? 0),
          totalSessions: Number(stats?.totalSessions ?? 0),
          sessionsThisMonth: Number(stats?.sessionsThisMonth ?? 0),
          uniquePatients: Number(stats?.uniquePatients ?? 0),
        };
      } catch (error) {
        logger.error('Failed to fetch expert stats', { error, workosUserId });
        return {
          upcomingSessions: 0,
          totalSessions: 0,
          sessionsThisMonth: 0,
          uniquePatients: 0,
        };
      }
    },
  );
}

// ============================================================================
// Expert: Earnings Overview
// ============================================================================

export async function getExpertEarnings(workosUserId: string): Promise<ExpertEarnings> {
  return Sentry.withServerActionInstrumentation(
    'dashboard.getExpertEarnings',
    { recordResponse: true },
    async () => {
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [allTimeResult, monthlyResult, pendingResult] = await Promise.all([
          db
            .select({ totalNet: sum(TransactionCommissionsTable.netAmount) })
            .from(TransactionCommissionsTable)
            .where(
              and(
                eq(TransactionCommissionsTable.workosUserId, workosUserId),
                eq(TransactionCommissionsTable.status, 'processed'),
              ),
            ),

          db
            .select({ monthlyNet: sum(TransactionCommissionsTable.netAmount) })
            .from(TransactionCommissionsTable)
            .where(
              and(
                eq(TransactionCommissionsTable.workosUserId, workosUserId),
                eq(TransactionCommissionsTable.status, 'processed'),
                gte(TransactionCommissionsTable.createdAt, startOfMonth),
              ),
            ),

          db
            .select({ pendingAmount: sum(TransactionCommissionsTable.netAmount) })
            .from(TransactionCommissionsTable)
            .where(
              and(
                eq(TransactionCommissionsTable.workosUserId, workosUserId),
                eq(TransactionCommissionsTable.status, 'pending'),
              ),
            ),
        ]);

        return {
          totalNetEarnings: Number(allTimeResult[0]?.totalNet ?? 0),
          monthlyNetEarnings: Number(monthlyResult[0]?.monthlyNet ?? 0),
          pendingCommissions: Number(pendingResult[0]?.pendingAmount ?? 0),
          currency: 'eur',
        };
      } catch (error) {
        logger.error('Failed to fetch expert earnings', { error, workosUserId });
        return {
          totalNetEarnings: 0,
          monthlyNetEarnings: 0,
          pendingCommissions: 0,
          currency: 'eur',
        };
      }
    },
  );
}
