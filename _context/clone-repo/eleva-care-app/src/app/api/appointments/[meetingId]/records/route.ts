import { db } from '@/drizzle/db';
import { OrganizationsTable, RecordsTable } from '@/drizzle/schema';
import { logSecurityError } from '@/lib/constants/security';
import { decryptForOrg, encryptForOrg } from '@/lib/integrations/workos/vault';
import { logAuditEvent } from '@/lib/utils/server/audit';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';

const { logger } = Sentry;

const postRecordSchema = z.object({
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const putRecordSchema = z.object({
  recordId: z.string(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Decrypted record shape returned to clients.
 * Failed decryptions are filtered out (not returned with error placeholders).
 */
interface DecryptedRecord {
  id: string;
  orgId: string | null;
  meetingId: string;
  expertId: string;
  guestEmail: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  lastModifiedAt: Date | null;
  version: number;
}

/**
 * Get WorkOS organization ID for Vault encryption
 *
 * Looks up the WorkOS org ID from the internal UUID to use with Vault API.
 *
 * @param internalOrgId - Internal UUID from database
 * @returns WorkOS org ID (format: org_xxx) or null if not found
 */
async function getWorkosOrgId(internalOrgId: string | null): Promise<string | null> {
  if (!internalOrgId) return null;

  const org = await db.query.OrganizationsTable.findFirst({
    where: eq(OrganizationsTable.id, internalOrgId),
    columns: { workosOrgId: true },
  });

  return org?.workosOrgId || null;
}

export async function POST(request: Request, props: { params: Promise<{ meetingId: string }> }) {
  const params = await props.params;
  try {
    const { user } = await withAuth();
    const workosUserId = user?.id;
    if (!workosUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyResult = postRecordSchema.safeParse(await request.json());
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.flatten() },
        { status: 400 },
      );
    }
    const { content, metadata } = bodyResult.data;

    // Verify the meeting belongs to this expert
    const meeting = await db.query.MeetingsTable.findFirst({
      where: ({ id, workosUserId: expertUserId }, { eq, and }) =>
        and(eq(id, params.meetingId), eq(expertUserId, workosUserId)),
    });

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found or unauthorized' }, { status: 404 });
    }

    // Check for legacy meetings without org context (created before org-scoping Phase 5)
    // These cannot create encrypted records until migrated to an organization
    if (!meeting.orgId) {
      logger.warn('Meeting missing orgId - cannot create encrypted record', {
        meetingId: params.meetingId,
      });
      return NextResponse.json(
        {
          error: 'Legacy meeting requires migration',
          code: 'LEGACY_MEETING_NO_ORG',
          message:
            'This meeting was created before organization-scoped encryption was implemented. ' +
            'Please contact support to migrate this meeting to your organization.',
          meetingId: params.meetingId,
        },
        { status: 400 },
      );
    }

    // Get WorkOS org ID for Vault encryption
    const workosOrgId = await getWorkosOrgId(meeting.orgId);
    if (!workosOrgId) {
      logger.error('Organization not found for meeting', {
        meetingId: params.meetingId,
        orgId: meeting.orgId,
      });
      return NextResponse.json(
        { error: 'Organization configuration error', code: 'ORG_NOT_FOUND' },
        { status: 500 },
      );
    }

    // Encrypt the content and metadata using WorkOS Vault
    const vaultEncryptedContent = await encryptForOrg(workosOrgId, content, {
      userId: workosUserId,
      dataType: 'medical_record',
    });

    const vaultEncryptedMetadata = metadata
      ? await encryptForOrg(workosOrgId, JSON.stringify(metadata), {
          userId: workosUserId,
          dataType: 'medical_record',
        })
      : null;

    // Create the record with orgId for RLS
    const [record] = await db
      .insert(RecordsTable)
      .values({
        orgId: meeting.orgId,
        meetingId: params.meetingId,
        expertId: workosUserId,
        guestEmail: meeting.guestEmail,
        vaultEncryptedContent,
        vaultEncryptedMetadata: vaultEncryptedMetadata || undefined,
        encryptionMethod: 'vault',
      })
      .returning();

    // Log audit event (user context automatically extracted)
    try {
      await logAuditEvent('MEDICAL_RECORD_CREATED', 'medical_record', record.id, {
        newValues: {
          recordId: record.id,
          meetingId: params.meetingId,
          expertId: workosUserId,
          guestEmail: meeting.guestEmail,
          contentProvided: !!content,
          metadataProvided: !!metadata,
          encryptionMethod: 'vault',
        },
      });
    } catch (auditError) {
      Sentry.captureException(auditError);
      logger.error('Error logging audit event for MEDICAL_RECORD_CREATED', { error: auditError });
    }

    return NextResponse.json({ success: true, recordId: record.id });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error creating record', { error });
    logSecurityError(error, 'MEDICAL_RECORD_CREATED', 'medical_record', params.meetingId);
    return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
  }
}

export async function GET(request: Request, props: { params: Promise<{ meetingId: string }> }) {
  const params = await props.params;
  try {
    const { user } = await withAuth();
    const workosUserId = user?.id;
    if (!workosUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the meeting belongs to this expert
    const meeting = await db.query.MeetingsTable.findFirst({
      where: ({ id, workosUserId: expertUserId }, { eq, and }) =>
        and(eq(id, params.meetingId), eq(expertUserId, workosUserId)),
    });

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found or unauthorized' }, { status: 404 });
    }

    // Check for legacy meetings without org context (created before org-scoping Phase 5)
    if (!meeting.orgId) {
      logger.warn('Meeting missing orgId - cannot decrypt records', {
        meetingId: params.meetingId,
      });
      return NextResponse.json(
        {
          error: 'Legacy meeting requires migration',
          code: 'LEGACY_MEETING_NO_ORG',
          message:
            'This meeting was created before organization-scoped encryption was implemented. ' +
            'Please contact support to migrate this meeting to your organization.',
          meetingId: params.meetingId,
        },
        { status: 400 },
      );
    }

    // Get WorkOS org ID for Vault decryption
    const workosOrgId = await getWorkosOrgId(meeting.orgId);
    if (!workosOrgId) {
      logger.error('Organization not found for meeting', {
        meetingId: params.meetingId,
        orgId: meeting.orgId,
      });
      return NextResponse.json(
        { error: 'Organization configuration error', code: 'ORG_NOT_FOUND' },
        { status: 500 },
      );
    }

    // Get all records for this meeting
    const records = await db.query.RecordsTable.findMany({
      where: eq(RecordsTable.meetingId, params.meetingId),
      orderBy: (fields, { desc }) => [desc(fields.createdAt)],
    });

    // Decrypt the records using WorkOS Vault
    // Failed decryptions are filtered out (not returned with error placeholders)
    // to avoid information leakage about internal failure modes.
    const decryptionResults = await Promise.all(
      records.map(async (record) => {
        try {
          const content = await decryptForOrg(workosOrgId, record.vaultEncryptedContent, {
            userId: workosUserId,
            dataType: 'medical_record',
            recordId: record.id,
          });

          const metadata = record.vaultEncryptedMetadata
            ? JSON.parse(
                await decryptForOrg(workosOrgId, record.vaultEncryptedMetadata, {
                  userId: workosUserId,
                  dataType: 'medical_record',
                  recordId: record.id,
                }),
              )
            : null;

          // Return typed decrypted record (omit encrypted fields)
          const decryptedRecord: DecryptedRecord = {
            id: record.id,
            orgId: record.orgId,
            meetingId: record.meetingId,
            expertId: record.expertId,
            guestEmail: record.guestEmail,
            content,
            metadata,
            createdAt: record.createdAt,
            lastModifiedAt: record.lastModifiedAt,
            version: record.version,
          };

          return decryptedRecord;
        } catch (decryptError) {
          Sentry.captureException(decryptError);
          logger.error('Failed to decrypt record', {
            recordId: record.id,
            meetingId: params.meetingId,
            error: decryptError instanceof Error ? decryptError.message : 'Unknown',
          });
          return null;
        }
      }),
    );

    // Filter out failed decryptions (null values)
    const decryptedRecords = decryptionResults.filter((r): r is DecryptedRecord => r !== null);
    const failedCount = records.length - decryptedRecords.length;

    // Log audit event (user context automatically extracted)
    try {
      await logAuditEvent('MEDICAL_RECORD_VIEWED', 'medical_record', params.meetingId, undefined, {
        meetingId: params.meetingId,
        expertId: workosUserId,
        recordsFetched: decryptedRecords.length,
        recordIds: decryptedRecords.map((r) => r.id),
        // Include failure stats in audit (internal only)
        totalRecords: records.length,
        failedDecryptions: failedCount,
      });
    } catch (auditError) {
      Sentry.captureException(auditError);
      logger.error('Error logging audit event for MEDICAL_RECORD_VIEWED', { error: auditError });
    }

    // Return records with metadata about the response
    return NextResponse.json({
      records: decryptedRecords,
      meta: {
        total: records.length,
        returned: decryptedRecords.length,
        failed: failedCount,
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error fetching records', { error });
    logSecurityError(error, 'MEDICAL_RECORD_VIEWED', 'medical_record', params.meetingId);
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
  }
}

export async function PUT(request: Request, props: { params: Promise<{ meetingId: string }> }) {
  const params = await props.params;
  try {
    const { user } = await withAuth();
    const workosUserId = user?.id;
    if (!workosUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyResult = putRecordSchema.safeParse(await request.json());
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.flatten() },
        { status: 400 },
      );
    }
    const { recordId, content, metadata } = bodyResult.data;

    // Verify the record belongs to this expert and retrieve its current state for audit logging
    const oldRecord = await db.query.RecordsTable.findFirst({
      where: ({ id, expertId, meetingId }, { eq, and }) =>
        and(eq(id, recordId), eq(expertId, workosUserId), eq(meetingId, params.meetingId)),
    });

    if (!oldRecord) {
      return NextResponse.json({ error: 'Record not found or unauthorized' }, { status: 404 });
    }

    // Check for legacy records without org context (created before org-scoping Phase 5)
    // These cannot be updated with encryption until migrated to an organization
    if (!oldRecord.orgId) {
      logger.warn('Record missing orgId - cannot update with encryption', { recordId });
      return NextResponse.json(
        {
          error: 'Legacy record requires migration',
          code: 'LEGACY_RECORD_NO_ORG',
          message:
            'This record was created before organization-scoped encryption was implemented. ' +
            'Please contact support to migrate this record to your organization.',
          recordId,
        },
        { status: 400 },
      );
    }

    // Get WorkOS org ID for Vault encryption
    const workosOrgId = await getWorkosOrgId(oldRecord.orgId);
    if (!workosOrgId) {
      logger.error('Organization not found for record', {
        recordId,
        orgId: oldRecord.orgId,
      });
      return NextResponse.json(
        { error: 'Organization configuration error', code: 'ORG_NOT_FOUND' },
        { status: 500 },
      );
    }

    // Encrypt the updated content and metadata using WorkOS Vault
    const newVaultEncryptedContent = await encryptForOrg(workosOrgId, content, {
      userId: workosUserId,
      dataType: 'medical_record',
      recordId,
    });

    const newVaultEncryptedMetadata = metadata
      ? await encryptForOrg(workosOrgId, JSON.stringify(metadata), {
          userId: workosUserId,
          dataType: 'medical_record',
          recordId,
        })
      : null;

    // Update the record
    const [updatedRecord] = await db
      .update(RecordsTable)
      .set({
        vaultEncryptedContent: newVaultEncryptedContent,
        vaultEncryptedMetadata: newVaultEncryptedMetadata || undefined,
        lastModifiedAt: new Date(),
        version: oldRecord.version + 1,
      })
      .where(eq(RecordsTable.id, recordId))
      .returning();

    // Log audit event with field-level change tracking for HIPAA/21 CFR Part 11 compliance.
    // We track WHICH fields changed (without logging actual PHI content) to satisfy
    // audit trail requirements for medical record modifications.
    try {
      await logAuditEvent('MEDICAL_RECORD_UPDATED', 'medical_record', recordId, {
        oldValues: {
          version: oldRecord.version,
          // Track if encrypted content existed before (not the content itself)
          hadContent: !!oldRecord.vaultEncryptedContent,
          hadMetadata: !!oldRecord.vaultEncryptedMetadata,
        },
        newValues: {
          version: updatedRecord.version,
          recordId: updatedRecord.id,
          meetingId: params.meetingId,
          expertId: workosUserId,
          // Field-level change indicators (HIPAA compliance: document what changed)
          contentModified: !!content, // True if content was part of update payload
          metadataModified: !!metadata, // True if metadata was part of update payload
          encryptionMethod: 'vault',
        },
      });
    } catch (auditError) {
      Sentry.captureException(auditError);
      logger.error('Error logging audit event for MEDICAL_RECORD_UPDATED', { error: auditError });
    }

    return NextResponse.json({ success: true, recordId: updatedRecord.id });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error updating record', { error });
    logSecurityError(error, 'MEDICAL_RECORD_UPDATED', 'medical_record', params.meetingId);
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
  }
}
