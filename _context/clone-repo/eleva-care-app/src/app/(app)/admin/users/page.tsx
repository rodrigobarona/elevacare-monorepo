/**
 * Admin Users Page
 *
 * Admin-only page for managing user roles.
 * Displays a table of users with role selection.
 *
 * Authorization: Requires superadmin role (enforced by admin layout + proxy)
 */
import { UserRoleManager } from '@/components/features/admin/UserRoleManager';

/**
 * User management page for administrators
 *
 * @returns User role management interface
 */
export default function AdminUsersPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-2xl font-bold">User Role Management</h1>
      <UserRoleManager />
    </div>
  );
}
