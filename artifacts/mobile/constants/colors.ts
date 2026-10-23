/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#1d302b',
    tint: '#2f6c60',

    // Core surfaces
    background: '#f5f4ee',
    foreground: '#1d302b',

    // Cards / elevated surfaces
    card: '#fffefa',
    cardForeground: '#1d302b',

    // Primary action color (buttons, links, active states)
    primary: '#2f6c60',
    primaryForeground: '#fffefa',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#e7ece5',
    secondaryForeground: '#294239',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#ecece5',
    mutedForeground: '#718078',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#f0e3c2',
    accentForeground: '#684e21',

    // Destructive actions (delete, error states)
    destructive: '#b84940',
    destructiveForeground: '#fffefa',

    // Borders and input outlines
    border: '#dce2d9',
    input: '#d5ded5',
  },

  dark: {
    text: '#edf2e9',
    tint: '#9bcabc',
    background: '#111b17',
    foreground: '#edf2e9',
    card: '#1a2923',
    cardForeground: '#edf2e9',
    primary: '#9bcabc',
    primaryForeground: '#12201a',
    secondary: '#26372f',
    secondaryForeground: '#e1eee5',
    muted: '#26342e',
    mutedForeground: '#a0b0a5',
    accent: '#483d29',
    accentForeground: '#f2d69a',
    destructive: '#d06a60',
    destructiveForeground: '#fffefa',
    border: '#314139',
    input: '#405349',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
