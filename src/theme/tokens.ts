/**
 * SnapFind AI - Centralized Design Tokens & Color System
 *
 * Official Palette (Darkened Cyber Teal & Deep Forest Slate):
 * - Deep Forest Slate: #1A2220 — deep dark page background
 * - Cyber Teal (Darkened): #0A383A — rich dark cyber teal for landing background
 * - Cyber Teal Brand Accent: #116466 — brand highlights, buttons, selected states
 * - Soft Mint: #D1E8E2 — subtle highlights and light accent surfaces
 * - Charcoal Card: #16202C — cards, sidebars, modals, and search panels
 * - Frost White: #F1F5F9 — primary text
 * - Shadow Gray: #273548 — borders and dividers
 * - Warm Beige: #D9B08C — optional, restrained secondary highlights
 */

export const SnapFindTokens = {
  colors: {
    // Official Forest Slate & Cyber Teal Palette (Darkened)
    forestSlate: "#1A2220",
    onyx: "#141B19",
    cyberTealDark: "#0A383A",
    cyberTealDeep: "#062122",
    cyberTeal: "#116466",
    cyberTealHover: "#157F81",
    cyberTealLight: "#208E90",
    softMint: "#D1E8E2",
    charcoal: "#16202C",
    charcoalElevated: "#1D2A3A",
    charcoalHover: "#233346",
    frostWhite: "#F1F5F9",
    shadowGray: "#273548",
    shadowGrayLight: "#334155",
    warmBeige: "#D9B08C",

    // Structural Mappings
    bg: "#1A2220",
    bgFrom: "#18211E",
    bgTo: "#0A3638",
    bgGradient: "linear-gradient(135deg, #18211E 0%, #0A3638 100%)",
    landingBg: "#0A383A",
    landingBgGradient: "linear-gradient(160deg, #062122 0%, #0A383A 50%, #041617 100%)",
    surface: "#16202C",
    surfaceElevated: "#1D2A3A",
    surfaceHover: "#233346",
    border: "#273548",
    borderHover: "#334155",

    // Interactive & Brand Accents
    primary: "#116466",
    primaryHover: "#157F81",
    primaryLight: "rgba(17, 100, 102, 0.18)",
    secondary: "#1E293B",
    secondaryHover: "#243347",
    accent: "#116466",
    accentHover: "#157F81",
    accentMint: "#D1E8E2",

    // Semantic States
    ai: "#116466",
    aiHover: "#157F81",
    aiNeon: "#D1E8E2",
    success: "#10B981",
    warning: "#D9B08C",
    attention: "#D9B08C",
    highlight: "#D1E8E2",
    error: "#EF4444",
    danger: "#EF4444",

    // Typography
    textPrimary: "#F1F5F9",
    textSecondary: "#94A3B8",
    textMint: "#D1E8E2",
    textMuted: "#64748B",
    textDisabled: "#475569",
  },
  gradients: {
    primary: "linear-gradient(180deg, #243347 0%, #1E293B 100%)",
    ai: "linear-gradient(135deg, #116466 0%, #157F81 100%)",
    aiSubtle: "linear-gradient(180deg, rgba(17, 100, 102, 0.20) 0%, rgba(17, 100, 102, 0.04) 100%)",
    cardGlow: "0 0 24px -4px rgba(17, 100, 102, 0.25)",
  },
  shadows: {
    primary: "0 2px 14px rgba(17, 100, 102, 0.30)",
    card: "0 4px 20px rgba(11, 15, 25, 0.8)",
    elevated: "0 8px 32px rgba(11, 15, 25, 0.95)",
    tealGlow: "0 0 20px rgba(17, 100, 102, 0.40)",
  },
} as const;

export default SnapFindTokens;
