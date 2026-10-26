/**
 * SnapFind AI - Accent Theme System
 *
 * Official Palette:
 * - Forest Slate: #2C3531 — main backgrounds & deep surfaces
 * - Cyber Teal: #116466 — brand accents, gradient tone, selected navigation, and highlights
 * - Soft Mint: #D1E8E2 — subtle highlights and light accent surfaces
 * - Charcoal Card: #1E293B — cards, sidebars, modals, and search panels
 * - Frost White: #F1F5F9 — primary text
 * - Shadow Gray: #334155 — borders and dividers
 * - Warm Beige: #D9B08C — optional, restrained secondary highlights
 */

export type AccentToneId = "cyber-teal" | "soft-mint" | "warm-beige" | "monochrome";

export interface AccentThemeConfig {
  id: AccentToneId;
  label: string;
  name: string;
  primary: string;
  hover: string;
  soft: string;
  border: string;
  glow: string;
  text: string;
  ring: string;
  badgeBg: string;
  badgeText: string;
}

export const ACCENT_THEMES: Record<string, AccentThemeConfig> = {
  "cyber-teal": {
    id: "cyber-teal",
    label: "Cyber Teal (Default)",
    name: "Cyber Teal",
    primary: "#116466",
    hover: "#157F81",
    soft: "rgba(17, 100, 102, 0.18)",
    border: "#334155",
    glow: "rgba(17, 100, 102, 0.35)",
    text: "#D1E8E2",
    ring: "rgba(17, 100, 102, 0.55)",
    badgeBg: "rgba(17, 100, 102, 0.28)",
    badgeText: "#D1E8E2",
  },
  "soft-mint": {
    id: "soft-mint",
    label: "Soft Mint",
    name: "Soft Mint",
    primary: "#D1E8E2",
    hover: "#B9DFD6",
    soft: "rgba(209, 232, 226, 0.15)",
    border: "#334155",
    glow: "rgba(209, 232, 226, 0.30)",
    text: "#D1E8E2",
    ring: "rgba(209, 232, 226, 0.45)",
    badgeBg: "rgba(209, 232, 226, 0.18)",
    badgeText: "#D1E8E2",
  },
  "warm-beige": {
    id: "warm-beige",
    label: "Warm Beige",
    name: "Warm Beige",
    primary: "#D9B08C",
    hover: "#E5C2A2",
    soft: "rgba(217, 176, 140, 0.15)",
    border: "#334155",
    glow: "rgba(217, 176, 140, 0.30)",
    text: "#D9B08C",
    ring: "rgba(217, 176, 140, 0.45)",
    badgeBg: "rgba(217, 176, 140, 0.18)",
    badgeText: "#D9B08C",
  },
  monochrome: {
    id: "monochrome",
    label: "Cyber Teal High-Contrast",
    name: "Cyber Teal High-Contrast",
    primary: "#116466",
    hover: "#157F81",
    soft: "rgba(17, 100, 102, 0.18)",
    border: "#334155",
    glow: "rgba(17, 100, 102, 0.35)",
    text: "#D1E8E2",
    ring: "rgba(17, 100, 102, 0.55)",
    badgeBg: "rgba(17, 100, 102, 0.28)",
    badgeText: "#D1E8E2",
  },
};

const ACCENT_STORAGE_KEY = "snapfind_accent_tone_cyber_v1";

/**
 * Apply accent variables directly to document.documentElement
 */
export function applyAccentTheme(accentId: string = "cyber-teal"): void {
  if (typeof document === "undefined") return;

  const theme = ACCENT_THEMES[accentId] || ACCENT_THEMES["cyber-teal"];
  const root = document.documentElement;

  root.style.setProperty("--accent-primary", theme.primary);
  root.style.setProperty("--accent-hover", theme.hover);
  root.style.setProperty("--accent-soft", theme.soft);
  root.style.setProperty("--accent-border", theme.border);
  root.style.setProperty("--accent-glow", theme.glow);
  root.style.setProperty("--accent-text", theme.text);
  root.style.setProperty("--accent-ring", theme.ring);
  root.style.setProperty("--accent-badge-bg", theme.badgeBg);
  root.style.setProperty("--accent-badge-text", theme.badgeText);
  root.style.setProperty("--accent-beige", "#D9B08C");
  root.style.setProperty("--accent-mint", "#D1E8E2");

  root.setAttribute("data-accent", theme.id);

  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, theme.id);
  } catch (e) {
    // ignore
  }
}

/**
 * Get currently stored accent tone
 */
export function getStoredAccentTheme(): string {
  if (typeof localStorage === "undefined") return "cyber-teal";
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (stored && ACCENT_THEMES[stored]) {
      return stored;
    }
  } catch (e) {
    // ignore
  }
  return "cyber-teal";
}
