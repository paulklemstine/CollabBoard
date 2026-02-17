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

/**
 * Convert RGB to HSL
 */
const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

    if (max === r) {
      h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / diff + 2) / 6;
    } else {
      h = ((r - g) / diff + 4) / 6;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
};

/**
 * Convert HSL to RGB
 */
const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

/**
 * Convert RGB to hex
 */
const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Get complementary color by rotating hue 180 degrees
 * Also adjusts lightness and saturation for better visual effect
 *
 * @param color - Hex color string (with or without #)
 * @returns Complementary color as hex string
 */
export const getComplementaryColor = (color: string): string => {
  const { r, g, b } = hexToRgb(color);
  const { h, s, l } = rgbToHsl(r, g, b);

  // Rotate hue by 180 degrees for complementary color
  const compH = (h + 180) % 360;

  // Adjust saturation and lightness for better border visibility
  // Increase saturation slightly and darken a bit
  const compS = Math.min(100, s * 1.2);
  const compL = Math.max(20, Math.min(80, l * 0.7));

  const compRgb = hslToRgb(compH, compS, compL);
  return rgbToHex(compRgb.r, compRgb.g, compRgb.b);
};
