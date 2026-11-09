# SnapFind AI — Design System & UX Constitution
*Incorporating UI/UX Pro Max and Hallmark-Inspired Principles*

---

## 1. Core Visual Identity & Dark Theme Palette

SnapFind AI is built upon an intentional, high-contrast, distraction-free aesthetic. We avoid gratuitous 3D meshes, spinning decorative orbs, rainbow gradients, and visual noise in favor of deep surfaces, purposeful typography, and responsive ergonomics.

### Color Tokens
| Token | Hex | Role | Usage |
|---|---|---|---|
| **Deep Forest Slate** | `#1A2220` | Base / Surface Dark | Main app background, sidebar fill, deep surfaces |
| **Cyber Teal** | `#116466` | Primary Brand / Accent | Active navigation states, primary buttons, focal highlights |
| **Soft Mint** | `#D1E8E2` | Soft Accent & Text Contrast | Badges, hover highlights, high-contrast icon accents |
| **Frost White** | `#F1F5F9` | Primary Typography | Headers, primary titles, high-readability body text |
| **Charcoal Surface** | `#16202C` / `#0F172A` | Elevated Cards / Modals | Card containers, modal windows, table rows |
| **Border Tone** | `#273548` / `#334155` | Structural Dividers | Clean 1px dividers, button borders, card outlines |
| **Muted Slate** | `#94A3B8` | Secondary Typography | Metadata labels, timestamps, subtitle summaries |
| **Success Emerald** | `#10B981` | Positive Feedback | OCR verified, tags parsed, search match indicators |
| **Alert Amber** | `#F59E0B` | Warnings & Quota | Quota hints, pending sync, cautionary badges |
| **Danger Rose** | `#EF4444` | Destructive Actions | Trash operations, deletion confirmation, error alerts |

---

## 2. The Single-Line Title Constitution

> **RULE:** Every page title, modal header, card title, and section heading MUST render on **strictly ONE LINE** across all viewports (320px to 1440px+).

### Implementation Pattern:
```tsx
<h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-[#F1F5F9] truncate whitespace-nowrap">
  {title}
</h1>
```
- Use `truncate` and `whitespace-nowrap` on all headings (`h1`, `h2`, `h3`).
- Use responsive font sizing (`text-base sm:text-lg md:text-xl` or `text-lg sm:text-xl md:text-2xl`) so headings naturally fit narrow mobile screens (320px, 360px, 375px) without clipping early.
- Parent containers must have `min-w-0` to allow flexbox truncation to function reliably.

---

## 3. Mobile-First Layout & Touch Ergonomics

Every screen, modal, and drawer must provide a first-class experience on screens as narrow as 320px.

### Touch Targets
- **Minimum 44px** height and width for all tap targets (`min-h-[44px] min-w-[44px]`, or `py-2.5 px-4` with flex alignment).
- Bottom navigation bar: fixed at screen bottom with 56px height, high z-index (`z-40`), safe-area padding (`pb-[env(safe-area-inset-bottom)]`).

### Button & Control Usability
- **Header Actions**: Group action buttons using `flex flex-wrap items-center gap-2` or `flex-col sm:flex-row w-full sm:w-auto`.
- On narrow viewports (<640px), action bars must cleanly stack or wrap rather than push beyond the screen width.
- Zero horizontal overflow (`overflow-x-hidden` on main container, `w-full max-w-full`).

---

## 4. Anti-Slop Discipline & Clean Icon Badges

- **No Gratuitous 3D Orbs**: Removed spinning SVGs, neon ring animations, and decorative 3D floating shapes that consume vertical and horizontal space.
- **Functional Icon Badges**: Replaced with clean, crisp, rounded 40–48px icon badges using Lucide icons styled in cyber teal and soft mint.
- **Meaningful Information Architecture**: Every component presents real screenshot data, OCR text, extracted URLs, detected QR codes, or actual user settings.
- **Accordion & Detail Flow**: The Screenshot Information viewer shows only categories that contain genuine data, keeping cognitive load minimal.

---

## 5. Viewport Breakpoint Matrix

| Device Class | Viewport Range | Layout Behavior |
|---|---|---|
| **Compact Mobile** | 320px – 375px | 1-column grid, stacked action buttons, truncated 18px titles, compact padding (p-3) |
| **Standard Mobile** | 390px – 430px | 1-column grid, full-width touch targets, 20px titles, bottom bar navigation |
| **Tablet / Foldable** | 768px – 834px | 2-column screenshot grid, inline action buttons, collapsible sidebar |
| **Desktop** | 1024px – 1440px | 3 to 4-column screenshot grid, full sidebar, multi-panel inspector |
| **Ultra-Wide** | >1440px | Centered max-width containers (`max-w-7xl mx-auto`), comfortable negative space |
