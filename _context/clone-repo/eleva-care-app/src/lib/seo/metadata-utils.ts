import { type Locale, locales } from '@/lib/i18n/routing';
import {
  constructEventImage,
  constructGenericImage,
  constructUserProfileImage,
  type EventImageProps,
  type GenericImageProps,
  type UserProfileImageProps,
} from '@/lib/og-images/components';
import type { Metadata } from 'next';

interface SEOConfig {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  siteName?: string;
  image?: {
    url: string;
    width: number;
    height: number;
    alt: string;
  };
  ogImage?: {
    type: 'profile' | 'generic' | 'event';
    data: UserProfileImageProps | GenericImageProps | EventImageProps;
  };
  keywords?: string[];
  type?: 'website' | 'article';
  noIndex?: boolean;
}

/**
 * Generate comprehensive metadata for a page following Next.js 15 best practices
 * Includes alternates, canonical URLs, OpenGraph, Twitter, and robots configuration
 */
export function generatePageMetadata(config: SEOConfig): Metadata {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Construct the current page URL
  const isDefaultLocale = config.locale === 'en';
  const pathPrefix = isDefaultLocale ? '' : `/${config.locale}`;
  const fullPath = config.path === '/' ? '' : config.path;
  const currentUrl = `${baseUrl}${pathPrefix}${fullPath}`;

  // Generate dynamic OG image if specified, otherwise use default
  let image;

  if (config.ogImage) {
    let ogImageUrl: string;

    switch (config.ogImage.type) {
      case 'profile':
        ogImageUrl = constructUserProfileImage(config.ogImage.data as UserProfileImageProps);
        break;
      case 'generic':
        ogImageUrl = constructGenericImage(config.ogImage.data as GenericImageProps);
        break;
      case 'event':
        ogImageUrl = constructEventImage(config.ogImage.data as EventImageProps);
        break;
      default:
        ogImageUrl = '/img/eleva-care-share.png';
    }

    // Generate appropriate alt text based on image type
    let altText: string;
    switch (config.ogImage.type) {
      case 'profile': {
        const profileData = config.ogImage.data as UserProfileImageProps;
        altText = `${profileData.name} - Healthcare Expert | Eleva Care`;
        break;
      }
      case 'generic': {
        const genericData = config.ogImage.data as GenericImageProps;
        altText = genericData.title;
        break;
      }
      case 'event': {
        const eventData = config.ogImage.data as EventImageProps;
        altText = `${eventData.title} with ${eventData.expertName} | Eleva Care`;
        break;
      }
      default:
        altText = config.title;
    }

    image = {
      url: `${baseUrl}${ogImageUrl}`,
      width: 1200,
      height: 630,
      alt: altText,
    };
  } else if (config.image) {
    image = {
      ...config.image,
      url: config.image.url.startsWith('http') ? config.image.url : `${baseUrl}${config.image.url}`,
    };
  } else {
    // Default image configuration
    image = {
      url: `${baseUrl}/img/eleva-care-share.png`,
      width: 1200,
      height: 680,
      alt: 'Eleva Care - Expert Healthcare for Women',
    };
  }

  return {
    metadataBase: new URL(baseUrl),
    title: config.title,
    description: config.description,
    keywords: config.keywords,

    // Canonical URL and alternates for internationalization
    alternates: {
      canonical: currentUrl,
      languages: Object.fromEntries(
        locales.map((loc) => {
          const isDefaultLoc = loc === 'en';
          const locPrefix = isDefaultLoc ? '' : `/${loc}`;
          const locPath = config.path === '/' ? '' : config.path;
          return [loc, `${baseUrl}${locPrefix}${locPath}`];
        }),
      ),
    },

    // OpenGraph configuration
    openGraph: {
      title: config.ogTitle || config.title,
      description: config.ogDescription || config.description,
      siteName: config.siteName || 'Eleva Care',
      url: currentUrl,
      type: config.type || 'website',
      images: [
        {
          url: image.url,
          width: image.width,
          height: image.height,
          alt: image.alt,
        },
      ],
    },

    // Twitter configuration
    twitter: {
      card: 'summary_large_image',
      title: config.ogTitle || config.title,
      description: config.ogDescription || config.description,
      images: [image.url],
    },

    // Robots configuration
    robots: config.noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
  };
}

/**
 * Generate metadata for legal documents
 */
export function generateLegalPageMetadata(
  locale: Locale,
  document: string,
  title: string,
  description: string,
): Metadata {
  return generatePageMetadata({
    locale,
    path: `/legal/${document}`,
    title,
    description,
    keywords: ['legal', 'privacy', 'terms', 'eleva care', 'healthcare'],
    type: 'website',
  });
}

/**
 * Generate metadata for user profile pages with dynamic OG image
 */
export function generateUserProfileMetadata(
  locale: Locale,
  username: string,
  name: string,
  bio?: string,
  image?: string,
  headline?: string,
  specialties?: string[],
): Metadata {
  const title = `${name} - Healthcare Expert | Eleva Care`;
  const description = bio
    ? `Book a consultation with ${name}. ${bio.substring(0, 120)}...`
    : `Book a consultation with ${name}, a verified healthcare expert on Eleva Care.`;

  return generatePageMetadata({
    locale,
    path: `/${username}`,
    title,
    description,
    keywords: ['healthcare expert', 'consultation', 'pregnancy', 'postpartum', 'women health'],
    ogImage: {
      type: 'profile',
      data: {
        name,
        username,
        headline,
        image,
        specialties,
      },
    },
    type: 'website',
  });
}

/**
 * Generate metadata for generic pages with dynamic OG image
 */
export function generateGenericPageMetadata(
  locale: Locale,
  path: string,
  title: string,
  description: string,
  variant: 'primary' | 'secondary' | 'accent' = 'primary',
  keywords?: string[],
): Metadata {
  return generatePageMetadata({
    locale,
    path,
    title,
    description,
    keywords,
    ogImage: {
      type: 'generic',
      data: {
        title,
        description,
        variant,
      },
    },
    type: 'website',
  });
}

/**
 * Generate metadata for event pages with dynamic OG image
 */
export function generateEventMetadata(
  locale: Locale,
  username: string,
  eventSlug: string,
  title: string,
  expertName: string,
  description?: string,
  expertImage?: string,
  duration?: string,
  price?: string,
): Metadata {
  const pageTitle = `${title} with ${expertName} | Eleva Care`;
  const pageDescription =
    description || `Book a ${title} consultation with ${expertName}, a verified healthcare expert.`;

  return generatePageMetadata({
    locale,
    path: `/${username}/${eventSlug}`,
    title: pageTitle,
    description: pageDescription,
    keywords: [
      'healthcare consultation',
      'expert appointment',
      'women health',
      'pregnancy',
      'postpartum',
    ],
    ogImage: {
      type: 'event',
      data: {
        title,
        expertName,
        expertImage,
        duration,
        price,
      },
    },
    type: 'website',
  });
}
