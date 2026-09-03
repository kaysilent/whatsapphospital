/**
 * Single source of truth for the color-theme catalog.
 */

export const THEME_IDS = [
  "emerald",
  "violet",
  "cobalt",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "emerald";

export const STORAGE_KEY = "wacrm.theme.v2";

/**
 * MODE — the light/dark dimension.
 */
export const MODES = ["light", "dark"] as const;

export type Mode = (typeof MODES)[number];

export const DEFAULT_MODE: Mode = "light";

export const MODE_STORAGE_KEY = "wacrm.mode";

export function isMode(value: unknown): value is Mode {
  return (
    typeof value === "string" && (MODES as ReadonlyArray<string>).includes(value)
  );
}

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: string;
}

export const THEMES: ReadonlyArray<ThemeMeta> = [
  {
    id: "emerald",
    name: "Emerald Hospital",
    tagline: "Clinical healthcare & WhatsApp green — clean, professional, trusted.",
    swatch: "oklch(0.58 0.17 162)",
  },
  {
    id: "cobalt",
    name: "Cobalt Medical",
    tagline: "Calm clinical blue — focused and structured.",
    swatch: "oklch(0.585 0.2 254)",
  },
  {
    id: "violet",
    name: "Violet Modern",
    tagline: "Contemporary digital health accent.",
    swatch: "oklch(0.526 0.247 293)",
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    (THEME_IDS as ReadonlyArray<string>).includes(value)
  );
}
