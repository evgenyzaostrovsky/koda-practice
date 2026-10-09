import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
// The source SVG component is also the artwork source for downloadable icons.
const requireWeb = createRequire(path.resolve('apps/web/package.json'));
const ts = requireWeb('typescript');
const React = requireWeb('react');
const { renderToStaticMarkup } = requireWeb('react-dom/server');
const manifest = JSON.parse(fs.readFileSync('apps/web/public/achievements/manifest.json', 'utf8'));
const family = manifest.families.find(item => item.slug === '51_study_time');
const map = Object.fromEntries(family.achievements.map((item, index) => [item.id, { family: 51, stage: index + 1 }]));
const source = fs.readFileSync('apps/web/src/achievements/AchievementArt.tsx', 'utf8');
const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX });
const exports = {};
new Function('require', 'exports', compiled)(name => name === './art-map' ? { achievementArtMap: map } : requireWeb(name), exports);
for (const item of family.achievements) {
  const svg = renderToStaticMarkup(React.createElement(exports.AchievementArt, { id: item.id }));
  const file = path.join('apps/web/public/achievements', item.icon);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const markup = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" ');
  fs.writeFileSync(file.replace(/\.png$/, '.svg'), markup + '\n');
  await sharp(Buffer.from(markup)).resize(512,512).png().toFile(file);
  await sharp(file).resize(160,160).webp({ quality:76, alphaQuality:90, effort:5 }).toFile(file.replace(/\.png$/, '.thumb.webp'));
}
console.log(`Generated ${family.achievements.length} study-clock SVGs, PNGs and thumbnails`);
