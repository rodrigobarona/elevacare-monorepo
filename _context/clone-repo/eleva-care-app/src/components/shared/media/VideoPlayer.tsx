interface VideoPlayerProps {
  width?: number;
  height?: number;
  src: string;
  playsInline?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  className?: string;
  poster?: string; // URL for a WebP poster image
  captions?: {
    src: string;
    label: string;
    srcLang: string;
    default?: boolean;
  }[];
}

// Reminder: To prevent layout shifts, ensure the parent container
// of this VideoPlayer has defined dimensions or an aspect ratio.
// Example: <div style={{ width: '100%', aspectRatio: '16/9' }}>
//            <VideoPlayer src="..." />
//          </div>
// Or ensure VideoPlayer itself receives explicit width/height for aspect ratio,
// and its container controls the final display size.
export function VideoPlayer({
  width,
  height,
  src,
  playsInline,
  autoPlay,
  muted,
  loop,
  controls,
  preload = 'metadata', // Default preload to metadata for better performance
  className,
  poster,
  captions = [], // Default to empty array if no captions provided
}: VideoPlayerProps) {
  // Normalize paths by removing leading slashes
  const normalizePath = (path: string) => path.replace(/^\/+/, '');

  const videoSrc = normalizePath(src);
  const posterSrc = poster ? `/${normalizePath(poster)}` : undefined;

  // Determine video MIME type based on file extension
  const getVideoType = (src: string) => {
    const ext = src.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'webm':
        return 'video/webm';
      case 'mp4':
        return 'video/mp4';
      case 'ogg':
        return 'video/ogg';
      default:
        return 'video/mp4'; // Default to mp4 if unknown
    }
  };

  return (
    <>
      {poster && (
        <picture style={{ display: 'none' }}>
          <img src={poster} alt="" />
        </picture>
      )}
      <video
        width={width}
        height={height}
        style={{ height: '100%', width: '100%' }}
        playsInline={playsInline}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        preload={preload}
        className={className}
        poster={posterSrc}
      >
        <source src={videoSrc} type={getVideoType(src)} />
        {/* Always include at least one track element for accessibility */}
        <track
          kind="captions"
          label="No captions available"
          src="data:text/vtt;base64,V0VCVlRUCgoxCjAwOjAwOjAwLjAwMCAtLT4gMDA6MDA6MDEuMDAwCgo="
          srcLang="en"
          default={captions.length === 0}
        />
        {/* Add additional caption tracks if provided */}
        {captions.map((caption) => (
          <track
            key={caption.src}
            kind="captions"
            label={caption.label}
            src={normalizePath(caption.src)}
            srcLang={caption.srcLang}
            default={caption.default}
          />
        ))}
        {/* Fallback text for browsers that don't support video */}
        Your browser does not support the video tag.
      </video>
    </>
  );
}
export default VideoPlayer;
