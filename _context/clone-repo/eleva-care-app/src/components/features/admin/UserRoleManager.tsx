'use client';

/**
 * User Role Manager Component
 *
 * Admin component for managing user roles via a data table.
 * Features:
 * - Displays users with email, name, and current role
 * - Inline role selection with dropdown
 * - Optimistic updates with toast notifications
 * - Superadmin-only role assignment restrictions
 *
 * @requires superadmin role to access
 */
import { DataTable } from '@/components/shared/data-table/DataTable';
import { useAuthorization } from '@/components/shared/providers/AuthorizationProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLES, updateUserRole } from '@/lib/auth/roles';
import { WORKOS_ROLE_DISPLAY_NAMES, WORKOS_ROLES, type WorkOSRole } from '@/types/workos-rbac';
import type { ColumnDef } from '@tanstack/react-table';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  name: string;
  role: WorkOSRole;
}

interface RoleSelectorProps {
  user: User;
  isSuperAdmin: boolean;
  isLoading: boolean;
  onRoleUpdate: (userId: string, newRole: WorkOSRole) => Promise<WorkOSRole>;
}

/**
 * Extracted RoleSelector component to prevent recreation on each parent render.
 * Uses useEffect to sync selectedRole when user.role changes externally.
 */
function RoleSelector({ user, isSuperAdmin, isLoading, onRoleUpdate }: RoleSelectorProps) {
  const [selectedRole, setSelectedRole] = useState<WorkOSRole>(user.role);
  const [isPending, setIsPending] = useState(false);

  // Sync selectedRole when user.role changes (e.g., after another update)
  useEffect(() => {
    setSelectedRole(user.role);
  }, [user.role]);

  const handleRoleChange = async (newRole: WorkOSRole) => {
    setSelectedRole(newRole);
    setIsPending(true);
    try {
      await onRoleUpdate(user.id, newRole);
    } catch {
      // Reset to original value on error
      setSelectedRole(user.role);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Select
      value={selectedRole}
      onValueChange={(value) => handleRoleChange(value as WorkOSRole)}
      disabled={isPending || isLoading}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((role) => (
          <SelectItem
            key={role}
            value={role}
            disabled={role === WORKOS_ROLES.SUPERADMIN && !isSuperAdmin}
          >
            {WORKOS_ROLE_DISPLAY_NAMES[role] || role}
            {role === WORKOS_ROLES.SUPERADMIN && !isSuperAdmin && ' (Requires superadmin)'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function UserRoleManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { roles: currentUserRoles } = useAuthorization();
  const isSuperAdmin = currentUserRoles.includes(WORKOS_ROLES.SUPERADMIN);

  // Stable callback reference using useCallback
  const handleRoleUpdate = useCallback(async (userId: string, newRole: WorkOSRole) => {
    const promise = (async () => {
      const result = await updateUserRole(userId, newRole);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Refresh the users list after successful update
      let response: Response;
      try {
        response = await fetch('/api/admin/users');
      } catch (networkError) {
        throw new Error(
          networkError instanceof Error ? networkError.message : 'Network error fetching users',
        );
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch updated user list');
      }
      setUsers(data.data.users);
      return newRole;
    })();

    toast.promise(promise, {
      loading: 'Updating role...',
      success: () => `Role successfully updated to ${newRole}`,
      error: (err: unknown) => (err instanceof Error ? err.message : 'Failed to update role'),
    });

    return promise;
  }, []);

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      id: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <RoleSelector
          user={row.original}
          isSuperAdmin={isSuperAdmin}
          isLoading={isLoading}
          onRoleUpdate={handleRoleUpdate}
        />
      ),
    },
  ];

  useEffect(() => {
    const fetchUsers = async () => {
      const promise = fetch('/api/admin/users').then(async (response) => {
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch users');
        }
        setUsers(data.data.users);
        return data;
      });

      toast.promise(promise, {
        loading: 'Loading users...',
        success: 'Users loaded successfully',
        error: (err: unknown) => (err instanceof Error ? err.message : 'Failed to fetch users'),
      });

      return promise;
    };

    setIsLoading(true);
    fetchUsers()
      .catch((error) => {
        console.error('Failed to fetch users:', error);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div>
      <DataTable columns={columns} data={users} />
    </div>
  );
}
