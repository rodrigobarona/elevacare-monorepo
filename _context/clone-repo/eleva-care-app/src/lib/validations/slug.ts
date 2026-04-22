import { z } from 'zod';

// Helper function for slugify
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFKD') // Normalize accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

// Zod schema for slug validation
export const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen',
  )
  .transform((val) => slugify(val));

// You can also create a type from the schema
export type Slug = z.infer<typeof slugSchema>;
