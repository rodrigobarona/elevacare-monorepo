export const SOCIAL_MEDIA = {
  INSTAGRAM: {
    name: 'instagram' as const,
    baseUrl: 'https://instagram.com/',
    prefix: '',
  },
  TWITTER: {
    name: 'twitter' as const,
    baseUrl: 'https://twitter.com/',
    prefix: '',
  },
  LINKEDIN: {
    name: 'linkedin' as const,
    baseUrl: 'https://linkedin.com/in/',
    prefix: '',
  },
  YOUTUBE: {
    name: 'youtube' as const,
    baseUrl: 'https://youtube.com/@',
    prefix: '@',
  },
  TIKTOK: {
    name: 'tiktok' as const,
    baseUrl: 'https://tiktok.com/@',
    prefix: '@',
  },
} as const;

export type SocialMediaPlatform = (typeof SOCIAL_MEDIA)[keyof typeof SOCIAL_MEDIA]['name'];

export const SOCIAL_MEDIA_LIST = Object.values(SOCIAL_MEDIA);
