import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AchievementsPage } from "./AchievementsPage";
import { clearAchievementManifestCache } from "./manifest";
import type { AchievementManifest } from "./types";

vi.mock("../api", () => ({ api: vi.fn().mockResolvedValue({ solved_ids: [], modules: [], total: 200 }) }));
vi.mock("./cloud", () => ({ scheduleAchievementCloudSave: vi.fn() }));
const manifest = JSON.parse(fs.readFileSync(path.resolve("public/achievements/manifest.json"), "utf8")) as AchievementManifest;
const open = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AchievementsPage /></QueryClientProvider>);
beforeEach(() => {
  clearAchievementManifestCache();
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => manifest }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("achievement room behavior", () => {
  it("keeps the ten room families in fixed slots even when another family is earned",async()=>{
    const slugs=['01_solved_tasks','03_course_progress','05_error_recovery','07_sandbox','08_own_data','19_comeback','20_flexible_rhythm','37_panorama','45_first_mini_analysis','51_study_time'];
    const outsider=manifest.families.find(f=>!slugs.includes(f.slug))!;
    localStorage.setItem('koda:achievements:v1',JSON.stringify({events:[],unlocked:{[outsider.achievements[0].id]:{unlockedAt:'2026-01-01',sourceEventId:'qa-outside-room',xp:10,seen:true,celebrated:true}},activeCosmetics:{},backfillVersion:2,timezone:'UTC'}));
    open();await screen.findByRole('button',{name:'Показать названия'});
    const buttons=[...document.querySelectorAll<HTMLButtonElement>('.room-trophy')];
    expect(buttons).toHaveLength(10);
    buttons.forEach((button,index)=>{const family=manifest.families.find(f=>f.slug===slugs[index])!;expect(button.getAttribute('aria-label')).toBe(`${family.name}. Не начато`);expect(button.style.getPropertyValue('--room-x')).toBeTruthy();expect(button.style.getPropertyValue('--room-y')).toBeTruthy();expect(button.querySelector('image')).not.toBeNull();});
    expect(buttons.some(button=>button.getAttribute('aria-label')?.startsWith(outsider.name+'.'))).toBe(false);
  });
  it("limits the room to ten accessible objects and exposes all fifty-one families in the collection", async () => {
    open();
    await screen.findByRole("button", { name: "Показать названия" });
    const roomObjects = [...document.querySelectorAll<HTMLButtonElement>(".room-trophy")];
    expect(roomObjects).toHaveLength(10);
    roomObjects.forEach(button => {
      expect(button.getAttribute("aria-label")).toBeTruthy();
      expect(button.tabIndex).toBe(0);
      expect(button.querySelector("span")).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Показать названия" }));
    expect(document.querySelectorAll(".room-trophy > span")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Показать названия" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Вся коллекция" }));
    expect(document.querySelectorAll(".family-preview")).toHaveLength(51);
    expect(document.querySelector(".achievement-room")).toBeNull();
  });

  it("displays the highest earned stage and keeps locked objects separate", async () => {
    localStorage.setItem("koda:achievements:v1", JSON.stringify({ events: [], unlocked: {
      first_task: { unlockedAt: "2026-01-01", sourceEventId: "a", xp: 50, seen: true },
      warmup: { unlockedAt: "2026-01-02", sourceEventId: "b", xp: 50, seen: true },
    }, activeCosmetics: {}, backfillVersion: 1, timezone: "UTC" }));
    open();
    const title = manifest.families[0].achievements[1].name;
    const earned = await screen.findByRole("button", { name: `${manifest.families[0].name}. ${title}` });
    expect(earned).toHaveClass("earned");
    expect(earned.querySelector(".achievement-art")).toHaveAttribute("data-tier", "2");
    expect(document.querySelectorAll(".room-trophy.locked")).toHaveLength(9);
  });

  it("recovers from a manifest failure through the visible retry action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true, json: async () => manifest }));
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить коллекцию");
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByRole("button", { name: "Показать названия" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
