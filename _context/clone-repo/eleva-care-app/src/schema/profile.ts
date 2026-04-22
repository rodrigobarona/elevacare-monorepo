import { z } from 'zod';

const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB in bytes

const socialLinkSchema = z.object({
  name: z.enum(['instagram', 'twitter', 'linkedin', 'youtube', 'tiktok']),
  url: z.string().refine((val) => {
    if (!val) return true; // Allow empty strings
    if (val.startsWith('http')) {
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    }
    // If not a URL, validate as username
    const username = val.replace(/^@/, '').trim();
    return /^[a-zA-Z0-9._-]*$/.test(username);
  }, 'Invalid URL or username format'),
});

export const profileFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  profilePicture: z
    .string()
    .refine((val) => !val || val.startsWith('http') || val.startsWith('blob:'), {
      message: 'Profile picture must be a valid URL',
    })
    .refine((val): val is string => !val.startsWith('blob:') || val.length <= MAX_FILE_SIZE, {
      message: 'File size must be less than 4.5MB',
      params: { maxSize: MAX_FILE_SIZE },
    })
    .nullable()
    .optional(),
  headline: z.string().min(2, 'Headline must be at least 2 characters').optional(),
  shortBio: z.string().max(160, 'Short bio must be less than 160 characters').optional(),
  longBio: z.string().max(2000, 'Long bio must be less than 2000 characters').optional(),
  primaryCategoryId: z.string().uuid('Invalid category ID').min(1, 'Primary category is required'),
  secondaryCategoryId: z.string().uuid('Invalid category ID').optional().or(z.literal('')),
  socialLinks: z.array(socialLinkSchema),
  isVerified: z.boolean(),
  isTopExpert: z.boolean(),
});

export const profileActionSchema = profileFormSchema.extend({
  workosUserId: z.string().min(1, 'Required'),
});
