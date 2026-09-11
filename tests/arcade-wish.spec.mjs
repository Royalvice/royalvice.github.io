import {test,expect} from 'playwright/test';
const key='yzy.arcade.wish-coin.v1';
async function readyRoom(page){
  await page.route('https://api.visitorbadge.io/**',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'}));
  await page.goto('/?profile-gif-export=1#profile');
  await page.waitForFunction(()=>window.__profileAdventureDebug?.getState().ready,null,{timeout:90000});
}
async function open(page){await page.locator('[data-profile-tv]').click();await page.waitForFunction(()=>window.__arcadeCabinetDebug?.getState().renderer?.active);}
test('six real sky clicks earn one persistent keepsake; insertion is one-time',async({page})=>{
  test.setTimeout(process.env.ARCADE_SOFTWARE_RENDERING?300000:150000);await readyRoom(page);await open(page);
  await expect(page.locator('[data-arcade-wallet]')).toHaveText('0');
  await page.locator('[data-arcade-insert]').click();await expect(page.locator('[data-arcade-status]')).toHaveText('还没有金币，到处点点吧');
  await page.keyboard.press('Escape');
  if(process.env.ARCADE_SOFTWARE_RENDERING)await page.setViewportSize({width:720,height:720});
  await page.goto('/#horizon');
  await page.waitForFunction(()=>window.__horizonDebug?.().ready,null,{timeout:90000});
  const sky=page.locator('[data-horizon-scene]');await sky.scrollIntoViewIfNeeded();
  const rect=await sky.boundingBox();
  for(let i=0;i<5;i++)await page.mouse.click(rect.x+rect.width*.42,rect.y+rect.height*.23);
  expect(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),key))).toMatchObject({clicks:5,earned:false});
  await page.mouse.click(rect.x+rect.width*.43,rect.y+rect.height*.24);
  await expect(page.locator('.horizon-wish-notice')).toBeVisible();
  expect(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),key))).toMatchObject({clicks:6,earned:true,inserted:false});
  await page.waitForTimeout(2000);await page.screenshot({path:'/tmp/yzy-wish-fireworks.png'});
  await page.reload();await page.waitForFunction(()=>window.__horizonDebug?.().ready,null,{timeout:90000});
  const r=await sky.boundingBox();await page.mouse.click(r.x+r.width*.43,r.y+r.height*.24);
  await expect(page.locator('.horizon-wish-notice')).toHaveCount(0);
  await readyRoom(page);await open(page);await expect(page.locator('[data-arcade-wallet]')).toHaveText('1');
  await page.locator('[data-arcade-insert]').click();await expect(page.locator('[data-arcade-wallet]')).toHaveText('∞');
  expect(await page.evaluate(()=>window.__arcadeCabinetDebug.getState().renderer.coinAnimating)).toBeTruthy();
  await page.waitForTimeout(1300);await page.locator('[data-arcade-insert]').click();await expect(page.locator('[data-arcade-status]')).toHaveText('已经投过了');
  await page.reload();await page.waitForFunction(()=>window.__profileAdventureDebug?.getState().ready);await open(page);await expect(page.locator('[data-arcade-wallet]')).toHaveText('∞');
});
test('native cheat options and unlimited credit pulses reach the real Metal Slug core',async({page,request})=>{
  test.setTimeout(process.env.ARCADE_SOFTWARE_RENDERING?300000:150000);const availability=await(await request.get('/arcade/availability.json')).json();test.skip(!availability.games?.mslug?.available,'Hosted Metal Slug cartridge required');
  await page.addInitScript(k=>localStorage.setItem(k,JSON.stringify({clicks:6,earned:true,inserted:true})),key);
  await readyRoom(page);await open(page);await page.locator('[data-arcade-load]').click();
  await page.waitForFunction(()=>window.__arcadeCabinetDebug.getState().emulator?.frame>200,null,{timeout:180000});
  await page.locator('[data-arcade-cheats] summary').click();
  const cheat=page.locator('[data-arcade-cheat-list] select').first();await expect(cheat).toBeVisible();await cheat.selectOption({index:1});
  expect((await page.evaluate(()=>window.__arcadeCabinetDebug.getState().emulator)).cheats.length).toBe(1);
  await cheat.selectOption({index:0});expect((await page.evaluate(()=>window.__arcadeCabinetDebug.getState().emulator)).cheats.length).toBe(0);
  await page.locator('[data-arcade-cheats] summary').click();await page.locator('[data-arcade-scene]').focus();
  for(let i=0;i<12;i++){await page.keyboard.press('5');await page.waitForTimeout(120);}
  await expect(page.locator('[data-arcade-wallet]')).toHaveText('∞');
  await page.keyboard.press('Enter');await page.waitForTimeout(2500);
  const state=await page.evaluate(()=>window.__arcadeCabinetDebug.getState());expect(state.playing).toBeTruthy();
  // Joystick ball stays below the projected glass, including its own radius.
  expect(state.renderer.joystick.y).toBeGreaterThan(state.renderer.screenBounds[1].y+25);
  await page.screenshot({path:'/tmp/yzy-arcade-final-desktop.png'});
});
test('mobile cabinet and virtual controls fit without horizontal overflow',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage();await readyRoom(page);await open(page);
  await expect(page.locator('.arcade-touch')).toBeVisible();
  const bounds=await page.locator('[data-arcade-dialog]').evaluate(el=>({r:el.getBoundingClientRect().toJSON(),w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollWidth}));
  expect(bounds.r.right).toBeLessThanOrEqual(bounds.w);expect(bounds.r.bottom).toBeLessThanOrEqual(bounds.h);expect(bounds.scroll).toBe(390);
  const heights=await page.locator('.arcade-touch button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));expect(heights.every(h=>h>=44)).toBeTruthy();
  await page.screenshot({path:'/tmp/yzy-arcade-final-phone.png'});await context.close();
});
