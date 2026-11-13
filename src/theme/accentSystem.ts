/**
 * SnapFind AI - Accent Theme System
 *
 * Official Palette:
 * - Main background: #080908
 * - Secondary background: #0D0F0D
 * - Card background: #141714
 * - Elevated surface: #1B1F1A
 * - Hover surface: #222720
 * - Primary text: #F7F8F5
 * - Secondary text: #A5AAA1
 * - Muted text: #777E74
 * - Borders: #30362E
 * - Primary green: #B7F36B
 * - Green hover: #A5E65A
 */

export type AccentToneId = "lime-green" | "minimal-white" | "stealth" | "cyber-teal";

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
  "lime-green": {
    id: "lime-green",
    label: "Lime Green (Default)",
    name: "Lime Green",
    primary: "#B7F36B",
    hover: "#A5E65A",
    soft: "rgba(183, 243, 107, 0.15)",
    border: "#30362E",
    glow: "rgba(183, 243, 107, 0.35)",
    text: "#B7F36B",
    ring: "rgba(183, 243, 107, 0.55)",
    badgeBg: "rgba(183, 243, 107, 0.15)",
    badgeText: "#B7F36B",
  },
  "cyber-teal": {
    id: "cyber-teal",
    label: "Lime Green",
    name: "Lime Green",
    primary: "#B7F36B",
    hover: "#A5E65A",
    soft: "rgba(183, 243, 107, 0.15)",
    border: "#30362E",
    glow: "rgba(183, 243, 107, 0.35)",
    text: "#B7F36B",
    ring: "rgba(183, 243, 107, 0.55)",
    badgeBg: "rgba(183, 243, 107, 0.15)",
    badgeText: "#B7F36B",
  },
  "minimal-white": {
    id: "minimal-white",
    label: "Minimal White",
    name: "Minimal White",
    primary: "#F7F8F5",
    hover: "#E2E5DF",
    soft: "rgba(247, 248, 245, 0.12)",
    border: "#30362E",
    glow: "rgba(247, 248, 245, 0.25)",
    text: "#F7F8F5",
    ring: "rgba(247, 248, 245, 0.45)",
    badgeBg: "rgba(247, 248, 245, 0.12)",
    badgeText: "#F7F8F5",
  },
  stealth: {
    id: "stealth",
    label: "Stealth Charcoal",
    name: "Stealth Charcoal",
    primary: "#A5AAA1",
    hover: "#C2C7BD",
    soft: "rgba(165, 170, 161, 0.15)",
    border: "#30362E",
    glow: "rgba(165, 170, 161, 0.25)",
    text: "#F7F8F5",
    ring: "rgba(165, 170, 161, 0.45)",
    badgeBg: "rgba(165, 170, 161, 0.15)",
    badgeText: "#F7F8F5",
  },
};

const ACCENT_STORAGE_KEY = "snapfind_accent_tone_v2";

/**
 * Apply accent variables directly to document.documentElement
 */
export function applyAccentTheme(accentId: string = "lime-green"): void {
  if (typeof document === "undefined") return;

  const theme = ACCENT_THEMES[accentId] || ACCENT_THEMES["lime-green"];
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
  root.style.setProperty("--accent-green", "#B7F36B");
  root.style.setProperty("--accent-green-hover", "#A5E65A");

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
  if (typeof localStorage === "undefined") return "lime-green";
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (stored && ACCENT_THEMES[stored]) {
      return stored;
    }
  } catch (e) {
    // ignore
  }
  return "lime-green";
}
