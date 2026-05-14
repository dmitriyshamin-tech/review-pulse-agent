type LogoProps = { size?: number; className?: string; withWordmark?: boolean };

/**
 * Inline SVG logo for Review Pulse.
 * Concept: a rounded square containing a "pulse" line + a small dot —
 * a heartbeat for brand reputation. Monochrome, uses currentColor.
 */
export function Logo({ size = 28, className, withWordmark = false }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ""}`} data-testid="logo">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Review Pulse"
      >
        <rect
          x="1.5"
          y="1.5"
          width="29"
          height="29"
          rx="8"
          stroke="currentColor"
          strokeWidth="1.6"
          fill="none"
        />
        <path
          d="M5 17 L11 17 L13.5 11 L17 22 L19.5 14 L22 17 L27 17"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="24.5" cy="9.5" r="2.2" fill="currentColor" />
      </svg>
      {withWordmark && (
        <span className="font-semibold tracking-tight text-base">
          Review Pulse
        </span>
      )}
    </div>
  );
}
