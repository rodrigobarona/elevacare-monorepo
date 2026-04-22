# Expert Profile Publishing Feature

This documentation explains the profile publishing feature that allows experts to control the visibility of their profiles on the platform.

## Overview

The publishing feature:

- Allows experts to publish/unpublish their profiles
- Requires all setup steps to be completed before initial publishing
- Shows a clear status indicator in the expert interface
- Handles validation and user feedback

## Implementation Details

### Database Schema

The `profiles` table includes a `published` boolean field that determines if a profile is visible to other users:

```sql
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "published" boolean NOT NULL DEFAULT false;
```

### Components

1. **ProfilePublishToggle**: A UI component that displays the current publication status and allows experts to toggle between published and unpublished states.

2. **ExpertSetupChecklistWrapper**: A wrapper that shows the setup checklist for expert users, helping them complete all required steps before publishing.

### Server Actions

1. **toggleProfilePublication**: Toggles the publication status of a profile:
   - Validates that the user is authenticated and has an expert role
   - Checks if all setup steps are complete before allowing initial publication
   - Updates the profile's published status in the database
   - Revalidates relevant paths to ensure UI updates

2. **checkExpertSetupStatus**: Checks the completion status of all expert setup steps:
   - Verifies profile completion (name, bio, etc.)
   - Checks availability settings
   - Confirms at least one service has been created
   - Verifies identity verification
   - Checks payment account connection

## User Flow

1. Expert completes all required setup steps in the checklist
2. Expert toggles the publish switch on their profile page
3. System validates all steps are complete
4. If validation passes, profile is published and becomes visible
5. Expert can unpublish at any time to hide their profile

## Technical Dependencies

- Clerk for user authentication and metadata storage
- Drizzle ORM for database interactions
- Next.js server actions for secure server-side operations

## Running the Migration

To update your database with the required field, run:

```bash
npm run migrate:profile-published
```

This will:

1. Add the `published` column if it doesn't exist
2. Copy data from the old `isPublished` column if it exists
3. Remove the old column to complete the migration

## Security Considerations

- Only users with expert roles can publish/unpublish profiles
- Server-side validation ensures all setup steps are complete before publishing
- Access to published profiles is controlled through appropriate authorization checks
