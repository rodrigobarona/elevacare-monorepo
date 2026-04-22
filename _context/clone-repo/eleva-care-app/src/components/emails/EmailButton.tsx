import * as React from 'react';
import { Button } from '@react-email/components';

export interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

/**
 * Shared Email Button Component for Eleva Care
 * Provides consistent styling and variants across all email templates
 */
export function EmailButton({
  href,
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  style = {},
}: EmailButtonProps) {
  // Size configurations
  const sizeStyles = {
    sm: {
      fontSize: '14px',
      padding: '8px 16px',
      borderRadius: '6px',
    },
    md: {
      fontSize: '16px',
      padding: '12px 24px',
      borderRadius: '8px',
    },
    lg: {
      fontSize: '18px',
      padding: '16px 32px',
      borderRadius: '10px',
    },
  };

  // Variant configurations
  const variantStyles = {
    primary: {
      backgroundColor: '#006D77',
      color: '#FFFFFF',
      border: '2px solid #006D77',
    },
    secondary: {
      backgroundColor: '#F0FDFF',
      color: '#006D77',
      border: '2px solid #006D77',
    },
    outline: {
      backgroundColor: 'transparent',
      color: '#006D77',
      border: '2px solid #006D77',
    },
    danger: {
      backgroundColor: '#EF4444',
      color: '#FFFFFF',
      border: '2px solid #EF4444',
    },
  };

  const buttonStyles = {
    ...sizeStyles[size],
    ...variantStyles[variant],
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: '600',
    textDecoration: 'none',
    display: 'inline-block',
    textAlign: 'center' as const,
    lineHeight: '1.2',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    width: fullWidth ? '100%' : 'auto',
    ...style,
  };

  return (
    <Button href={href} style={buttonStyles}>
      {children}
    </Button>
  );
}
