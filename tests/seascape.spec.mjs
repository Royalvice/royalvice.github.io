import { test, expect } from 'playwright/test';
test.beforeEach(async({page},testInfo)=>{
 await page.route('https://api.visitorbadge.io/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="134" height="20"/>'}));
 if(testInfo.title.includes('unavailable')||testInfo.title.includes('reduced motion'))return;
 await page.goto('/#profile');
 await page.waitForFunction(()=>window.__cabinWindowDebug?.getState().ready,null,{timeout:60000});
});
test('cabin reuses its context and clock through ten expansions',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(()=>window.__cabinWindowDebug.setTime(18));
 for(let i=0;i<10;i++){
  await page.locator('[data-profile-window]').click();
  await expect(page.locator('.cabin-window-dialog')).toBeVisible();
  const open=await page.evaluate(()=>window.__cabinWindowDebug.getState());
  expect(open.time).toBe(18);expect(open.contextCount).toBe(1);expect(open.internalResolution[0]).toBe(960);
  await page.keyboard.press('Escape');await expect(page.locator('[data-profile-window]')).toBeFocused();
 }
 expect(await page.evaluate(()=>window.__cabinWindowDebug.getState().internalResolution)).toEqual([288,120]);
 expect(errors).toEqual([]);
 await page.locator('[data-nav-section=horizon]').click();
 await page.waitForFunction(()=>window.__horizonDebug?.().ready);
 expect(await page.evaluate(()=>window.__horizonDebug().cycleElapsed)).toBe(18);
});
test('cabin has live sea before Horizon loads and preserves event state',async({page})=>{
 const a=await page.evaluate(()=>window.__cabinWindowDebug.getState());await page.waitForTimeout(600);
 const b=await page.evaluate(()=>window.__cabinWindowDebug.getState());expect(b.time).toBeGreaterThan(a.time);expect(b.renders).toBeGreaterThan(a.renders);
 await page.locator('[data-profile-window]').click();
 const box=await page.locator('.cabin-window-surface').boundingBox();
 await page.mouse.click(box.x+box.width*.45,box.y+box.height*.3);
 await page.keyboard.press('Escape');await page.locator('[data-nav-section=horizon]').click();
 await page.waitForFunction(()=>window.__horizonDebug?.().ready);
 expect(await page.evaluate(()=>window.__horizonDebug().fireworkCount)).toBeGreaterThan(0);
});
test('cabin view preserves aperture ratio and bounded parallax',async({page})=>{
 await page.locator('[data-profile-window]').click();const surface=page.locator('.cabin-window-surface');const box=await surface.boundingBox();
 expect(box.width/box.height).toBeCloseTo(2.4,2);
 await page.mouse.move(box.x+box.width*.9,box.y+box.height*.3);await page.waitForTimeout(700);
 const look=await page.evaluate(()=>window.__cabinWindowDebug.getState().look);expect(look[0]).toBeGreaterThan(0);expect(Math.max(...look.map(Math.abs))).toBeLessThan(.0262);
 const room=await page.evaluate(()=>window.__profileAdventureDebug.getState().viewport);
 const win=room.window;const chandelier=room.props.chandelier;
 expect(chandelier.left+chandelier.width/2).toBeCloseTo(room.worldSize[0]/2,0);
 expect(chandelier.top).toBeGreaterThan(win.top+win.height);
});
test('UFO and its effects appear only in Horizon, never in either cabin view',async({page})=>{
 for(const expanded of [false,true]){
  if(expanded)await page.locator('[data-profile-window]').click();
  for(const time of [38.5,40.8,41.2,43.6,44.2]){
   const frame=await page.evaluate(time=>{window.__cabinWindowDebug.setTime(time);return window.__cabinWindowDebug.getState().renders;},time);
   await page.waitForFunction(frame=>window.__cabinWindowDebug.getState().renders>frame,frame);
   const state=await page.evaluate(()=>window.__cabinWindowDebug.getState());
   expect(state.ufoVisible).toBe(0);expect(state.beamStrength).toBe(0);expect(state.moonRipple).toBe(0);
  }
 }
 await page.keyboard.press('Escape');await page.locator('[data-nav-section=horizon]').click();
 await page.waitForFunction(()=>window.__horizonDebug?.().ready);
 await page.evaluate(()=>window.__horizonDebug.setTime(40.8));
 const horizon=await page.evaluate(()=>window.__horizonDebug());
 expect(horizon.ufoVisible).toBe(true);expect(horizon.beamStrength).toBeGreaterThan(0);
});
test('mobile wall and enlarged window remain within the page',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.locator('[data-profile-window]').scrollIntoViewIfNeeded();
 const room=await page.evaluate(()=>window.__profileAdventureDebug.getState().viewport);
 expect(room.props.chandelier.left+room.props.chandelier.width/2).toBeCloseTo(room.worldSize[0]/2,0);
 expect(room.props.chandelier.top).toBeGreaterThan(room.window.top+room.window.height);
 await page.locator('[data-profile-window]').click();
 const r=await page.locator('.cabin-window-dialog').boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(390);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await expect(page.locator('.cabin-window-canvas')).toBeVisible();
});

test('portrait layouts fit the viewport without stretching the cabin',async({page})=>{
 for(const [width,height] of [[1190,1224],[1190,1800],[1440,1600],[1024,1366],[820,1180]]){
  await page.setViewportSize({width,height});
  await expect.poll(()=>page.locator('.profile-adventure-stage').evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width/r.height-4/3);})).toBeLessThan(.001);
  const m=await page.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();return {height:r('#profile').height,leftBottom:r('.profile-console').bottom,rightBottom:r('.gallery-stage').bottom,overflow:document.documentElement.scrollWidth-innerWidth};});
  expect(m.overflow).toBe(0);if(width>=1000)expect(m.leftBottom).toBeCloseTo(m.rightBottom,0);
 }
});

test('cabin remains usable when WebGL is unavailable',async({page})=>{
 await page.addInitScript(()=>{
  const getContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:getContext.call(this,type,...args);};
 });
 await page.goto('/#profile');
 await page.waitForFunction(()=>window.__cabinWindowDebug?.getState().fallback,null,{timeout:60000});
 await page.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('/cabin-fallback.webp')));
 await page.locator('[data-profile-window]').click();
 await expect(page.locator('.cabin-window-canvas')).toBeVisible();
 expect(await page.evaluate(()=>window.__cabinWindowDebug.getState().contextCount)).toBe(0);
 // The generated scene must actually be painted, rather than an empty canvas.
 expect(await page.locator('.cabin-window-canvas').evaluate(c=>c.getContext('2d').getImageData(10,10,1,1).data[3])).toBe(255);
 await page.keyboard.press('Escape');await expect(page.locator('[data-profile-window]')).toBeFocused();
});

test('reduced motion keeps the cabin static while allowing expansion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#profile');
 await page.waitForFunction(()=>window.__cabinWindowDebug?.getState().ready,null,{timeout:60000});
 await page.waitForTimeout(200);const a=await page.evaluate(()=>window.__cabinWindowDebug.getState());
 await page.waitForTimeout(500);const b=await page.evaluate(()=>window.__cabinWindowDebug.getState());
 expect(b.time).toBe(a.time);expect(b.renders).toBe(a.renders);
 await page.locator('[data-profile-window]').click();await expect(page.locator('.cabin-window-canvas')).toBeVisible();
 await page.mouse.move(1300,300);await page.waitForTimeout(200);
 expect(await page.evaluate(()=>window.__cabinWindowDebug.getState().look)).toEqual([0,0]);
 await page.keyboard.press('Escape');await expect(page.locator('[data-profile-window]')).toBeFocused();
});
