/**
 * Calculate relative luminance of a color using WCAG 2.0 formula
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
const getRelativeLuminance = (r: number, g: number, b: number): number => {
  // Normalize RGB values to 0-1
  const [rs, gs, bs] = [r / 255, g / 255, b / 255];

  // Apply gamma correction
  const toLinear = (c: number) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const rLinear = toLinear(rs);
  const gLinear = toLinear(gs);
  const bLinear = toLinear(bs);

  // Calculate relative luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
};

/**
 * Convert hex color to RGB values
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  // Remove # if present
  hex = hex.replace('#', '');

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return { r, g, b };
};

/**
 * Get contrasting text color (black or white) for a given background color
 * Uses WCAG 2.0 relative luminance to determine contrast
 *
 * @param backgroundColor - Hex color string (with or without #)
 * @returns '#000000' for light backgrounds, '#ffffff' for dark backgrounds
 */
export const getContrastTextColor = (backgroundColor: string): string => {
  const { r, g, b } = hexToRgb(backgroundColor);
  const luminance = getRelativeLuminance(r, g, b);

  // Threshold of 0.5 provides good contrast for most colors
  // Colors with luminance > 0.5 are considered "light" and get black text
  // Colors with luminance <= 0.5 are considered "dark" and get white text
  return luminance > 0.5 ? '#000000' : '#ffffff';
};
