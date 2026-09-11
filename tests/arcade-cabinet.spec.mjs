import {test,expect} from 'playwright/test';
import {readFile} from 'node:fs/promises';

async function openCabinet(page) {
  await page.route('https://api.visitorbadge.io/**',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20"/>'}));
  await page.goto('/?profile-gif-export=1#profile');
  await page.waitForFunction(()=>window.__profileAdventureDebug?.getState().ready,null,{timeout:90000});
  await page.locator('[data-profile-tv]').click();
  await page.waitForFunction(()=>window.__arcadeCabinetDebug?.getState().renderer?.screenVertices===825);
  expect((await page.evaluate(()=>window.__arcadeCabinetDebug.getState())).renderer.buffer.every(value=>value>0)).toBe(true);
}
test('catalog and missing-ROM states never spend coins or boot an empty emulator',async({page})=>{
  await page.route('**/arcade/availability.json',route=>route.fulfill({json:{games:{}}}));
  await openCabinet(page);
  await expect(page.locator('[data-arcade-game]')).toHaveCount(15);
  await expect(page.locator('[data-arcade-wallet]')).toHaveText('0');
  await page.locator('[data-arcade-game="raiden2"]').click();
  await expect(page.locator('[data-arcade-title]')).toHaveText('雷电 II');
  await page.locator('[data-arcade-scene]').focus();
  await page.keyboard.press('5');
  expect((await page.evaluate(()=>window.__arcadeCabinetDebug.getState())).coins).toBe(0);
  await page.keyboard.press('Escape');await expect(page.locator('[data-arcade-dialog]')).toBeHidden();
  await expect(page.locator('[data-profile-tv]')).toBeFocused();
  await page.locator('[data-profile-tv]').click();
  expect((await page.evaluate(()=>window.__arcadeCabinetDebug.getState())).renderer.contexts).toBe(1);
});
test('unlimited credits require an unlock and remain debounced across input sources',async({page})=>{
  await page.goto('/arcade/runner.html?game=invalid');
  const result=await page.evaluate(async()=>{
    const {ArcadeSession}=await import('/src/arcade/ArcadeSession.ts');
    const events=[];const session=new ArcadeSession((index,down)=>events.push([index,down]));
    session.input(2,true,'key');const unloaded=session.coins;
    session.ready=true;session.paused=false;session.unlocked=true;
    for(let n=0;n<12;n++){
      session.input(2,true,'key');session.input(2,true,'key');session.input(2,true,'touch');
      await new Promise(resolve=>setTimeout(resolve,110));
      session.input(2,false,'key');session.input(2,false,'touch');
    }
    session.input(4,true,'key');session.input(4,true,'touch');session.input(4,false,'key');
    const stillHeld=session.pressed.includes(4);session.release();
    return {unloaded,coins:session.coins,pulses:events.filter(([i,d])=>i===2&&d).length,releases:events.filter(([i,d])=>i===2&&!d).length,stillHeld,held:session.pressed};
  });
  expect(result).toEqual({unloaded:0,coins:Infinity,pulses:12,releases:13,stillHeld:true,held:[]});
});
test('phone keeps cabinet and touch controls inside viewport',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage();await openCabinet(page);
  await expect(page.locator('.arcade-touch')).toBeVisible();
  const geometry=await page.locator('[data-arcade-dialog]').evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth}));
  expect(geometry.rect.right).toBeLessThanOrEqual(geometry.width);expect(geometry.rect.bottom).toBeLessThanOrEqual(geometry.height);expect(geometry.overflow).toBe(390);
  const controls=await page.locator('.arcade-touch button').evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().height));expect(controls).toHaveLength(6);expect(controls.every(size=>size>=44)).toBe(true);
  const stick=page.locator('[data-arcade-stick]');await expect(stick).toBeVisible();
  const r=await stick.boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2;
  expect(r.width).toBeGreaterThanOrEqual(96);
  await page.mouse.move(cx,cy);await page.mouse.down();
  await expect(stick).toHaveAttribute('data-direction','');
  await page.mouse.move(cx+30,cy-30);await expect(stick).toHaveAttribute('data-direction','4,7');
  await page.mouse.move(cx-30,cy+30);await expect(stick).toHaveAttribute('data-direction','5,6');
  await page.mouse.up();await expect(stick).toHaveAttribute('data-direction','');
  expect(await stick.evaluate(el=>[el.style.getPropertyValue('--stick-x'),el.style.getPropertyValue('--stick-y')])).toEqual(['0px','0px']);
  await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+30,cy);
  await expect(stick).toHaveAttribute('data-direction','7');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(stick).toHaveAttribute('data-direction','');await page.mouse.up();
  await page.screenshot({path:'/tmp/royalvice-arcade-phone.png'});
  await context.close();
});
test('a missing Neo Geo BIOS is an error, never a playable board or spent token',async({page,request})=>{
  const inventory=await (await request.get('/arcade/availability.json')).json();
  test.skip(!inventory.games?.mslug?.available,'Requires the hosted Metal Slug cartridge.');
  const emptyZip=Buffer.alloc(22);emptyZip.writeUInt32LE(0x06054b50);
  await page.route('**/arcade/bios/neogeo.zip',route=>route.fulfill({body:emptyZip,contentType:'application/zip'}));
  await openCabinet(page);await page.locator('[data-arcade-load]').click();
  await page.waitForFunction(()=>window.__arcadeCabinetDebug.getState().phase==='error',null,{timeout:90000});
  await page.locator('[data-arcade-scene]').focus();await page.keyboard.press('5');
  const state=await page.evaluate(()=>window.__arcadeCabinetDebug.getState());
  expect(state.coins).toBe(0);expect(state.emulator.started).toBe(false);expect(state.playing).toBe(false);
});
test('real FBNeo feeds the curved CRT, receives coins, pauses and preserves its session',async({page})=>{
  test.setTimeout(150000);
  // Optional non-commercial test fixture, downloaded from MAME's authorized page.
  // It is never shipped or renamed as one of the user's requested games.
  const romPath=process.env.ARCADE_TEST_ROM;
  test.skip(!romPath,'Set ARCADE_TEST_ROM to the official Gridlee test ZIP.');
  const catalog=JSON.parse(await readFile(new URL('../public/arcade/catalog.json',import.meta.url),'utf8'));
  catalog[0]={id:'gridlee',title:'Gridlee · 本地验证',name:'GRIDLEE',year:1982,system:'VIDEA',genre:'TEST FIXTURE',buttons:2};
  await page.route('**/arcade/catalog.json',route=>route.fulfill({json:catalog}));
  await page.route('**/arcade/availability.json',route=>route.fulfill({json:{games:{gridlee:{available:true,missing:[]}}}}));
  await page.route('**/arcade/roms/gridlee.zip',route=>route.fulfill({path:romPath,contentType:'application/zip'}));
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('yzy.arcade.wish-coin.v1',JSON.stringify({clicks:6,earned:true,inserted:true})));
  await openCabinet(page);await page.locator('[data-arcade-load]').click();
  await page.waitForFunction(()=>window.__arcadeCabinetDebug.getState().emulator?.frame>100,null,{timeout:90000});
  await page.locator('[data-arcade-scene]').focus();await page.keyboard.press('5');
  await expect(page.locator('[data-arcade-wallet]')).toHaveText('∞');
  const coin=await page.evaluate(()=>window.__arcadeCabinetDebug.getState().renderer.targets.find(control=>control.index===2));
  const canvasRect=await page.locator('[data-arcade-scene]').boundingBox();
  await page.waitForTimeout(120);
  await page.mouse.click(canvasRect.x+coin.x,canvasRect.y+coin.y);
  await expect(page.locator('[data-arcade-wallet]')).toHaveText('∞');
  await page.keyboard.press('Enter');
  const before=await page.evaluate(()=>window.__arcadeCabinetDebug.getState());
  await page.keyboard.press('p');await page.waitForTimeout(200);
  const paused=await page.evaluate(()=>window.__arcadeCabinetDebug.getState());
  await page.waitForTimeout(300);expect((await page.evaluate(()=>window.__arcadeCabinetDebug.getState())).emulator.frame).toBe(paused.emulator.frame);
  await page.keyboard.press('Escape');await page.locator('[data-profile-tv]').click();
  await expect(page.locator('[data-arcade-wallet]')).toHaveText('∞');
  await page.locator('[data-arcade-load]').click();
  await page.waitForFunction(frame=>window.__arcadeCabinetDebug.getState().emulator.frame>frame,before.emulator.frame);
  await page.screenshot({path:'/tmp/royalvice-arcade-playing.png'});
  expect((await page.evaluate(()=>window.__arcadeCabinetDebug.getState())).iframes).toBe(1);
  expect(errors).toEqual([]);
});
