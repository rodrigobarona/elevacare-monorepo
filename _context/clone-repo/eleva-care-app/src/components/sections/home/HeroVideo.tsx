'use client';

import MuxVideo from '@mux/mux-player-react/lazy';
import { useCallback, useState } from 'react';
import { useCookieConsent } from 'react-cookie-manager';

import styles from './HeroVideo.module.css';

/**
 * Mux video asset configuration
 * Uploaded via next-video sync to Mux CDN
 */
const MUX_PLAYBACK_ID = 'Ol6kzy3beOk2U4RHBssK2n7wtDlqHLWvmOPWH01VOVwA';

/**
 * HeroVideo - Client component for Mux video playback
 *
 * Handles:
 * - Cookie consent check before loading video
 * - Privacy-first video configuration
 * - Error handling with graceful degradation
 *
 * Performance optimizations:
 * - Uses lazy loading from @mux/mux-player-react/lazy (automatic code splitting)
 * - Minimal client-side JavaScript (only video logic)
 *
 * Styling notes:
 * - Tailwind classes handle positioning, z-index, and border-radius
 * - CSS module (HeroVideo.module.css) handles Shadow DOM styles that
 *   cannot be expressed in Tailwind (::part selectors, internal video element)
 */
export function HeroVideo() {
  const [videoError, setVideoError] = useState(false);

  // Check cookie consent status - video only loads when user has accepted cookies
  const { hasConsent } = useCookieConsent();
  const canPlayVideo = !videoError && hasConsent === true;

  // Handle video errors gracefully - fall back to poster image
  const handleVideoError = useCallback(() => {
    console.warn('[Hero] Video failed to load, falling back to poster image');
    setVideoError(true);
  }, []);

  if (!canPlayVideo) {
    return null;
  }

  return (
    <MuxVideo
      playbackId={MUX_PLAYBACK_ID}
      streamType="on-demand"
      autoPlay="muted"
      loop
      muted
      playsInline
      // Privacy settings - disable all tracking and data collection
      disableTracking
      disableCookies
      noVolumePref
      nohotkeys
      // Tailwind: positioning, z-index, border-radius
      // CSS Module: Shadow DOM styles (aspect-ratio, ::part, internal video)
      className={`${styles.heroMuxPlayer} lg:rounded-5xl z-1 rounded-2xl object-cover`}
      onError={handleVideoError}
    />
  );
}
