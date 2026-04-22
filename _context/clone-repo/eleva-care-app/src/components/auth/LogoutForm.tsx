/**
 * LogoutForm Component
 *
 * Server action logout form for use in Server Components.
 * Provides CSRF protection via form submission.
 *
 * Usage:
 * ```tsx
 * <LogoutForm />
 * // or with custom button
 * <LogoutForm>
 *   <CustomButton>Sign Out</CustomButton>
 * </LogoutForm>
 * ```
 */
import { Button } from '@/components/ui/button';
import { signOut } from '@workos-inc/authkit-nextjs';
import { LogOut } from 'lucide-react';

interface LogoutFormProps {
  children?: React.ReactNode;
  /**
   * Button variant
   * @default 'ghost'
   */
  variant?: 'default' | 'destructive' | 'destructiveGhost' | 'outline' | 'secondary' | 'ghost' | 'link';
  /**
   * Button size
   * @default 'default'
   */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /**
   * Additional className
   */
  className?: string;
}

/**
 * LogoutForm - Server Component Logout Form
 *
 * Uses server actions for secure logout with CSRF protection.
 * Best for Server Components.
 *
 * @example
 * ```tsx
 * // In a Server Component
 * export default function Header() {
 *   return (
 *     <header>
 *       <LogoutForm />
 *     </header>
 *   );
 * }
 * ```
 */
export function LogoutForm({
  children,
  variant = 'ghost',
  size = 'default',
  className,
}: LogoutFormProps) {
  return (
    <form
      action={async () => {
        'use server';
        await signOut();
      }}
    >
      {children ? (
        children
      ) : (
        <Button type="submit" variant={variant} size={size} className={className}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      )}
    </form>
  );
}
