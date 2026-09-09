import {test,expect} from 'playwright/test';
test.beforeEach(async({page})=>{
 await page.route('https://api.visitorbadge.io/**',r=>r.fulfill({body:'',contentType:'image/svg+xml'}));
});

test('fifteen door worlds cycle once per opening and wrap without changing while open',async({page})=>{
 await page.goto('/#profile',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__profileAdventureDebug?.getState().ready);
 await page.locator('.profile-adventure-stage').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>window.__profileAdventureDebug.getState().viewport.doorDestination.loaded===15);
 const ids=[];
 for(let i=0;i<16;i++){
  const id=await page.evaluate(()=>{
   const d=window.__profileAdventureDebug;d.setDoorOpen(false);d.setDoorOpen(true);d.pause();
   return d.getState().viewport.doorDestination.destination.id;
  });
  ids.push(id);
  await page.evaluate(()=>{window.__profileAdventureDebug.setDoorOpen(true);window.__profileAdventureDebug.pause();});
  expect(await page.evaluate(()=>window.__profileAdventureDebug.getState().viewport.doorDestination.destination.id)).toBe(id);
  await expect(page.locator('[data-profile-door]')).toHaveAttribute('data-destination',id);
 }
 expect(new Set(ids.slice(0,15)).size).toBe(15);expect(ids[15]).toBe(ids[0]);
});

test('one unavailable destination cannot block the room or door interaction',async({page})=>{
 await page.route('**/anywhere-door-v2/wisteria.webp',r=>r.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#profile',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__profileAdventureDebug?.getState().ready);
 await page.locator('.profile-adventure-stage').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>window.__profileAdventureDebug.getState().viewport.doorDestination.failed===1);
 await page.evaluate(()=>{
  const d=window.__profileAdventureDebug;d.setDoorOpen(false);d.setDoorOpen(true);d.setDoorOpen(false);d.setDoorOpen(true);d.pause();
 });
 expect(await page.evaluate(()=>window.__profileAdventureDebug.getState().viewport.doorDestination.destination.id)).toBe('wisteria');
 await expect(page.locator('[data-profile-door]')).toBeEnabled();expect(errors).toEqual([]);
});
