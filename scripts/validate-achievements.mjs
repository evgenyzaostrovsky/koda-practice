import fs from "node:fs";
import path from "node:path";

const root = path.resolve("apps/web/public/achievements");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
);
const rules = fs.readFileSync(
  path.resolve("apps/web/src/achievements/rules.ts"),
  "utf8",
);
const definitions = manifest.families.flatMap((family) => family.achievements);
const ids = definitions.map((definition) => definition.id);
const paths = definitions.map((definition) => definition.icon);

if (definitions.length !== manifest.achievement_count)
  throw Error("achievement_count does not match definitions");
if (manifest.families.length !== manifest.family_count)
  throw Error("family_count does not match families");
if (new Set(ids).size !== ids.length)
  throw Error("achievement ids must be unique");
if (
  new Set(manifest.families.map((family) => family.slug)).size !==
  manifest.families.length
)
  throw Error("family slugs must be unique");
if (new Set(paths).size !== paths.length)
  throw Error("achievement icon paths must be unique");

for (const definition of definitions) {
  if (!new RegExp(`\\b${definition.id}\\s*:`).test(rules))
    throw Error(`missing rule: ${definition.id}`);
  const file = path.join(root, definition.icon);
  if (!fs.existsSync(file)) throw Error(`missing icon: ${definition.icon}`);
  const bytes = fs.readFileSync(file);
  if (bytes.toString("ascii", 1, 4) !== "PNG")
    throw Error(`not PNG: ${definition.icon}`);
  if (bytes.readUInt32BE(16) !== 512 || bytes.readUInt32BE(20) !== 512)
    throw Error(`wrong size: ${definition.icon}`);
  if (![4, 6].includes(bytes[25]))
    throw Error(`no alpha channel: ${definition.icon}`);
  const thumbnail = file.replace(/\.png$/i, ".thumb.webp");
  if (!fs.existsSync(thumbnail)) throw Error(`missing thumbnail: ${definition.icon}`);
  const thumbnailBytes = fs.readFileSync(thumbnail);
  if (thumbnailBytes.toString("ascii", 0, 4) !== "RIFF" || thumbnailBytes.toString("ascii", 8, 12) !== "WEBP")
    throw Error(`invalid WebP thumbnail: ${definition.icon}`);
  if (thumbnailBytes.length > 40_000) throw Error(`thumbnail too large: ${definition.icon}`);
}

const iconRoot = path.join(root, "icons");
const walk = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    );
const actual = walk(iconRoot)
  .filter((file) => file.endsWith(".png"))
  .map((file) => path.relative(root, file).replaceAll("\\", "/"));
const orphaned = actual.filter((file) => !paths.includes(file));
if (orphaned.length) throw Error(`orphan icons: ${orphaned.join(", ")}`);

console.log(
  `Achievements valid: ${definitions.length} achievements, ${manifest.families.length} families, ${paths.length} icons and thumbnails`,
);
