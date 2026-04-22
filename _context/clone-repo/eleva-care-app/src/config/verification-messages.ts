import {
  NOTIFICATION_TYPE_VERIFICATION_HELP,
  type NotificationType,
} from '@/lib/constants/notifications';

export interface VerificationMessage {
  title: string;
  message: string;
}

export type VerificationErrorType = 'document' | 'selfie' | 'match' | 'general';

export const VERIFICATION_MESSAGES = {
  // Default message when no specific error is provided
  default: {
    title: 'Identity Verification Help',
    message: [
      "We noticed you're having trouble completing your identity verification. Please try again with the following tips:",
      '',
      '• Use a well-lit environment',
      '• Ensure your ID is fully visible',
      '• Remove any coverings or glare from your ID',
      '• Look directly at the camera for selfie verification',
    ].join('\n'),
  },

  // Document-specific issues
  document: {
    title: 'ID Document Issue',
    message: [
      "There was an issue with your ID document. Please ensure it's:",
      '',
      '• Not expired',
      '• Fully visible in the frame',
      '• Free from glare or obstructions',
      '• A supported document type',
    ].join('\n'),
  },

  // Selfie verification issues
  selfie: {
    title: 'Selfie Verification Issue',
    message: [
      'There was an issue with your selfie verification. Please ensure:',
      '',
      "• You're in a well-lit environment",
      '• Looking directly at the camera',
      '• Your face is fully visible',
      '• No sunglasses or other face coverings',
    ].join('\n'),
  },

  // Face match issues
  match: {
    title: 'Photo Matching Issue',
    message: [
      "The system couldn't match your selfie to your ID photo. Please ensure:",
      '',
      '• Both photos are clear and well-lit',
      '• Your face is clearly visible in both',
      '• No significant changes in appearance',
      '• No obstructions in either photo',
    ].join('\n'),
  },
} as const;

/**
 * Get a verification help message based on the error type
 */
export function getVerificationMessage(errorMessage?: string): VerificationMessage {
  // If no specific error, provide general guidance
  if (!errorMessage) {
    return VERIFICATION_MESSAGES.default;
  }

  const errorLower = errorMessage.toLowerCase();

  // More specific document errors
  if (
    errorLower.includes('document') &&
    (errorLower.includes('expired') ||
      errorLower.includes('invalid') ||
      errorLower.includes('unclear') ||
      errorLower.includes('unreadable'))
  ) {
    return VERIFICATION_MESSAGES.document;
  }

  // More specific selfie errors
  if (
    (errorLower.includes('selfie') || errorLower.includes('face')) &&
    (errorLower.includes('quality') ||
      errorLower.includes('blurry') ||
      errorLower.includes('lighting') ||
      errorLower.includes('glare'))
  ) {
    return VERIFICATION_MESSAGES.selfie;
  }

  // More specific match errors
  if (
    errorLower.includes('match') &&
    (errorLower.includes('different') ||
      errorLower.includes('mismatch') ||
      errorLower.includes('inconsistent'))
  ) {
    return VERIFICATION_MESSAGES.match;
  }

  // Default message with the actual error included
  return {
    title: 'Verification Error',
    message: `We encountered an issue with your identity verification: "${errorMessage}". Please try again and ensure you're following all instructions carefully.`,
  };
}

/**
 * Create a notification object for verification help
 */
export function createVerificationHelpNotification(errorMessage?: string): {
  type: NotificationType;
  title: string;
  message: string;
} {
  const { title, message } = getVerificationMessage(errorMessage);
  return {
    type: NOTIFICATION_TYPE_VERIFICATION_HELP,
    title,
    message,
  };
}
