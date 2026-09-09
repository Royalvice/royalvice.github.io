import {test,expect} from 'playwright/test';import fs from 'node:fs';
test.beforeEach(async({page})=>{await page.route('https://api.visitorbadge.io/**',r=>r.fulfill({body:'',contentType:'image/svg+xml'}));await page.goto('/#profile',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__profileAdventureDebug?.getState().ready);});
test('resizing keeps biography and room visible together with no tabs or cabinet bars',async({page})=>{
 for(const [w,h] of [[1452,1088],[1920,1080],[2560,1080],[1440,600],[1440,900],[1180,1218],[1000,1200],[999,1200],[768,1024],[390,844],[360,740],[1440,900]]){
  await page.setViewportSize({width:w,height:h});
  await expect.poll(()=>page.evaluate(()=>document.querySelector('#voyage').getBoundingClientRect().top+scrollY-innerHeight)).toBeGreaterThanOrEqual(-1);
  await expect(page.locator('.profile-view-tabs')).toHaveCount(0);
  await expect(page.locator('.profile-top')).toBeVisible();
  await expect(page.locator('.future-slot')).toBeVisible();
  await expect.poll(()=>page.locator('.profile-adventure-stage').evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.width/r.height-4/3)})).toBeLessThan(.001);
  const panorama=w>=2000&&w/h>2.15;
  if(!panorama)await expect.poll(()=>page.evaluate(()=>Math.abs(document.querySelector('.future-slot').getBoundingClientRect().top-document.querySelector('.profile-top').getBoundingClientRect().bottom-8))).toBeLessThan(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  if(w<1000)await expect(page.locator('.gallery-stage')).toBeHidden();
  else {
   await expect(page.locator('.gallery-stage')).toBeVisible();
   await expect.poll(()=>page.locator('.gallery-mount').evaluate(e=>{const r=e.getBoundingClientRect();return r.width/r.height})).toBeGreaterThan(.94);
   await expect.poll(()=>page.locator('.gallery-mount').evaluate(e=>{const r=e.getBoundingClientRect();return r.width/r.height})).toBeLessThan(1.26);
  }
 }
});
test('all 77 clips preserve their source timing and art while using audited body pivots',async({page})=>{
 const report=JSON.parse(fs.readFileSync('artifacts/cabin-v7/registration-report.json'));expect(report).toHaveLength(77);expect(report.reduce((sum,r)=>sum+r.frames,0)).toBe(1172);
 for(const sub of ['sprites','actions']){const before=JSON.parse(fs.readFileSync(`artifacts/cabin-v7/${sub}-manifest-before.json`)),now=await page.evaluate(sub=>fetch(`/assets/profile/dungeon-v5/${sub}/manifest.json`).then(r=>r.json()),sub);const flatten=m=>sub==='sprites'?Object.fromEntries(Object.entries(m).flatMap(([id,c])=>Object.entries(c).map(([key,v])=>[id+'/'+key,v]))):m;for(const [key,c]of Object.entries(flatten(before))){const current=flatten(now)[key];expect(current.count).toBe(c.count);expect(current.fps).toBe(c.fps);expect(current.image).toBe(c.image);for(let i=0;i<c.frames.length;i++){expect(current.frames[i].rect).toEqual(c.frames[i].rect);expect(current.frames[i].pivot[1]).toBe(c.frames[i].pivot[1]);expect(current.frames[i].registration.sampleRows).toBeGreaterThan(2);}}}
 expect(report.find(r=>r.clip==='nobita/nap').beforeCenterRange).toBeGreaterThan(20);
});
test('ImageGen plant and tea table decode and fit the shared room coordinates',async({page})=>{
 const state=await page.evaluate(()=>window.__profileAdventureDebug.getState().viewport);expect(state.furnitureAssets.flowers).toBe('ready');expect(state.furnitureAssets.coffeeTable).toBe('ready');const m=await page.evaluate(()=>fetch('/assets/profile/dungeon-v8/furniture/manifest.json').then(r=>r.json()));for(const [key,asset] of [['flowers','plant'],['coffeeTable','tea-table']]){const p=state.props[key];expect(p.width/p.height).toBeCloseTo(m[asset].size[0]/m[asset].size[1],3);}
});

test('late profile text reflow cannot leave a stale blank card height',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await page.locator('.profile-intro').evaluate(e=>e.style.fontSize='25px');await expect.poll(()=>page.evaluate(()=>Math.abs(document.querySelector('.future-slot').getBoundingClientRect().top-document.querySelector('.profile-top').getBoundingClientRect().bottom-8))).toBeLessThan(2);
 await page.locator('.profile-intro').evaluate(e=>e.style.fontSize='18px');await expect.poll(()=>page.evaluate(()=>Math.abs(document.querySelector('.future-slot').getBoundingClientRect().top-document.querySelector('.profile-top').getBoundingClientRect().bottom-8))).toBeLessThan(2);
});

test('a short portrait profile keeps its navigation and live room active at the top',async({page})=>{
 await page.setViewportSize({width:390,height:1000});await expect(page.locator('[data-nav-section=profile]')).toHaveAttribute('aria-current','page');const before=await page.evaluate(()=>window.__profileAdventureDebug.getState().simulationElapsed);await expect.poll(()=>page.evaluate(()=>window.__profileAdventureDebug.getState().simulationElapsed)).toBeGreaterThan(before);
});
