-- Migration: Add Google OAuth token storage columns
-- Date: 2025-11-06
-- Description: Adds columns to store Google OAuth tokens obtained via WorkOS OAuth
--              Enables Google Calendar integration without Clerk dependency
--              Tokens are ENCRYPTED using AES-256-GCM (same as medical records)

-- Add Google OAuth columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMP,
ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS google_calendar_connected_at TIMESTAMP;

-- Add index for quick lookup of users with Google Calendar connected
CREATE INDEX IF NOT EXISTS idx_users_google_calendar_connected 
ON users(google_calendar_connected) 
WHERE google_calendar_connected = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN users.google_access_token IS '🔐 ENCRYPTED Google OAuth access token using AES-256-GCM. Stores JSON: {encryptedContent, iv, tag}. Uses lib/utils/encryption.ts (same as medical records).';
COMMENT ON COLUMN users.google_refresh_token IS '🔐 ENCRYPTED Google OAuth refresh token using AES-256-GCM. Long-lived and HIGHLY SENSITIVE. Never expose or log. Same encryption as medical records.';
COMMENT ON COLUMN users.google_token_expiry IS 'Expiration timestamp for the Google access token (NOT encrypted - not sensitive)';
COMMENT ON COLUMN users.google_calendar_connected IS 'Whether user has connected Google Calendar via WorkOS OAuth';
COMMENT ON COLUMN users.google_calendar_connected_at IS 'Timestamp when Google Calendar was first connected';

-- Security Note:
-- All token columns use application-level encryption (AES-256-GCM) via lib/utils/encryption.ts
-- Requires ENCRYPTION_KEY environment variable (same key used for medical records)
-- This provides HIPAA/GDPR-compliant encryption at rest

