import * as Sentry from '@sentry/nextjs';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { z } from 'zod';

const { logger } = Sentry;
import { del, put } from '@vercel/blob';
import { checkBotId } from 'botid/server';
import { NextResponse } from 'next/server';

const folderSchema = z.enum(['general', 'profiles', 'medical-images', 'categories']);

/**
 * Handles file uploads to Vercel Blob storage
 *
 * @param request Request object
 * @returns NextResponse with the uploaded file URL
 *
 * Query parameters:
 * - filename: The name of the file to upload (required)
 * - folder: The folder to upload to (default: 'general')
 * - addRandomSuffix: Whether to add a random suffix to the filename (default: true)
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // 🛡️ BotID Protection: Check for bot traffic before processing file uploads
    const botVerification = (await checkBotId({
      advancedOptions: {
        checkLevel: 'basic', // Free on all Vercel plans including Hobby
      },
    })) as import('@/types/botid').BotIdVerificationResult;

    if (botVerification.isBot) {
      logger.warn('Bot detected in file upload', {
        isVerifiedBot: botVerification.isVerifiedBot,
        verifiedBotName: botVerification.verifiedBotName,
      });

      return NextResponse.json(
        {
          error: 'Access denied',
          message: 'Automated file uploads are not allowed',
        },
        { status: 403 },
      );
    }

    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const folderParam = searchParams.get('folder') || 'general';
    const addRandomSuffix = searchParams.get('addRandomSuffix') !== 'false'; // Default to true

    const folderResult = folderSchema.safeParse(folderParam);
    if (!folderResult.success) {
      return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
    }
    const folder = folderResult.data;

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    if (!request.body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    // Sanitize folder path to ensure it ends with a slash
    const sanitizedFolder = folder.endsWith('/') ? folder : `${folder}/`;
    const blobFilename = `${sanitizedFolder}${filename}`;

    const blob = await put(blobFilename, request.body, {
      access: 'public',
      addRandomSuffix,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      success: true,
    });
  } catch (error) {
    logger.error('Error uploading file', { error: error instanceof Error ? error.message : String(error) });
    Sentry.captureException(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error', success: false },
      { status: 500 },
    );
  }
}

/**
 * Handles file deletion from Vercel Blob storage
 *
 * @param request Request object
 * @returns NextResponse with status 204 if successful
 *
 * Query parameters:
 * - url: The URL of the file to delete (required)
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const { user } = await withAuth();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    await del(url);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error deleting file', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}
