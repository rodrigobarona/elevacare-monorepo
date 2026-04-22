import type { WorkOSRole } from '@/types/workos-rbac';

export interface ApiResponse<T> {
  success?: boolean;
  error?: string;
  message?: string;
  data?: T;
}

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: WorkOSRole;
}

export interface UpdateRoleRequest {
  userId: string;
  role: WorkOSRole;
}
