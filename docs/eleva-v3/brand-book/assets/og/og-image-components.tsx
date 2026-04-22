/* eslint-disable @next/next/no-img-element */
import React from 'react';

// Eleva Care Brand Constants for OG Images
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
    highlight: 'linear-gradient(135deg, #EE4266 0%, #540D6E 50%, #FFD23F 100%)',
  },
} as const;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Type definitions
export interface UserProfileImageProps {
  name: string;
  username: string;
  headline?: string;
  image?: string | null;
  specialties?: string[];
}

export interface GenericImageProps {
  title: string;
  description: string;
  variant?: 'primary' | 'secondary' | 'accent';
}

export interface EventImageProps {
  title: string;
  expertName: string;
  expertImage?: string | null;
  duration?: string;
  price?: string;
}

// Utility functions
const makeAbsoluteUrl = (url: string) => (/^https?:\/\//.test(url) ? url : `${APP_URL}${url}`);

const joinSpecialties = (specialties: string[] = []) => {
  if (specialties.length === 0) return '';
  if (specialties.length === 1) return specialties[0];
  const last = specialties.pop();
  return `${specialties.join(', ')} & ${last}`;
};

// Wrapper component for consistent layout
interface WrapperProps {
  children: React.ReactNode;
  variant?: 'light' | 'dark' | 'gradient';
  backgroundImage?: string;
}

const Wrapper = ({ children, variant = 'light', backgroundImage }: WrapperProps) => {
  const getBackgroundStyle = () => {
    if (backgroundImage) {
      return {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }

    switch (variant) {
      case 'dark':
        return { backgroundColor: ELEVA_BRAND.colors.neutral[900] };
      case 'gradient':
        return { background: ELEVA_BRAND.gradients.primary };
      default:
        return { backgroundColor: ELEVA_BRAND.colors.neutral[100] };
    }
  };

  return (
    <div tw="flex w-full h-full relative" style={getBackgroundStyle()}>
      {/* Overlay for better text readability on gradients/images */}
      {(variant === 'gradient' || backgroundImage) && (
        <div tw="absolute inset-0" style={{ backgroundColor: 'rgba(0, 109, 119, 0.1)' }} />
      )}

      <div tw="flex flex-col w-full h-full px-20 py-16 items-start justify-between relative z-10">
        {children}
      </div>
    </div>
  );
};

// User Profile OG Image Component
export const UserProfile = ({
  name,
  username,
  headline,
  image,
  specialties = [],
}: UserProfileImageProps) => {
  const hasImage = image && image !== null;
  const displaySpecialties = joinSpecialties(specialties.slice(0, 3));

  return (
    <Wrapper variant="gradient">
      {/* Header with Eleva Care logo */}
      <div tw="flex items-center justify-between w-full">
        <img src={`${APP_URL}/eleva-logo-white.png`} width="200" height="60" alt="Eleva Care" />
        <div tw="flex items-center text-white text-lg font-medium">eleva.care</div>
      </div>

      {/* Main content */}
      <div tw="flex items-center w-full">
        {/* Profile image */}
        {hasImage && (
          <div tw="flex mr-12">
            <img
              tw="rounded-full border-4 border-white"
              src={makeAbsoluteUrl(image)}
              alt={name}
              width="200"
              height="200"
            />
          </div>
        )}

        {/* Profile info */}
        <div tw="flex flex-col flex-1">
          <div tw="flex text-white text-6xl font-bold mb-4" style={{ fontFamily: 'system-ui' }}>
            {name}
          </div>

          <div tw="flex text-white text-3xl mb-6 opacity-90" style={{ fontFamily: 'system-ui' }}>
            @{username}
          </div>

          {headline && (
            <div tw="flex text-white text-2xl mb-4 opacity-80" style={{ fontFamily: 'system-ui' }}>
              {headline}
            </div>
          )}

          {displaySpecialties && (
            <div tw="flex items-center">
              <div
                tw="px-6 py-3 rounded-full text-lg font-medium"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontFamily: 'system-ui',
                }}
              >
                {displaySpecialties}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div tw="flex items-center justify-between w-full text-white text-xl opacity-75">
        <div>Expert Healthcare for Women</div>
        <div>Book your consultation today</div>
      </div>
    </Wrapper>
  );
};

// Generic page OG Image Component
export const Generic = ({ title, description, variant = 'primary' }: GenericImageProps) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          background: ELEVA_BRAND.gradients.secondary,
          textColor: ELEVA_BRAND.colors.neutral[900],
        };
      case 'accent':
        return {
          background: ELEVA_BRAND.gradients.accent,
          textColor: ELEVA_BRAND.colors.neutral[900],
        };
      default:
        return {
          background: ELEVA_BRAND.gradients.primary,
          textColor: 'white',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div tw="flex w-full h-full" style={{ background: styles.background }}>
      <div tw="flex flex-col w-full h-full px-20 py-16 justify-center items-center text-center">
        {/* Logo */}
        <div tw="flex mb-12">
          <img
            src={`${APP_URL}/${variant === 'primary' ? 'eleva-logo-white.png' : 'eleva-logo-color.png'}`}
            width="300"
            height="90"
            alt="Eleva Care"
          />
        </div>

        {/* Title */}
        <div
          tw="flex text-6xl font-bold mb-8 text-center max-w-4xl"
          style={{
            color: styles.textColor,
            fontFamily: 'system-ui',
            lineHeight: '1.1',
          }}
        >
          {title}
        </div>

        {/* Description */}
        <div
          tw="flex text-2xl text-center max-w-3xl opacity-90"
          style={{
            color: styles.textColor,
            fontFamily: 'system-ui',
            lineHeight: '1.4',
          }}
        >
          {description}
        </div>

        {/* Footer tagline */}
        <div tw="flex mt-16 text-xl opacity-75" style={{ color: styles.textColor }}>
          Expert Healthcare for Women • eleva.care
        </div>
      </div>
    </div>
  );
};

// Event booking OG Image Component
export const Event = ({ title, expertName, expertImage, duration, price }: EventImageProps) => {
  const hasImage = expertImage && expertImage !== null;

  return (
    <Wrapper variant="light">
      {/* Header */}
      <div tw="flex items-center justify-between w-full">
        <img src={`${APP_URL}/eleva-logo-color.png`} width="200" height="60" alt="Eleva Care" />
        <div
          tw="flex items-center px-6 py-3 rounded-full text-lg font-medium"
          style={{
            backgroundColor: ELEVA_BRAND.colors.primary,
            color: 'white',
          }}
        >
          Book Consultation
        </div>
      </div>

      {/* Main content */}
      <div tw="flex items-center w-full">
        {/* Expert image */}
        {hasImage && (
          <div tw="flex mr-12">
            <img
              tw="rounded-full border-4"
              style={{ borderColor: ELEVA_BRAND.colors.primary }}
              src={makeAbsoluteUrl(expertImage)}
              alt={expertName}
              width="180"
              height="180"
            />
          </div>
        )}

        {/* Event info */}
        <div tw="flex flex-col flex-1">
          <div
            tw="flex text-5xl font-bold mb-4"
            style={{
              color: ELEVA_BRAND.colors.neutral[900],
              fontFamily: 'system-ui',
            }}
          >
            {title}
          </div>

          <div
            tw="flex text-2xl mb-6"
            style={{
              color: ELEVA_BRAND.colors.primary,
              fontFamily: 'system-ui',
            }}
          >
            with {expertName}
          </div>

          <div tw="flex items-center gap-8">
            {duration && (
              <div
                tw="flex items-center px-4 py-2 rounded-lg text-lg"
                style={{
                  backgroundColor: ELEVA_BRAND.colors.accent,
                  color: ELEVA_BRAND.colors.neutral[900],
                }}
              >
                ⏱️ {duration}
              </div>
            )}

            {price && (
              <div
                tw="flex items-center px-4 py-2 rounded-lg text-lg font-semibold"
                style={{
                  backgroundColor: ELEVA_BRAND.colors.secondary,
                  color: 'white',
                }}
              >
                {price}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div tw="flex items-center justify-between w-full">
        <div tw="text-xl" style={{ color: ELEVA_BRAND.colors.neutral[900] }}>
          Expert Healthcare for Women
        </div>
        <div tw="text-lg" style={{ color: ELEVA_BRAND.colors.primary }}>
          eleva.care
        </div>
      </div>
    </Wrapper>
  );
};

// Constructor functions for generating OG image URLs
export const constructUserProfileImage = ({
  name,
  username,
  headline,
  image,
  specialties,
}: UserProfileImageProps): string => {
  const params = new URLSearchParams({
    type: 'profile',
    name,
    username,
  });

  if (headline) params.set('headline', headline);
  if (image) params.set('image', makeAbsoluteUrl(image));
  if (specialties && specialties.length > 0) {
    specialties.forEach((specialty) => params.append('specialties', specialty));
  }

  return `/api/og/image?${params.toString()}`;
};

export const constructGenericImage = ({
  title,
  description,
  variant = 'primary',
}: GenericImageProps): string => {
  const params = new URLSearchParams({
    type: 'generic',
    title,
    description,
    variant,
  });

  return `/api/og/image?${params.toString()}`;
};

export const constructEventImage = ({
  title,
  expertName,
  expertImage,
  duration,
  price,
}: EventImageProps): string => {
  const params = new URLSearchParams({
    type: 'event',
    title,
    expertName,
  });

  if (expertImage) params.set('expertImage', makeAbsoluteUrl(expertImage));
  if (duration) params.set('duration', duration);
  if (price) params.set('price', price);

  return `/api/og/image?${params.toString()}`;
};
