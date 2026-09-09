import { test, expect } from 'playwright/test';

test.beforeEach(async({page})=>{
 await page.route('https://api.visitorbadge.io/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'}));
});
const state=page=>page.evaluate(()=>window.__homeMusicDebug.getState());
async function openRoom(page){
 await page.goto('/#profile');
 await page.waitForFunction(()=>window.__profileAdventureDebug?.getState().ready);
 await page.waitForFunction(()=>document.querySelector('audio[data-home-music]')?.readyState>=1);
}

test('one real audio track continues between the music box and cloud, with shared seeking and pause',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openRoom(page);
 expect((await state(page)).playing).toBe(false);
 await page.locator('[data-music-box]').click();
 await expect.poll(async()=>(await state(page)).time).toBeGreaterThan(.4);
 const before=await state(page);
 expect(before.playing).toBe(true);expect(before.duration).toBeGreaterThan(416);expect(before.duration).toBeLessThan(418);
 await page.locator('[data-nav-section=horizon]').click();
 await expect(page.locator('[data-music-cloud]')).toHaveAttribute('data-playing','true');
 await page.waitForFunction(()=>window.__horizonDebug?.().ready);
 await expect.poll(()=>page.locator('#horizon').evaluate(el=>Math.abs(el.getBoundingClientRect().top))).toBeLessThan(3);
 expect((await state(page)).time).toBeGreaterThanOrEqual(before.time);
 const beforeFireworks=await page.evaluate(()=>window.__horizonDebug().fireworkCount);
 const range=await page.locator('[data-music-seek]').boundingBox();
 await page.mouse.click(range.x+range.width*.35,range.y+range.height/2);
 await expect.poll(async()=>(await state(page)).time).toBeGreaterThan(130);
 expect((await state(page)).time).toBeLessThan(160);
 expect(await page.evaluate(()=>window.__horizonDebug().fireworkCount)).toBe(beforeFireworks);
 await page.locator('[data-music-cloud] [data-music-toggle]').click();
 await expect.poll(async()=>(await state(page)).playing).toBe(false);
 const paused=(await state(page)).time;await page.waitForTimeout(350);expect((await state(page)).time).toBe(paused);
 await page.locator('[data-nav-section=profile]').click();
 await expect(page.locator('[data-music-box]')).toHaveAttribute('aria-pressed','false');
 await page.locator('[data-music-box]').click();await expect.poll(async()=>(await state(page)).time).toBeGreaterThan(paused);
 expect((await state(page)).audioElements).toBe(1);expect(errors).toEqual([]);
});

test('scrolling into Horizon starts the track when playback is allowed, and respects pause until reentry',async({page})=>{
 await openRoom(page);
 // A genuine page gesture permits audible autoplay in Chromium, without
 // using the music box or the navigation click shortcut.
 await page.getByRole('heading',{name:'Zongyuan Yang',exact:true}).click();
 await page.locator('#horizon').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
 await expect.poll(async()=>(await state(page)).playing).toBe(true);
 await page.locator('[data-music-cloud] [data-music-toggle]').click();
 await page.waitForTimeout(500);expect((await state(page)).playing).toBe(false);
 await page.locator('[data-nav-section=profile]').click();
 await expect.poll(async()=>(await state(page)).section).toBe('profile');
 await page.locator('#horizon').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
 await expect.poll(async()=>(await state(page)).playing).toBe(true);
});

test('a fresh Horizon entry handles blocked autoplay and the cloud button recovers',async({page})=>{
 await page.addInitScript(()=>{
  const nativePlay=HTMLMediaElement.prototype.play;
  window.__musicAutoplayAttempts=0;
  let trustedGesture=false;
  document.addEventListener('click',event=>{if(event.isTrusted)trustedGesture=true;},true);
  HTMLMediaElement.prototype.play=function(){
   if(this.matches('audio[data-home-music]')){
    window.__musicAutoplayAttempts++;
    if(!trustedGesture)return Promise.reject(new DOMException('User gesture required','NotAllowedError'));
   }
   return nativePlay.call(this);
  };
 });
 await page.goto('/#horizon');
 await expect(page.locator('[data-music-cloud]')).toHaveAttribute('data-state','blocked');
 expect(await page.evaluate(()=>window.__musicAutoplayAttempts)).toBeGreaterThan(0);
 await expect(page.locator('[data-music-cue]')).toHaveText('Tap to play');
 await page.locator('[data-music-cloud] [data-music-toggle]').click();
 await expect.poll(async()=>(await state(page)).time).toBeGreaterThan(.3);
 await expect(page.locator('[data-music-cue]')).toHaveText('');
});

test('the cloud player fits desktop and portrait skies, while the music box stays on its desk',async({page})=>{
 await openRoom(page);
 for(const [width,height] of [[1920,1080],[1190,1224],[820,1180],[390,844]]){
  await page.setViewportSize({width,height});

  await expect.poll(()=>page.evaluate(()=>{
   const box=document.querySelector('[data-music-box]').getBoundingClientRect(),canvas=document.querySelector('.profile-sprite-canvas').getBoundingClientRect();
   return box.left>=canvas.left&&box.right<=canvas.right&&box.top>=canvas.top&&box.bottom<=canvas.bottom;
  })).toBe(true);
  const room=await page.evaluate(()=>window.__profileAdventureDebug.getState().viewport);
  expect(room.musicBox.width/room.musicBox.height).toBeCloseTo(1.25,4);
  expect(room.musicBox.left).toBeGreaterThan(room.props.secondaryDesk.left);
  expect(room.musicBox.left+room.musicBox.width).toBeLessThan(room.props.secondaryDesk.left+room.props.secondaryDesk.width);
  await page.locator('#horizon').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
  await expect.poll(async()=>(await state(page)).section).toBe('horizon');
  const geometry=await page.locator('[data-music-cloud]').evaluate(el=>{
   const r=el.getBoundingClientRect(),scene=el.closest('#horizon').getBoundingClientRect();
   return {left:r.left,right:r.right,top:(r.top-scene.top)/scene.height,bottom:(r.bottom-scene.top)/scene.height};
  });
  expect(geometry.left).toBeGreaterThan(0);expect(geometry.right).toBeLessThanOrEqual(width);
  expect(geometry.top).toBeGreaterThan(.20);expect(geometry.bottom).toBeLessThan(.48);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  await page.locator('#profile').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
 }
});

test('missing audio shows a recoverable control without breaking the room',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/assets/audio/returning-home-parijat.mp3',route=>route.fulfill({status:404,body:''}));
 await page.goto('/#horizon');
 await expect(page.locator('[data-music-cloud]')).toHaveAttribute('data-state','error');
 await expect(page.locator('[data-music-cue]')).toHaveText('Tap to retry');
 await expect(page.locator('[data-music-seek]')).toBeDisabled();
 expect(errors).toEqual([]);
});

test('cloud lettering is drawn in the sea canvas, stays aligned after resize, and survives context loss as accessible text',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#horizon');
 await page.waitForFunction(()=>window.__horizonDebug?.().cloudMusic.enabled);
 await expect(page.locator('[data-music-cloud]')).toHaveAttribute('data-cloud-material','true');
 await expect(page.locator('.music-cloud-title')).toHaveCSS('opacity','0');
 for(const [width,height] of [[1600,1000],[390,844]]){
  await page.setViewportSize({width,height});
  await page.locator('#horizon').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
  await page.waitForTimeout(250);
  const pixels=await page.evaluate(()=>{
   window.__horizonDebug.setTime(8);
   const canvas=document.querySelector('[data-horizon-scene]'),gl=canvas.getContext('webgl2');
   const r=window.__horizonDebug().cloudMusic.rect;
   const x=Math.floor(r[0]*canvas.width),y=Math.floor((1-r[1]-r[3])*canvas.height),w=Math.ceil(r[2]*canvas.width),h=Math.ceil(r[3]*canvas.height);
   const pixels=new Uint8Array(w*h*4);gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   // Moonlit ink must actually exist in the WebGL framebuffer; hiding DOM
   // text alone, a missing atlas, or a failed material cannot pass this check.
   let lit=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>105&&pixels[i+1]>110&&pixels[i+2]>95)lit++;
   const heading=document.querySelector('.music-cloud-title').getBoundingClientRect(),scene=canvas.getBoundingClientRect();
   return {lit,aligned:Math.abs(r[0]*scene.width-(heading.left-scene.left-6))<2};
  });
  expect(pixels.lit).toBeGreaterThan(80);expect(pixels.aligned).toBe(true);
 }
 await page.evaluate(()=>document.querySelector('[data-horizon-scene]').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
 await expect(page.locator('.music-cloud-title')).toHaveCSS('opacity','1');
 await expect(page.locator('.music-cloud-title strong')).toHaveText('Returning Home');
 await page.locator('[data-music-cloud] [data-music-toggle]').click();
 await expect.poll(async()=>(await state(page)).time).toBeGreaterThan(.2);
 expect(errors).toEqual([]);
});

test('reduced motion renders cloud glyphs after font loading without creating a separate scene',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/#horizon');
 await page.waitForFunction(()=>window.__horizonDebug?.().cloudMusic.enabled);
 await page.evaluate(()=>document.fonts.ready);
 await expect(page.locator('[data-music-cloud]')).toHaveAttribute('data-cloud-material','true');
 const before=await page.evaluate(()=>window.__horizonDebug());
 await page.waitForTimeout(300);
 const after=await page.evaluate(()=>window.__horizonDebug());
 expect(after.running).toBe(false);expect(after.cycleElapsed).toBe(before.cycleElapsed);
 expect(after.cloudMusic.textureRevision).toBe(before.cloudMusic.textureRevision);
 await expect(page.locator('#horizon canvas')).toHaveCount(1);
});

for (const viewport of [{width:1600,height:1000},{width:390,height:844}]) {
 test(`paused music stays paused throughout upward scrolling into Voyage at ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);
  await openRoom(page);
  await page.evaluate(()=>document.fonts.ready);
  await page.getByRole('heading',{name:'Zongyuan Yang',exact:true}).click();
  await page.locator('#horizon').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
  await expect.poll(async()=>(await state(page)).section).toBe('horizon');
  await expect.poll(async()=>(await state(page)).playing).toBe(true);
  await page.locator('[data-music-cloud] [data-music-toggle]').click();
  await expect.poll(async()=>(await state(page)).playing).toBe(false);
  const paused=(await state(page)).time;
  await page.evaluate(()=>{
   window.__unexpectedMusicStarts=0;
   document.querySelector('audio[data-home-music]').addEventListener('play',()=>window.__unexpectedMusicStarts++);
  });
  await page.mouse.move(40,viewport.height*.65);
  // Cross every observer threshold, including the period when both pages
  // remain visible. An instant navigation skips the original regression.
  await page.locator('#voyage').evaluate(el=>el.scrollIntoView({behavior:'smooth'}));
  await expect.poll(()=>page.locator('#voyage').evaluate(el=>Math.abs(el.getBoundingClientRect().top))).toBeLessThan(3);
  await expect.poll(async()=>(await state(page)).section).toBe('voyage');
  expect(await page.evaluate(()=>window.__unexpectedMusicStarts)).toBe(0);
  expect((await state(page)).playing).toBe(false);
  expect((await state(page)).time).toBe(paused);
  // A new, deliberate descent into the third page is allowed to resume.
  await page.locator('#horizon').evaluate(el=>el.scrollIntoView({behavior:'smooth'}));
  await expect.poll(async()=>(await state(page)).section).toBe('horizon');
  await expect.poll(async()=>(await state(page)).time).toBeGreaterThan(paused);
 });
}
