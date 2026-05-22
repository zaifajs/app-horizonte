import type { CSSProperties } from "react";

// Deterministic color palette — picking from this set by hashing the
// person's initials means the same student always renders with the
// same color across every screen of the app (rows, modals, the queue
// panel, the sidebar avatar, etc.).
const PALETTE: { fg: string; bg: string; border: string }[] = [
  { fg: "#34D399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.30)" },
  { fg: "#60A5FA", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.30)" },
  { fg: "#F4B53F", bg: "rgba(244,181,63,0.12)", border: "rgba(244,181,63,0.30)" },
  { fg: "#FF7A45", bg: "rgba(255,122,69,0.12)", border: "rgba(255,122,69,0.30)" },
  { fg: "#F87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.30)" },
  { fg: "#A78BFA", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.30)" },
  { fg: "#22D3EE", bg: "rgba(34,211,238,0.12)", border: "rgba(34,211,238,0.30)" },
  { fg: "#F472B6", bg: "rgba(244,114,182,0.12)", border: "rgba(244,114,182,0.30)" },
  { fg: "#FCD34D", bg: "rgba(252,211,77,0.12)", border: "rgba(252,211,77,0.30)" },
  { fg: "#B6FF3C", bg: "rgba(182,255,60,0.10)", border: "rgba(182,255,60,0.30)" },
];

// Pre-defined tones map to the app's semantic palette. Pass `tone` to
// override the deterministic color (e.g., a payment modal header that
// wants to lean into the urgency tint).
const TONES: Record<string, { fg: string; bg: string; border: string }> = {
  danger: { fg: "var(--hz-danger)", bg: "var(--hz-danger-50)", border: "rgba(248,113,113,0.30)" },
  warning: { fg: "var(--hz-warning)", bg: "var(--hz-warning-50)", border: "rgba(244,181,63,0.30)" },
  accent: { fg: "var(--hz-accent)", bg: "var(--hz-accent-50)", border: "rgba(255,122,69,0.30)" },
  success: { fg: "var(--hz-success)", bg: "var(--hz-success-50)", border: "rgba(52,211,153,0.30)" },
  info: { fg: "var(--hz-info)", bg: "var(--hz-info-50)", border: "rgba(96,165,250,0.30)" },
  muted: { fg: "var(--hz-ink-2)", bg: "var(--hz-muted-50)", border: "var(--hz-line)" },
};

export function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "??"
  );
}

function hashInitials(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export type AvatarTone = keyof typeof TONES;

export function avatarPalette(name: string): { fg: string; bg: string; border: string } {
  const initials = getInitials(name);
  return PALETTE[hashInitials(initials) % PALETTE.length];
}

export function Avatar({
  name,
  size = 28,
  fontSize,
  tone,
  className,
  style,
}: {
  name: string;
  size?: number;
  fontSize?: number | string;
  tone?: AvatarTone;
  className?: string;
  style?: CSSProperties;
}) {
  const initials = getInitials(name);
  const colors = tone ? TONES[tone] : avatarPalette(name);
  return (
    <span
      className={`avi ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        fontSize: fontSize ?? undefined,
        color: colors.fg,
        background: colors.bg,
        borderColor: colors.border,
        ...style,
      }}
    >
      {initials}
    </span>
  );
}
