# Dynamic OG Image Generation System

## Overview

Eleva Care now features a comprehensive Open Graph (OG) image generation system inspired by Cal.com, built with Vercel's `@vercel/og` package and Satori. This system automatically generates beautiful, branded social media preview images for all pages.

## Features

- **Dynamic Generation**: Images are generated on-demand with custom content
- **Eleva Care Branding**: Consistent use of brand colors, gradients, and logos
- **Multiple Templates**: Profile, generic, and event-specific layouts
- **Edge Runtime**: Fast generation using Vercel's Edge Runtime
- **Caching**: Optimized caching with 1-hour cache and 24-hour stale-while-revalidate
- **Responsive Design**: Perfect 1200x630 dimensions for all social platforms

## Image Types

### 1. Profile Images (`type=profile`)

For user profile pages featuring healthcare experts.

**Parameters:**

- `name` (required): Expert's full name
- `username` (required): Username for the profile
- `headline` (optional): Professional headline
- `image` (optional): Profile image URL
- `specialties` (optional): Array of specialties/categories

**Example:**

```
/api/og/image?type=profile&name=Dr.%20Sarah%20Johnson&username=sarah-johnson&headline=Women's%20Health%20Specialist&specialties=Pregnancy%20Care&specialties=Postpartum%20Support
```

### 2. Generic Images (`type=generic`)

For general pages like About, Services, etc.

**Parameters:**

- `title` (required): Page title
- `description` (required): Page description
- `variant` (optional): Color variant - `primary`, `secondary`, or `accent`

**Example:**

```
/api/og/image?type=generic&title=About%20Eleva%20Care&description=Expert%20Healthcare%20for%20Women&variant=secondary
```

### 3. Event Images (`type=event`)

For consultation/appointment booking pages.

**Parameters:**

- `title` (required): Event/consultation title
- `expertName` (required): Expert's name
- `expertImage` (optional): Expert's profile image
- `duration` (optional): Session duration
- `price` (optional): Price information

**Example:**

```
/api/og/image?type=event&title=Pregnancy%20Consultation&expertName=Dr.%20Sarah%20Johnson&duration=45%20minutes&price=$150
```

## Implementation

### Using with Metadata Utils

The system integrates seamlessly with our metadata utilities:

```typescript
import { generateUserProfileMetadata } from '@/lib/seo/metadata-utils';

export async function generateMetadata({ params }): Promise<Metadata> {
  const { username, locale } = await params;

  // Get user data...

  return generateUserProfileMetadata(locale, username, name, bio, image, headline, specialties);
}
```

### Direct Usage

You can also construct OG image URLs directly:

```typescript
import { constructUserProfileImage } from '@/lib/og-images/components';

const ogImageUrl = constructUserProfileImage({
  name: 'Dr. Sarah Johnson',
  username: 'sarah-johnson',
  headline: "Women's Health Specialist",
  image: '/profile-images/sarah.jpg',
  specialties: ['Pregnancy Care', 'Postpartum Support'],
});
```

## Brand Colors & Design

The system uses Eleva Care's official brand palette:

```typescript
const ELEVA_BRAND = {
  colors: {
    primary: '#006D77', // Deep Teal
    primaryLight: '#83C5BE', // Sage Green
    secondary: '#E29578', // Soft Coral
    secondaryLight: '#FFDDD2', // Warm Sand
    accent: '#E0FBFC', // Pale Lavender
    neutral: {
      100: '#F7F9F9', // Soft White
      200: '#D1D1D1', // Light Grey
      900: '#333333', // Charcoal
    },
    highlight: {
      red: '#EE4266', // Vibrant Rose
      purple: '#540D6E', // Deep Purple
      yellow: '#FFD23F', // Sunshine Yellow
    },
  },
  gradients: {
    primary: 'linear-gradient(135deg, #006D77 0%, #83C5BE 100%)',
    secondary: 'linear-gradient(135deg, #E29578 0%, #FFDDD2 100%)',
    accent: 'linear-gradient(135deg, #E0FBFC 0%, #F7F9F9 100%)',
  },
};
```

## File Structure

```
lib/og-images/
├── components.tsx          # OG image components and constructors
app/api/og/image/
├── route.tsx              # API route for image generation
docs/04-development/ui-ux/
├── 04-og-image-system.md  # This documentation
scripts/
├── test-og-images.js      # Testing script
```

## Testing

### Local Testing

1. Start the development server:

```bash
pnpm dev
```

2. Run the test script:

```bash
node scripts/test-og-images.js
```

3. Open the generated URLs in your browser to see the images.

### Manual Testing URLs

- **Profile**: `http://localhost:3000/api/og/image?type=profile&name=Dr.%20Sarah%20Johnson&username=sarah-johnson`
- **Generic**: `http://localhost:3000/api/og/image?type=generic&title=About%20Us&description=Learn%20more%20about%20Eleva%20Care`
- **Event**: `http://localhost:3000/api/og/image?type=event&title=Consultation&expertName=Dr.%20Sarah%20Johnson`

## Performance & Caching

- **Edge Runtime**: Images generate in ~200-500ms
- **Cache Headers**:
  - `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`
  - 1 hour cache, 24 hour stale-while-revalidate
- **CDN**: Automatically cached by Vercel's Edge Network

## Error Handling

The system includes comprehensive error handling:

- **Validation**: Zod schemas validate all parameters
- **Fallbacks**: Graceful degradation for missing data
- **Logging**: Detailed error logging for debugging
- **HTTP Status**: Proper status codes (400 for validation, 500 for server errors)

## Customization

### Adding New Image Types

1. Create a new component in `lib/og-images/components.tsx`
2. Add validation schema in `app/api/og/image/route.tsx`
3. Add case handling in the API route
4. Create constructor function for URL generation

### Modifying Existing Templates

Edit the components in `lib/og-images/components.tsx`. The system uses:

- **JSX**: For component structure
- **Tailwind-like syntax**: Via the `tw` prop for Satori
- **Inline styles**: For complex styling not supported by Satori

## Best Practices

1. **Keep text concise**: Long text may overflow or be truncated
2. **Use absolute URLs**: For images, always use absolute URLs
3. **Test across platforms**: Verify images display correctly on Twitter, Facebook, LinkedIn
4. **Monitor performance**: Check generation times and cache hit rates
5. **Validate parameters**: Always validate input parameters for security

## Troubleshooting

### Common Issues

1. **Fonts not loading**: Check network connectivity and font URLs
2. **Images not displaying**: Verify image URLs are absolute and accessible
3. **Layout issues**: Test with different text lengths and content
4. **Cache issues**: Clear browser cache or use incognito mode for testing

### Debug Mode

Add `debug=true` to any OG image URL to see layout debugging information:

```
/api/og/image?type=profile&name=Test&username=test&debug=true
```

## Integration Examples

### Next.js Page with OG Image

```typescript
// app/[locale]/(public)/[username]/page.tsx
import { generateUserProfileMetadata } from '@/lib/seo/metadata-utils';

export async function generateMetadata({ params }): Promise<Metadata> {
  const { username, locale } = await params;

  // Fetch user data...

  return generateUserProfileMetadata(locale, username, name, bio, image, headline, specialties);
}
```

### Custom OG Image in Metadata

```typescript
import { generatePageMetadata } from '@/lib/seo/metadata-utils';

export async function generateMetadata(): Promise<Metadata> {
  return generatePageMetadata({
    locale: 'en',
    path: '/custom-page',
    title: 'Custom Page',
    description: 'A custom page with dynamic OG image',
    ogImage: {
      type: 'generic',
      data: {
        title: 'Custom Page',
        description: 'A custom page with dynamic OG image',
        variant: 'primary',
      },
    },
  });
}
```

## Future Enhancements

- [ ] A/B testing for different layouts
- [ ] Animated GIF support
- [ ] Multi-language text rendering
- [ ] Custom font loading
- [ ] Template marketplace
- [ ] Analytics integration
