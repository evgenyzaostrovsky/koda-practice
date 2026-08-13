import type { SyntheticEvent } from "react";
import type { AchievementDefinition } from "./types";
export const achievementOriginalUrl = (definition: AchievementDefinition) => `/achievements/${definition.icon}`;
export const achievementThumbnailUrl = (definition: AchievementDefinition, manifestVersion: string) => `${achievementOriginalUrl(definition).replace(/\.png$/i, ".thumb.webp")}?v=${encodeURIComponent(manifestVersion)}`;
export function fallbackToOriginal(event: SyntheticEvent<HTMLImageElement>, definition: AchievementDefinition) { const image = event.currentTarget; image.onerror = null; image.src = achievementOriginalUrl(definition); }
