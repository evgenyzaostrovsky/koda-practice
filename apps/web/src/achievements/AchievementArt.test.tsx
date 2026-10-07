import fs from "node:fs";
import path from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AchievementArt } from "./AchievementArt";
import { achievementArtMap } from "./art-map";
import type { AchievementManifest } from "./types";

const manifest = JSON.parse(fs.readFileSync(path.resolve("public/achievements/manifest.json"), "utf8")) as AchievementManifest;
afterEach(cleanup);

describe("achievement family artwork", () => {
  it("renders a distinct motif for every family preview", () => {
    const { container } = render(<>{manifest.families.map((family) => <AchievementArt key={family.slug} id={family.achievements[0].id} />)}</>);
    const artwork = [...container.querySelectorAll(".achievement-art")];
    expect(artwork).toHaveLength(50);
    const motifs = artwork.map((art) => art.querySelector('path[stroke-width="2"]')?.getAttribute("d"));
    expect(motifs.every(Boolean)).toBe(true);
    expect(new Set(motifs).size).toBe(50);
    artwork.forEach((art) => expect(art).toHaveAttribute("aria-hidden", "true"));
  });

  it("maps every stable achievement ID to its catalog family and stage", () => {
    manifest.families.forEach((family) => {
      family.achievements.forEach((achievement, index) => {
        expect(achievementArtMap[achievement.id], achievement.id).toEqual({ family: Number(family.slug.slice(0, 2)), stage: index + 1 });
      });
    });
  });
});
