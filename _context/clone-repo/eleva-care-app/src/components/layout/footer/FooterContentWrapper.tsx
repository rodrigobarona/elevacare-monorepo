'use client';

import { useEffect, useRef, useState } from 'react';

interface FooterContentWrapperProps {
  children: React.ReactNode;
  placeholderHeight?: string; // e.g., 'h-96' or '300px'
}

export function FooterContentWrapper({
  children,
  placeholderHeight = 'h-96', // Default placeholder height
}: FooterContentWrapperProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const currentRef = ref.current; // Store ref value
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Disconnect once visible
        }
      },
      {
        rootMargin: '0px 0px 100px 0px', // Trigger when 100px from viewport bottom
        threshold: 0.01, // Trigger if even 1% is visible
      },
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, []);

  if (!isVisible) {
    return <div ref={ref} className={`w-full ${placeholderHeight}`} aria-hidden="true" />;
  }

  return <>{children}</>;
}
