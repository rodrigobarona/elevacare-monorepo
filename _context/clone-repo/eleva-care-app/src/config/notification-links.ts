/**
 * Notification Link Mapping Configuration
 *
 * This file centralizes all notification action links and CTAs for Novu workflows.
 * It provides type-safe link generation for different notification types and contexts.
 */

export interface NotificationAction {
  label: string;
  redirect: {
    url: string;
    target: '_self' | '_blank';
  };
}

export interface NotificationLinks {
  redirect?: {
    url: string;
    target: '_self' | '_blank';
  };
  primaryAction?: NotificationAction;
  secondaryAction?: NotificationAction;
}

// ============================================================================
// USER LIFECYCLE LINKS
// ============================================================================

export const getUserLifecycleLinks = (
  userSegment: 'patient' | 'expert' | 'admin' = 'patient',
): NotificationLinks => {
  const expertLinks: NotificationLinks = {
    redirect: { url: '/setup', target: '_self' },
    primaryAction: {
      label: 'Complete Setup',
      redirect: { url: '/setup', target: '_self' },
    },
    secondaryAction: {
      label: 'View Dashboard',
      redirect: { url: '/dashboard', target: '_self' },
    },
  };

  const patientLinks: NotificationLinks = {
    redirect: { url: '/dashboard', target: '_self' },
    primaryAction: {
      label: 'Complete Profile',
      redirect: { url: '/account/profile', target: '_self' },
    },
    secondaryAction: {
      label: 'Browse Experts',
      redirect: { url: '/experts', target: '_self' },
    },
  };

  const adminLinks: NotificationLinks = {
    redirect: { url: '/admin/dashboard', target: '_self' },
    primaryAction: {
      label: 'Admin Dashboard',
      redirect: { url: '/admin/dashboard', target: '_self' },
    },
    secondaryAction: {
      label: 'System Health',
      redirect: { url: '/admin/health', target: '_self' },
    },
  };

  switch (userSegment) {
    case 'expert':
      return expertLinks;
    case 'admin':
      return adminLinks;
    default:
      return patientLinks;
  }
};

// ============================================================================
// SECURITY & AUTHENTICATION LINKS
// ============================================================================

export const getSecurityLinks = (alertType: string = 'security-event'): NotificationLinks => {
  const baseSecurityLinks: NotificationLinks = {
    redirect: { url: '/account/security', target: '_self' },
    primaryAction: {
      label: 'Review Security',
      redirect: { url: '/account/security', target: '_self' },
    },
    secondaryAction: {
      label: 'Change Password',
      redirect: { url: '/account/security/password', target: '_self' },
    },
  };

  const loginAlertLinks: NotificationLinks = {
    redirect: { url: '/account/security', target: '_self' },
    primaryAction: {
      label: 'View Login History',
      redirect: { url: '/account/security/sessions', target: '_self' },
    },
    secondaryAction: {
      label: 'Secure Account',
      redirect: { url: '/account/security/two-factor', target: '_self' },
    },
  };

  const deviceAlertLinks: NotificationLinks = {
    redirect: { url: '/account/security/devices', target: '_self' },
    primaryAction: {
      label: 'Manage Devices',
      redirect: { url: '/account/security/devices', target: '_self' },
    },
    secondaryAction: {
      label: 'Change Password',
      redirect: { url: '/account/security/password', target: '_self' },
    },
  };

  switch (alertType) {
    case 'recent-login':
    case 'session.created':
      return loginAlertLinks;
    case 'new-device':
    case 'device-alert':
      return deviceAlertLinks;
    default:
      return baseSecurityLinks;
  }
};

// ============================================================================
// PAYMENT LINKS
// ============================================================================

export const getPaymentLinks = (eventType: string, transactionId?: string): NotificationLinks => {
  const baseUrl = '/account/billing';

  switch (eventType) {
    case 'success':
    case 'confirmed':
      return {
        redirect: { url: `${baseUrl}/receipts`, target: '_self' },
        primaryAction: {
          label: 'View Receipt',
          redirect: { url: `${baseUrl}/receipts/${transactionId || ''}`, target: '_self' },
        },
        secondaryAction: {
          label: 'Book Another',
          redirect: { url: '/experts', target: '_self' },
        },
      };

    case 'failed':
      return {
        redirect: { url: baseUrl, target: '_self' },
        primaryAction: {
          label: 'Retry Payment',
          redirect: { url: `${baseUrl}/retry/${transactionId || ''}`, target: '_self' },
        },
        secondaryAction: {
          label: 'Contact Support',
          redirect: { url: '/support', target: '_self' },
        },
      };

    case 'multibanco-reminder':
    case 'pending':
      return {
        redirect: { url: `${baseUrl}/multibanco`, target: '_self' },
        primaryAction: {
          label: 'Pay Now',
          redirect: { url: `${baseUrl}/multibanco/${transactionId || ''}`, target: '_self' },
        },
        secondaryAction: {
          label: 'Payment Help',
          redirect: { url: '/help/payment', target: '_self' },
        },
      };

    case 'refund':
      return {
        redirect: { url: `${baseUrl}/refunds`, target: '_self' },
        primaryAction: {
          label: 'View Refund',
          redirect: { url: `${baseUrl}/refunds/${transactionId || ''}`, target: '_self' },
        },
        secondaryAction: {
          label: 'Contact Support',
          redirect: { url: '/support', target: '_self' },
        },
      };

    default:
      return {
        redirect: { url: baseUrl, target: '_self' },
        primaryAction: {
          label: 'View Billing',
          redirect: { url: baseUrl, target: '_self' },
        },
      };
  }
};

// ============================================================================
// APPOINTMENT LINKS
// ============================================================================

export const getAppointmentLinks = (
  eventType: string,
  meetingUrl?: string,
  appointmentId?: string,
): NotificationLinks => {
  switch (eventType) {
    case 'confirmed':
      return {
        redirect: { url: '/appointments', target: '_self' },
        primaryAction: {
          label: 'View Details',
          redirect: { url: `/appointments/${appointmentId || ''}`, target: '_self' },
        },
        secondaryAction: {
          label: 'Add to Calendar',
          redirect: { url: `/appointments/${appointmentId || ''}/calendar`, target: '_self' },
        },
      };

    case 'reminder':
      return {
        redirect: {
          url: meetingUrl || '/appointments',
          target: meetingUrl ? '_blank' : '_self',
        },
        primaryAction: {
          label: 'Join Meeting',
          redirect: { url: meetingUrl || '/appointments', target: '_blank' },
        },
        secondaryAction: {
          label: 'Reschedule',
          redirect: { url: `/appointments/${appointmentId || ''}/reschedule`, target: '_self' },
        },
      };

    case 'cancelled':
      return {
        redirect: { url: '/appointments', target: '_self' },
        primaryAction: {
          label: 'Book New',
          redirect: { url: '/experts', target: '_self' },
        },
        secondaryAction: {
          label: 'View History',
          redirect: { url: '/appointments/history', target: '_self' },
        },
      };

    case 'rescheduled':
      return {
        redirect: { url: '/appointments', target: '_self' },
        primaryAction: {
          label: 'View New Time',
          redirect: { url: `/appointments/${appointmentId || ''}`, target: '_self' },
        },
        secondaryAction: {
          label: 'Add to Calendar',
          redirect: { url: `/appointments/${appointmentId || ''}/calendar`, target: '_self' },
        },
      };

    case 'completed':
      return {
        redirect: { url: '/appointments/history', target: '_self' },
        primaryAction: {
          label: 'Leave Review',
          redirect: { url: `/appointments/${appointmentId || ''}/review`, target: '_self' },
        },
        secondaryAction: {
          label: 'Book Follow-up',
          redirect: { url: '/experts', target: '_self' },
        },
      };

    default:
      return {
        redirect: { url: '/appointments', target: '_self' },
        primaryAction: {
          label: 'View Appointments',
          redirect: { url: '/appointments', target: '_self' },
        },
      };
  }
};

// ============================================================================
// EXPERT PAYOUT LINKS
// ============================================================================

export const getExpertPayoutLinks = (payoutId?: string): NotificationLinks => {
  return {
    redirect: { url: '/account/earnings', target: '_self' },
    primaryAction: {
      label: 'View Payout',
      redirect: { url: `/account/earnings/payouts/${payoutId || ''}`, target: '_self' },
    },
    secondaryAction: {
      label: 'Earnings Dashboard',
      redirect: { url: '/account/earnings', target: '_self' },
    },
  };
};

// ============================================================================
// SYSTEM HEALTH LINKS (Admin)
// ============================================================================

export const getSystemHealthLinks = (_alertType: string = 'general'): NotificationLinks => {
  return {
    redirect: { url: '/admin/health', target: '_self' },
    primaryAction: {
      label: 'View Details',
      redirect: { url: '/admin/health/alerts', target: '_self' },
    },
    secondaryAction: {
      label: 'System Logs',
      redirect: { url: '/admin/logs', target: '_self' },
    },
  };
};

// ============================================================================
// PLATFORM EXPERT LINKS
// ============================================================================

export const getPlatformExpertLinks = (eventType: string, expertId?: string): NotificationLinks => {
  switch (eventType) {
    case 'new-expert':
      return {
        redirect: { url: '/experts', target: '_self' },
        primaryAction: {
          label: 'View Expert',
          redirect: { url: `/experts/${expertId || ''}`, target: '_self' },
        },
        secondaryAction: {
          label: 'Browse All',
          redirect: { url: '/experts', target: '_self' },
        },
      };

    case 'expert-updated':
      return {
        redirect: { url: `/experts/${expertId || ''}`, target: '_self' },
        primaryAction: {
          label: 'View Profile',
          redirect: { url: `/experts/${expertId || ''}`, target: '_self' },
        },
        secondaryAction: {
          label: 'Book Session',
          redirect: { url: `/experts/${expertId || ''}/book`, target: '_self' },
        },
      };

    default:
      return {
        redirect: { url: '/experts', target: '_self' },
        primaryAction: {
          label: 'Browse Experts',
          redirect: { url: '/experts', target: '_self' },
        },
      };
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get notification links based on workflow ID and context
 */
export const getNotificationLinks = (
  workflowId: string,
  context: Record<string, unknown> = {},
): NotificationLinks => {
  switch (workflowId) {
    case 'user-lifecycle':
      return getUserLifecycleLinks(context.userSegment as 'patient' | 'expert' | 'admin');

    case 'security-auth':
      return getSecurityLinks(context.alertType as string);

    case 'payment-universal':
      return getPaymentLinks(context.eventType as string, context.transactionId as string);

    case 'appointment-universal':
    case 'appointment-confirmation':
      return getAppointmentLinks(
        context.eventType as string,
        context.meetingUrl as string,
        context.appointmentId as string,
      );

    case 'expert-payout-notification':
      return getExpertPayoutLinks(context.payoutId as string);

    case 'system-health':
      return getSystemHealthLinks(context.alertType as string);

    case 'platform-payments-universal':
      return getPlatformExpertLinks(context.eventType as string, context.expertId as string);

    default:
      return {
        redirect: { url: '/dashboard', target: '_self' },
        primaryAction: {
          label: 'View Dashboard',
          redirect: { url: '/dashboard', target: '_self' },
        },
      };
  }
};

/**
 * Validate notification links for security and correctness
 */
export const validateNotificationLinks = (links: NotificationLinks): boolean => {
  const validateUrl = (url: string): boolean => {
    // Only allow internal URLs (starting with /) or specific external domains
    if (url.startsWith('/')) return true;

    const allowedDomains = [
      'meet.google.com',
      'calendar.google.com',
      'zoom.us',
      'teams.microsoft.com',
    ];

    try {
      const urlObj = new URL(url);
      return allowedDomains.includes(urlObj.hostname);
    } catch {
      return false;
    }
  };

  if (links.redirect && !validateUrl(links.redirect.url)) return false;
  if (links.primaryAction && !validateUrl(links.primaryAction.redirect.url)) return false;
  if (links.secondaryAction && !validateUrl(links.secondaryAction.redirect.url)) return false;

  return true;
};
