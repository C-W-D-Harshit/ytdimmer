import { browser } from "wxt/browser";

export type ProtectionPreset = "gentle" | "balanced" | "maximum" | "custom";
export type SiteMode = "protect" | "paused";

export interface DimmerSettings {
  enabled: boolean;
  dimLevel: number;
  brightnessThreshold: number;
  preset: ProtectionPreset;
  scheduleEnabled: boolean;
  scheduleStart: number;
  scheduleEnd: number;
  siteRules: Record<string, SiteMode>;
}

export interface RuntimeStatus {
  available: boolean;
  enabled: boolean;
  sitePaused: boolean;
  videoDetected: boolean;
  videoPlaying: boolean;
  brightness: number;
  protectionActive: boolean;
  protectionCount: number;
  hostname: string;
}

export const STORAGE_KEYS = {
  enabled: "ytDimmerEnabled",
  dimLevel: "ytDimmerDimLevel",
  brightnessThreshold: "ytDimmerBrightnessThreshold",
  preset: "ytDimmerPreset",
  scheduleEnabled: "ytDimmerScheduleEnabled",
  scheduleStart: "ytDimmerScheduleStart",
  scheduleEnd: "ytDimmerScheduleEnd",
  siteRules: "ytDimmerSiteRules",
} as const;

export const DEFAULT_SETTINGS: DimmerSettings = {
  enabled: true,
  dimLevel: 0.55,
  brightnessThreshold: 0.62,
  preset: "balanced",
  scheduleEnabled: false,
  scheduleStart: 20,
  scheduleEnd: 6,
  siteRules: {},
};

export const PRESETS: Record<
  Exclude<ProtectionPreset, "custom">,
  Pick<DimmerSettings, "dimLevel" | "brightnessThreshold">
> = {
  gentle: { dimLevel: 0.35, brightnessThreshold: 0.72 },
  balanced: { dimLevel: 0.55, brightnessThreshold: 0.62 },
  maximum: { dimLevel: 0.78, brightnessThreshold: 0.48 },
};

const ALL_STORAGE_KEYS = Object.values(STORAGE_KEYS);

export async function getSettings(): Promise<DimmerSettings> {
  const stored = await browser.storage.sync.get(ALL_STORAGE_KEYS);
  return {
    enabled: stored[STORAGE_KEYS.enabled] ?? DEFAULT_SETTINGS.enabled,
    dimLevel: stored[STORAGE_KEYS.dimLevel] ?? DEFAULT_SETTINGS.dimLevel,
    brightnessThreshold:
      stored[STORAGE_KEYS.brightnessThreshold] ??
      DEFAULT_SETTINGS.brightnessThreshold,
    preset: stored[STORAGE_KEYS.preset] ?? DEFAULT_SETTINGS.preset,
    scheduleEnabled:
      stored[STORAGE_KEYS.scheduleEnabled] ?? DEFAULT_SETTINGS.scheduleEnabled,
    scheduleStart:
      stored[STORAGE_KEYS.scheduleStart] ?? DEFAULT_SETTINGS.scheduleStart,
    scheduleEnd:
      stored[STORAGE_KEYS.scheduleEnd] ?? DEFAULT_SETTINGS.scheduleEnd,
    siteRules: stored[STORAGE_KEYS.siteRules] ?? DEFAULT_SETTINGS.siteRules,
  };
}

export async function saveSettings(
  patch: Partial<DimmerSettings>,
): Promise<void> {
  const storedPatch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const storageKey = STORAGE_KEYS[key as keyof DimmerSettings];
    if (storageKey) storedPatch[storageKey] = value;
  }
  await browser.storage.sync.set(storedPatch);
}

export async function initializeSettings(): Promise<void> {
  const stored = await browser.storage.sync.get(ALL_STORAGE_KEYS);
  const defaults: Record<string, unknown> = {};

  for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
    if (stored[storageKey] === undefined) {
      defaults[storageKey] = DEFAULT_SETTINGS[key as keyof DimmerSettings];
    }
  }

  if (Object.keys(defaults).length > 0) {
    await browser.storage.sync.set(defaults);
  }
}

export function isScheduleActive(
  settings: Pick<
    DimmerSettings,
    "scheduleEnabled" | "scheduleStart" | "scheduleEnd"
  >,
  hour = new Date().getHours(),
): boolean {
  if (!settings.scheduleEnabled) return false;
  if (settings.scheduleStart === settings.scheduleEnd) return true;
  if (settings.scheduleStart < settings.scheduleEnd) {
    return hour >= settings.scheduleStart && hour < settings.scheduleEnd;
  }
  return hour >= settings.scheduleStart || hour < settings.scheduleEnd;
}

export function getEffectiveDimLevel(settings: DimmerSettings): number {
  const nightBoost = isScheduleActive(settings) ? 0.12 : 0;
  return Math.min(0.9, settings.dimLevel + nightBoost);
}

export function isSitePaused(
  settings: Pick<DimmerSettings, "siteRules">,
  hostname: string,
): boolean {
  return settings.siteRules[hostname] === "paused";
}

export function storageChangesTouchSettings(
  changes: Record<string, unknown>,
): boolean {
  return ALL_STORAGE_KEYS.some((key) => key in changes);
}
