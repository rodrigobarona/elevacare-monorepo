/**
 * Customer utilities for consistent customer ID generation across the application
 * This ensures that customer IDs are generated consistently between frontend components and APIs
 */

/**
 * Simple hash function to replace crypto dependency
 * Creates a deterministic hash from input string
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to positive hex string and pad to 8 characters
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Extended hash function that creates a 12-character hash
 */
function extendedHash(str: string): string {
  // Get hash of original string
  const hash1 = simpleHash(str);
  // Get hash of reversed string for additional entropy
  const hash2 = simpleHash(str.split('').reverse().join(''));
  // Combine and take first 12 characters
  return (hash1 + hash2).substring(0, 12);
}

/**
 * Generates a consistent, secure customer ID based on user ID and guest email
 * This function should be used anywhere customer IDs need to be generated or matched
 *
 * @param userId - The WorkOS user ID of the expert/practitioner
 * @param guestEmail - The email address of the guest/patient
 * @returns A secure, deterministic 12-character customer ID
 */
export function generateCustomerId(userId: string, guestEmail: string): string {
  if (!userId || !guestEmail) {
    throw new Error('Both userId and guestEmail are required to generate customer ID');
  }

  // Normalize email to lowercase and trim whitespace for consistency
  const normalizedEmail = guestEmail.toLowerCase().trim();

  // Create a seed using the user ID and normalized email
  const customerIdSeed = `${userId}-${normalizedEmail}`;

  // Generate hash using extended hash function
  const customerId = extendedHash(customerIdSeed);

  return customerId;
}

/**
 * Finds the email address that corresponds to a given customer ID
 * This is the reverse operation of generateCustomerId
 *
 * @param userId - The WorkOS user ID of the expert/practitioner
 * @param customerId - The customer ID to find the email for
 * @param emailList - Array of email addresses to check against
 * @returns The email address that matches the customer ID, or null if not found
 */
export function findEmailByCustomerId(
  userId: string,
  customerId: string,
  emailList: string[],
): string | null {
  if (!userId || !customerId || !Array.isArray(emailList)) {
    return null;
  }

  // Check each email to see if it generates the target customer ID
  for (const email of emailList) {
    try {
      const generatedId = generateCustomerId(userId, email);
      if (generatedId === customerId) {
        return email;
      }
    } catch {
      // Skip invalid emails by continuing to next iteration
    }
  }

  return null;
}

/**
 * Validates if a customer ID has the correct format
 * Customer IDs should be exactly 12 alphanumeric characters
 *
 * @param customerId - The customer ID to validate
 * @returns True if the customer ID is valid, false otherwise
 */
export function isValidCustomerId(customerId: string): boolean {
  if (!customerId || typeof customerId !== 'string') {
    return false;
  }

  // Customer IDs should be exactly 12 alphanumeric characters
  return /^[a-zA-Z0-9]{12}$/.test(customerId);
}
