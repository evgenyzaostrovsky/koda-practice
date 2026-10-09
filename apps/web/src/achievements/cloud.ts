import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import type { AchievementSnapshot } from "./types";

import { validStudyInterval } from "../study-time";
import { appendStudyJournal, readStudyJournal } from "../study-journal";
const KEY = "koda:achievements:v1";
let currentUser: User | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const syncedManualIds=new Map<string,Set<string>>();
const syncedFor=(userId:string)=>{let ids=syncedManualIds.get(userId);if(!ids){ids=new Set();syncedManualIds.set(userId,ids);}return ids;};
const empty = (): AchievementSnapshot => ({ events: [], unlocked: {}, activeCosmetics: {}, backfillVersion: 0, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });

const cacheKey = (userId?: string) => userId ? `${KEY}:${userId}` : KEY;
export function setAchievementCloudUser(user: User | null) { if(currentUser?.id!==user?.id){window.dispatchEvent(new Event("koda-study-account-leaving"));syncedManualIds.clear();} if(currentUser?.id!==user?.id&&timer){clearTimeout(timer);timer=null} currentUser = user; }

async function loadLearningEvents(userId:string){
 const rows=[];
 for(let offset=0;;offset+=500){
  const page=await supabase!.from("learning_events").select("id,type,payload,occurred_at,local_date,version").eq("user_id",userId).order("id").range(offset,offset+499);
  if(page.error)return{data:rows,error:page.error};
  if(currentUser?.id!==userId)return{data:[],error:null};
  rows.push(...(page.data||[]));if(!page.data||page.data.length<500)break;
 }
 return{data:rows,error:null};
}
export async function hydrateAchievementsFromCloud() {
  if (!supabase || !currentUser) return;
  const userId = currentUser.id;
  const [eventsResult, unlocksResult, statsResult, cosmeticsResult] = await Promise.all([
    loadLearningEvents(userId),
    supabase.from("user_achievements").select("achievement_id,unlocked_at,source_event_id,xp_awarded,seen_at,reward_payload"),
    supabase.from("user_achievement_stats").select("timezone,backfill_version").maybeSingle(),
    supabase.from("user_cosmetics").select("kind,reward_id,active"),
  ]);
  const failure = [eventsResult, unlocksResult, statsResult, cosmeticsResult].find((x) => x.error)?.error;
  if (failure) throw failure;
  let local = empty();
  try { local = { ...local, ...JSON.parse(localStorage.getItem(cacheKey(userId)) || "{}") }; } catch { /* corrupt cache */ }
  const events = new Map([...local.events,...readStudyJournal(userId)].map((event) => [event.eventId, event]));
  for (const row of eventsResult.data || []) {
    if(row.type==="study_interval_recorded"&&!validStudyInterval(row.payload))continue;
    const eventId = row.id.startsWith(`${userId}:`) ? row.id.slice(userId.length + 1) : row.id;
    events.set(eventId, { eventId, type: row.type, payload: row.payload || {}, occurredAt: row.occurred_at, localDate: row.local_date, version: row.version });
  }
  const unlocked = { ...local.unlocked };
  for (const row of unlocksResult.data || []) unlocked[row.achievement_id] = { unlockedAt: row.unlocked_at, sourceEventId: row.source_event_id, xp: row.xp_awarded, seen: Boolean(row.seen_at), celebrated: Boolean(row.reward_payload?.celebrated) };
  const activeCosmetics = { ...local.activeCosmetics };
  for (const row of cosmeticsResult.data || []) if (row.active) activeCosmetics[row.kind] = row.reward_id;
  const merged: AchievementSnapshot = { ...local, events: [...events.values()], unlocked, activeCosmetics, timezone: statsResult.data?.timezone || local.timezone, backfillVersion: Math.max(local.backfillVersion, statsResult.data?.backfill_version || 0) };
  if(currentUser?.id!==userId)return;
  for(const row of eventsResult.data||[])if(row.type==="study_interval_recorded"&&validStudyInterval(row.payload))syncedFor(userId).add(row.id);
  for(const event of merged.events)if(event.type==="study_interval_recorded")appendStudyJournal(userId,event);
  localStorage.setItem(cacheKey(userId), JSON.stringify({...merged,events:merged.events.filter(event=>event.type!=="study_interval_recorded")}));
  window.dispatchEvent(new CustomEvent("koda-achievements-updated"));
  await persistAchievementsToCloud(merged, userId);
}

async function persistAchievementsToCloud(snapshot: AchievementSnapshot, expectedUserId?: string) {
  if (!supabase || !currentUser || (expectedUserId && currentUser.id !== expectedUserId)) return;
  const userId = currentUser.id;
  // The migration uses a globally unique text primary key. Prefixing with the
  // authenticated user keeps identical domain event IDs isolated per account.
  const eventRows = snapshot.events.map((event) => ({ id: `${userId}:${event.eventId}`, user_id: userId, type: event.type, payload: event.payload, occurred_at: event.occurredAt, local_date: event.localDate, version: event.version }));
  const manualRows=eventRows.filter(row=>row.type==="study_interval_recorded"&&!syncedFor(userId).has(row.id)),legacyRows=eventRows.filter(row=>row.type!=="study_interval_recorded");
  const unlockRows = Object.entries(snapshot.unlocked).map(([achievementId, unlock]) => ({ user_id: userId, achievement_id: achievementId, unlocked_at: unlock.unlockedAt, source_event_id: unlock.sourceEventId, xp_awarded: unlock.xp, reward_payload: { celebrated: Boolean(unlock.celebrated) }, seen_at: unlock.seen ? unlock.unlockedAt : null }));
  const cosmeticRows = Object.entries(snapshot.activeCosmetics).map(([kind, rewardId]) => ({ user_id: userId, kind, reward_id: rewardId, active: true }));
  const existingKinds = new Set(cosmeticRows.map((row) => row.kind));
  const deactivate = existingKinds.size
    ? supabase.from("user_cosmetics").update({ active: false }).eq("user_id", userId).in("kind", [...existingKinds])
    : Promise.resolve({ error: null });
  const operations = [
    legacyRows.length ? supabase.from("learning_events").upsert(legacyRows, { onConflict: "id" }) : Promise.resolve({ error: null }),
    unlockRows.length ? supabase.from("user_achievements").upsert(unlockRows, { onConflict: "user_id,achievement_id" }) : Promise.resolve({ error: null }),
    supabase.from("user_achievement_stats").upsert({ user_id: userId, stats: {}, timezone: snapshot.timezone, backfill_version: snapshot.backfillVersion, updated_at: new Date().toISOString() }, { onConflict: "user_id" }),
    deactivate,
  ];
  for(let offset=0;offset<manualRows.length;offset+=500){
    if(currentUser?.id!==userId)return;
    const saved=await supabase.from("learning_events").upsert(manualRows.slice(offset,offset+500),{onConflict:"id",ignoreDuplicates:true});
    if(saved.error)throw saved.error;
    if(currentUser?.id!==userId)return;
    for(const row of manualRows.slice(offset,offset+500))syncedFor(userId).add(row.id);
  }
  const results = await Promise.all(operations);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  if(currentUser?.id!==userId)return;
  if (cosmeticRows.length) {
    const { error: cosmeticError } = await supabase.from("user_cosmetics").upsert(cosmeticRows, { onConflict: "user_id,kind,reward_id" });
    if (cosmeticError) throw cosmeticError;
  }
}

export function scheduleAchievementCloudSave(snapshot: AchievementSnapshot, expectedUserId?:string|null) {
  if (!currentUser || (expectedUserId!==undefined&&currentUser.id!==expectedUserId)) return;
  const userId=currentUser.id;
  if (timer) clearTimeout(timer);
  const copy = structuredClone(snapshot);
  timer = setTimeout(() => persistAchievementsToCloud(copy,userId).catch(() => {if(currentUser?.id===userId)window.dispatchEvent(new Event("koda-study-sync-error"));}), 400);
}

if(typeof window!=="undefined")window.addEventListener("online",()=>{
 if(!currentUser)return;const userId=currentUser.id;
 try{const snapshot=(JSON.parse(localStorage.getItem(cacheKey(userId))||"null")||empty()) as AchievementSnapshot;if(snapshot){snapshot.events=[...new Map([...snapshot.events,...readStudyJournal(userId)].map(event=>[event.eventId,event])).values()];scheduleAchievementCloudSave(snapshot,userId);}}catch{/* corrupted cache is handled by engine */}
});
