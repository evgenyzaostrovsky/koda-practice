import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repository, "apps/web/public/achievements/icons");
async function walk(directory) { const entries = await readdir(directory, { withFileTypes: true }); return (await Promise.all(entries.map(async (entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat(); }
const sources = (await walk(root)).filter((file) => file.endsWith(".png"));
let generated = 0;
for (const source of sources) { const target = source.replace(/\.png$/, ".thumb.webp"); const [sourceStat, targetStat] = await Promise.all([stat(source), stat(target).catch(() => null)]); if (targetStat && targetStat.mtimeMs >= sourceStat.mtimeMs) continue; await sharp(source).resize(160, 160, { fit: "contain" }).webp({ quality: 76, alphaQuality: 90, effort: 5 }).toFile(target); generated += 1; }
console.log(`Achievement thumbnails ready: ${sources.length} total, ${generated} generated`);
