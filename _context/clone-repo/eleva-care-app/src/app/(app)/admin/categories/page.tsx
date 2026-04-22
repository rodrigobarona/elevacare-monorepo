/**
 * Admin Categories Page
 *
 * Admin-only page for managing expert profile categories.
 * Allows creating, editing, and organizing categories and subcategories.
 *
 * Authorization: Requires superadmin role (enforced by admin layout + proxy)
 */
import { CategoryList } from '@/components/features/categories/CategoryList';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Categories Management',
  description: 'Manage categories and subcategories for expert profiles',
};

/**
 * Categories management page for administrators
 *
 * @returns Category management interface with create/edit/delete functionality
 */
export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories Management</h1>
        <p className="text-sm text-muted-foreground">
          Create, edit, and organize categories and subcategories for expert profiles.
        </p>
      </div>
      <CategoryList />
    </div>
  );
}
