import { expect,test } from '@playwright/test';
import fs from 'node:fs';
import { glassAchievementAtlas } from '../../apps/web/src/achievements/glass-atlas-map';
const manifest=JSON.parse(fs.readFileSync('apps/web/public/achievements/manifest.json','utf8'));
const slugs=['01_solved_tasks','03_course_progress','05_error_recovery','07_sandbox','08_own_data','19_comeback','20_flexible_rhythm','37_panorama','45_first_mini_analysis','51_study_time'];
const families=slugs.map(slug=>manifest.families.find((f:{slug:string})=>f.slug===slug));
for(const width of [1280,390])test(`glass assets share all forty real stages and fixed room positions at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(({ids})=>{const unlocked=Object.fromEntries(ids.map(id=>[id,{unlockedAt:'2026-10-08T12:00:00Z',sourceEventId:'qa-glass:'+id,xp:10,seen:true,celebrated:true}]));localStorage.setItem('koda:achievements:v1',JSON.stringify({events:[],unlocked,activeCosmetics:{},backfillVersion:2,timezone:'UTC'}));},{ids:families.flatMap(f=>f.achievements.map((a:{id:string})=>a.id))});
 await page.goto('/achievements');await expect(page.locator('.room-trophy')).toHaveCount(10);
 for(let index=0;index<families.length;index++){
  const family=families[index],last=family.achievements.at(-1),r=glassAchievementAtlas[last.id],object=page.locator('.room-trophy').nth(index);
  await expect(object.locator('.achievement-art')).toHaveAttribute('data-tier',String(family.achievements.length));
  await expect(object.locator('image')).toHaveAttribute('href',r.src);await expect(object.locator('svg svg')).toHaveAttribute('viewBox',r.crop.join(' '));
  await object.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  const steps=dialog.locator('.family-step');await expect(steps).toHaveCount(family.achievements.length);
  for(let n=0;n<family.achievements.length;n++){const region=glassAchievementAtlas[family.achievements[n].id];await expect(steps.nth(n).locator('image')).toHaveAttribute('href',region.src);await expect(steps.nth(n).locator('svg svg')).toHaveAttribute('viewBox',region.crop.join(' '));}
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 }
 await page.screenshot({path:`reports/qa-glass-room-highest-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Вся коллекция',exact:true}).click();await expect(page.locator('.family-preview')).toHaveCount(51);
 for(const family of families){const preview=page.getByRole('button',{name:new RegExp('^'+family.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))});await expect(preview.locator('image')).toHaveAttribute('href',glassAchievementAtlas[family.achievements.at(-1).id].src);}
 const assetEvidence=await page.evaluate(async(srcs)=>{const results=[];for(const src of srcs){const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0);const rgba=ctx.getImageData(0,0,c.width,c.height).data;let transparent=0,opaque=0,neon=0;for(let i=0;i<rgba.length;i+=4){if(rgba[i+3]===0)transparent++;if(rgba[i+3]===255)opaque++;const alpha=rgba[i+3]/255;const red=rgba[i]*alpha+242*(1-alpha),green=rgba[i+1]*alpha+238*(1-alpha),blue=rgba[i+2]*alpha+225*(1-alpha);if(green>200&&red<100&&blue<150)neon++;}results.push({src,width:c.width,height:c.height,transparent,opaque,neon});}return results;},[...new Set(Object.values(glassAchievementAtlas).map(r=>r.src))]);
 for(const item of assetEvidence){expect(item.transparent).toBeGreaterThan(0);expect(item.opaque).toBeGreaterThan(0);const region=Object.values(glassAchievementAtlas).find(r=>r.src===item.src)!;expect(item.width).toBe(region.atlasWidth);expect(item.height).toBe(region.atlasHeight);}
 // Material acceptance concerns a visible halo at product sizes; isolated
 // antialiased green-edge highlights in native atlas pixels are permissible.
 const displayed=await page.evaluate(async regions=>{
  const images=new Map<string,HTMLImageElement>(),results=[];
  for(const region of regions){if(!images.has(region.src)){const image=new Image();image.src=region.src;await image.decode();images.set(region.src,image);}
   for(const size of[100,120,160]){const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f2eee1';ctx.fillRect(0,0,size,size);const[x,y,w,h]=region.crop,scale=Math.min(size/w,size/h);ctx.drawImage(images.get(region.src)!,x,y,w,h,0,0,w*scale,h*scale);const rgba=ctx.getImageData(0,0,size,size).data,spots=new Set<number>();for(let k=0;k<rgba.length;k+=4)if(rgba[k+1]>200&&rgba[k]<100&&rgba[k+2]<150)spots.add(k/4);const total=spots.size;let largest=0;
    while(spots.size){const first=spots.values().next().value!;spots.delete(first);const stack=[first];let area=0;while(stack.length){const point=stack.pop()!;area++;for(const next of[point-1,point+1,point-size,point+size])if(spots.delete(next))stack.push(next);}largest=Math.max(largest,area);}results.push({size,total,largest});}
  }return results;
 },Object.values(glassAchievementAtlas));
 for(const item of displayed){expect(item.largest).toBeLessThanOrEqual(4);expect(item.total/(item.size*item.size)).toBeLessThan(.0005);}
});
test('a failed glass atlas visibly falls back to existing vector artwork',async({page})=>{
 await page.route('**/achievements/glass/*.png',route=>route.abort());await page.goto('/achievements');await expect(page.locator('.room-trophy')).toHaveCount(10);await expect(page.locator('.room-trophy image')).toHaveCount(0);await expect(page.locator('.room-trophy .achievement-art')).toHaveCount(10);
 await expect(page.locator('.room-trophy').first().locator('.art-motif')).toHaveCount(1);await page.locator('.room-clock').click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('.family-step image')).toHaveCount(0);
});
