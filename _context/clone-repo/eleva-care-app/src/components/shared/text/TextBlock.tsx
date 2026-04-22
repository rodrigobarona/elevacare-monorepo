'use client';

type TextBlockProps = {
  children: React.ReactNode;
  className?: string;
};

export default function TextBlock({ children, className }: TextBlockProps) {
  return (
    <div className={`mt-6 text-base/6 text-eleva-neutral-900/60 lg:text-lg/7 ${className}`}>
      {children}
    </div>
  );
}
