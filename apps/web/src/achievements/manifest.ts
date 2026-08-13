import type { AchievementManifest } from "./types";
const URL = "/achievements/manifest.json";
let cached: AchievementManifest | null = null;
let pending: Promise<AchievementManifest> | null = null;
export function loadAchievementManifest() { if (cached) return Promise.resolve(cached); if (!pending) pending = fetch(URL).then((response) => { if (!response.ok) throw new Error("Achievement manifest unavailable"); return response.json() as Promise<AchievementManifest>; }).then((manifest) => (cached = manifest)).finally(() => { pending = null; }); return pending; }
export function getCachedAchievementManifest() { return cached; }
export function clearAchievementManifestCache() { cached = null; pending = null; }
