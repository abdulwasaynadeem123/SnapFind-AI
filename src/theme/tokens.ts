/**
 * SnapFind AI - Centralized Design Tokens & Color System
 *
 * Official Palette (Dark Claymorphism & Lime Green Accent):
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

export const SnapFindTokens = {
  colors: {
    // 11-Color System
    mainBg: "#080908",
    secondaryBg: "#0D0F0D",
    cardBg: "#141714",
    elevatedSurface: "#1B1F1A",
    hoverSurface: "#222720",
    primaryText: "#F7F8F5",
    secondaryText: "#A5AAA1",
    mutedText: "#777E74",
    border: "#30362E",
    primaryGreen: "#B7F36B",
    greenHover: "#A5E65A",

    // Structural Mappings
    bg: "#080908",
    bgFrom: "#080908",
    bgTo: "#080908",
    bgGradient: "#080908",
    landingBg: "#080908",
    landingBgGradient: "#080908",
    surface: "#141714",
    surfaceElevated: "#1B1F1A",
    surfaceHover: "#222720",
    borderHover: "#B7F36B",

    // Interactive & Brand Accents
    primary: "#B7F36B",
    primaryHover: "#A5E65A",
    primaryLight: "rgba(183, 243, 107, 0.15)",
    secondary: "#1B1F1A",
    secondaryHover: "#222720",
    accent: "#B7F36B",
    accentHover: "#A5E65A",
    accentMint: "#B7F36B",

    // Semantic States
    ai: "#B7F36B",
    aiHover: "#A5E65A",
    aiNeon: "#B7F36B",
    success: "#B7F36B",
    warning: "#B7F36B",
    attention: "#B7F36B",
    highlight: "#B7F36B",
    error: "#EF4444",
    danger: "#EF4444",

    // Typography
    textPrimary: "#F7F8F5",
    textSecondary: "#A5AAA1",
    textMint: "#B7F36B",
    textMuted: "#777E74",
    textDisabled: "#777E74",
  },
  gradients: {
    primary: "#141714",
    ai: "#B7F36B",
    aiSubtle: "rgba(183, 243, 107, 0.1)",
    cardGlow: "0 0 24px -4px rgba(0, 0, 0, 0.6)",
  },
  shadows: {
    clayCard: "6px 6px 16px rgba(0,0,0,0.65), -2px -2px 8px rgba(255,255,255,0.025)",
    clayInset: "inset 3px 3px 6px rgba(0,0,0,0.65), inset -2px -2px 5px rgba(255,255,255,0.02)",
    claySurface: "4px 4px 12px rgba(0,0,0,0.6), -2px -2px 6px rgba(255,255,255,0.02)",
    primary: "2px 2px 8px rgba(0,0,0,0.4)",
    card: "6px 6px 16px rgba(0,0,0,0.65)",
    elevated: "8px 8px 24px rgba(0,0,0,0.85)",
  },
} as const;

export default SnapFindTokens;
