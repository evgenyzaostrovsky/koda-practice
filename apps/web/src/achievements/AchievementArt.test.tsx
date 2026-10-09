import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AchievementArt } from "./AchievementArt";
import { achievementArtMap } from "./art-map";
import { glassAchievementAtlas } from "./glass-atlas-map";
import { GlassAchievementArt } from "./GlassAchievementArt";
import type { AchievementManifest } from "./types";

const manifest = JSON.parse(fs.readFileSync(path.resolve("public/achievements/manifest.json"), "utf8")) as AchievementManifest;
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

describe("achievement family artwork", () => {
  it("renders a distinct motif for every family preview", () => {
    const { container } = render(<>{manifest.families.map((family) => <AchievementArt key={family.slug} id={family.achievements[0].id} />)}</>);
    const artwork = [...container.querySelectorAll(".achievement-art")];
    expect(artwork).toHaveLength(51);
    const motifs = artwork.map((art) => art.querySelector("image") ? `${art.querySelector("image")?.getAttribute("href")}:${art.querySelector("svg")?.getAttribute("viewBox")}` : art.querySelector(".art-motif")?.getAttribute("d"));
    expect(motifs.every(Boolean)).toBe(true);
    expect(new Set(motifs).size).toBe(51);
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

 it("changes silhouette geometry for every milestone within a family",()=>{
 for (const family of manifest.families) {
 const view=render(<>{family.achievements.map(item=><AchievementArt key={item.id} id={item.id}/>)}</>);
 const shapes=[...view.container.querySelectorAll(".achievement-art")].map(el=>el.querySelector("image") ? el.querySelector("svg")?.getAttribute("viewBox") : el.querySelector(".art-shell")?.getAttribute("d"));
 expect(new Set(shapes).size).toBe(family.achievements.length); view.unmount();
 }
 });

it("maps exactly the forty existing room milestones to separate bounded atlas regions",()=>{
 const families=manifest.families.filter(f=>[1,3,5,7,8,19,20,37,45,51].includes(Number(f.slug.slice(0,2))));
 expect(Object.keys(glassAchievementAtlas).sort()).toEqual(families.flatMap(f=>f.achievements.map(a=>a.id)).sort());
 expect(Object.keys(glassAchievementAtlas)).toHaveLength(40);
 const crops=new Set<string>();
 for(const family of families)family.achievements.forEach((a,index)=>{const r=glassAchievementAtlas[a.id], [x,y,w,h]=r.crop;expect(r.stage).toBe(index+1);expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0);expect(w).toBeGreaterThan(0);expect(h).toBeGreaterThan(0);expect(x+w).toBeLessThanOrEqual(r.atlasWidth);expect(y+h).toBeLessThanOrEqual(r.atlasHeight);expect(r.baseline).toBeGreaterThan(y);expect(r.baseline).toBeLessThanOrEqual(y+h);const key=`${r.src}:${r.crop.join(',')}`;expect(crops.has(key)).toBe(false);crops.add(key);expect(fs.existsSync(path.resolve('public',r.src.slice(1)))).toBe(true);});
});
it("keeps labelled and unknown artwork accessible and recovers a failed raster through vector art",()=>{
 const view=render(<AchievementArt id="first_task" label="Первая задача"/>);
 expect(view.getByRole('img',{name:'Первая задача'})).toBeInTheDocument();
 const image=view.container.querySelector('image')!;expect(image).not.toBeNull();fireEvent.error(image);
 expect(view.container.querySelector('image')).toBeNull();expect(view.container.querySelector('.art-motif')).not.toBeNull();
 expect(view.getByRole('img',{name:'Первая задача'})).toBeInTheDocument();
 view.rerender(<AchievementArt id="unknown-qa" label="Неизвестное достижение"/>);expect(view.getByRole('img',{name:'Неизвестное достижение'})).toBeInTheDocument();expect(view.container.querySelector('image')).toBeNull();
});
it("notifies a later-mounted stage when its atlas previously failed without another SVG error",async()=>{
 let probes=0;vi.stubGlobal('Image',class{onerror:(()=>void)|null=null;onload:(()=>void)|null=null;set src(_value:string){probes++;queueMicrotask(()=>this.onerror?.());}});
 const region={...glassAchievementAtlas.first_task,src:'/qa-only-failed-atlas.png'},first=vi.fn(),later=vi.fn();
 const view=render(<GlassAchievementArt region={region} onError={first}/>);await waitFor(()=>expect(first).toHaveBeenCalledTimes(1));view.unmount();
 render(<GlassAchievementArt region={{...region,stage:2}} onError={later}/>);await waitFor(()=>expect(later).toHaveBeenCalledTimes(1));expect(probes).toBe(1);
});
