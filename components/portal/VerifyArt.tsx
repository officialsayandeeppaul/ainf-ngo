/** Small inline illustrations for verification empty / locked states. */

type ArtProps = { className?: string };

function Frame({ className, children }: ArtProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width="168"
      height="128"
      viewBox="0 0 168 128"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IdentityArt({ className }: ArtProps) {
  return (
    <Frame className={className}>
      <rect x="28" y="22" width="112" height="84" rx="16" fill="#eaf6ef" />
      <rect x="42" y="38" width="84" height="52" rx="10" fill="#fff" stroke="#39a46b" strokeWidth="1.6" />
      <circle cx="64" cy="58" r="10" fill="#39a46b" opacity="0.2" />
      <circle cx="64" cy="56" r="6" fill="#39a46b" />
      <rect x="80" y="50" width="34" height="6" rx="3" fill="#cfe8d9" />
      <rect x="80" y="62" width="24" height="5" rx="2.5" fill="#e2e7e4" />
      <rect x="54" y="76" width="60" height="5" rx="2.5" fill="#e2e7e4" />
    </Frame>
  );
}

export function PanArt({ className }: ArtProps) {
  return (
    <Frame className={className}>
      <rect x="36" y="18" width="96" height="92" rx="14" fill="#eaf6ef" />
      <rect x="48" y="32" width="72" height="64" rx="8" fill="#fff" stroke="#39a46b" strokeWidth="1.6" />
      <rect x="58" y="44" width="52" height="7" rx="3.5" fill="#39a46b" opacity="0.35" />
      <rect x="58" y="58" width="40" height="5" rx="2.5" fill="#e2e7e4" />
      <rect x="58" y="68" width="46" height="5" rx="2.5" fill="#e2e7e4" />
      <rect x="58" y="80" width="28" height="6" rx="3" fill="#cfe8d9" />
    </Frame>
  );
}

export function LockedArt({ className }: ArtProps) {
  return (
    <Frame className={className}>
      <rect x="28" y="22" width="112" height="84" rx="16" fill="#f3f5f4" />
      <rect x="48" y="54" width="72" height="42" rx="10" fill="#fff" stroke="#cfd6d2" strokeWidth="1.6" />
      <path
        d="M70 54V44a14 14 0 0 1 28 0v10"
        stroke="#8a938d"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="84" cy="75" r="5" fill="#8a938d" />
      <rect x="82" y="75" width="4" height="10" rx="2" fill="#8a938d" />
    </Frame>
  );
}

export function PhoneArt({ className }: ArtProps) {
  return (
    <Frame className={className}>
      <rect x="58" y="12" width="52" height="104" rx="14" fill="#eaf6ef" stroke="#39a46b" strokeWidth="1.6" />
      <rect x="66" y="28" width="36" height="56" rx="6" fill="#fff" />
      <rect x="72" y="40" width="24" height="8" rx="4" fill="#cfe8d9" />
      <rect x="76" y="54" width="16" height="6" rx="3" fill="#39a46b" opacity="0.45" />
      <circle cx="84" cy="98" r="5" fill="#39a46b" />
    </Frame>
  );
}

export function WaitingArt({ className }: ArtProps) {
  return (
    <Frame className={className}>
      <circle cx="84" cy="64" r="40" fill="#eaf6ef" />
      <circle cx="84" cy="64" r="28" fill="#fff" stroke="#39a46b" strokeWidth="1.6" />
      <path d="M84 48v18l12 8" stroke="#39a46b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function EmptyArt({ className }: ArtProps) {
  return (
    <Frame className={className}>
      <rect x="24" y="28" width="120" height="72" rx="16" fill="#f3f5f4" />
      <circle cx="84" cy="58" r="12" fill="#e2e7e4" />
      <rect x="54" y="78" width="60" height="6" rx="3" fill="#e2e7e4" />
    </Frame>
  );
}

export function DoneArt({ className }: ArtProps) {
  return (
    <Frame className={className}>
      <circle cx="84" cy="64" r="40" fill="#eaf6ef" />
      <circle cx="84" cy="64" r="28" fill="#39a46b" />
      <path
        d="M72 65l8 8 16-18"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}
