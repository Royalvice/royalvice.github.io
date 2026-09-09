import {test,expect} from 'playwright/test';
import fs from 'node:fs';
test.beforeEach(async({page})=>{await page.route('https://api.visitorbadge.io/**',r=>r.fulfill({body:'',contentType:'image/svg+xml'}));});
for(const [width,height] of [[1920,1080],[1440,900],[1280,720],[1180,820],[1024,1366],[768,1024],[390,844],[360,740]])test(`profile fits ${width}×${height}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/#profile',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__profileAdventureDebug?.getState().ready);await page.waitForTimeout(200);
 const compact=width<1000;

 const metrics=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{top:r.top,bottom:r.bottom,width:r.width,height:r.height,left:r.left,right:r.right}};return{scene:rect('#profile'),left:rect('.profile-console'),right:rect('.gallery-stage'),room:rect('.profile-adventure-stage'),overflow:document.documentElement.scrollWidth-innerWidth};});
 expect(metrics.scene.top).toBe(0);expect(metrics.room.width/metrics.room.height).toBeCloseTo(4/3,2);expect(metrics.room.bottom).toBeLessThan(metrics.scene.bottom);expect(metrics.overflow).toBeLessThanOrEqual(1);
 if(!compact){expect(metrics.left.bottom).toBeCloseTo(metrics.right.bottom,0);expect(metrics.left.top).toBeCloseTo(metrics.right.top,0);const name=await page.locator('#profile-title').boundingBox(),avatar=await page.locator('.avatar-spotlight').boundingBox();expect(name.y).toBeGreaterThanOrEqual(avatar.y+avatar.height-1);}
 else{await expect(page.locator('.gallery-stage')).toBeHidden();await expect(page.locator('#profile-title')).toBeVisible();}
});
test('all Ruru standing and walking clips have a fixed subpixel body origin',()=>{const report=JSON.parse(fs.readFileSync('artifacts/dungeon-rebuild/action-pack-report.json'));const clips=report.filter(r=>r.clip.startsWith('ruru/')&&!r.clip.endsWith('/sleep'));expect(clips.length).toBeGreaterThanOrEqual(5);for(const c of clips){expect(c.anchor).toBe('torso');for(const axis of [0,1]){const values=c.alignment.map(a=>a.alignedCenter[axis]);expect(Math.max(...values)-Math.min(...values)).toBeLessThanOrEqual(1);}}});
test('actors may cross one another while swept furniture collision still blocks movement',async({page})=>{
 await page.goto('/#profile',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__profileAdventureDebug?.getState().ready);
 const result=await page.evaluate(async()=>{const {ProfileRoomSimulation:S}=await import('/src/profile/ProfileRoomSimulation.ts');const single=new S(true),crowded=new S(true);for(const s of [single,crowded]){s.control('nobita');const a=s.getState().actors.nobita;a.position=[.50,.68];a.previousPosition=[.50,.68];s.setInput(1,0);}const friend=crowded.getState().actors.doraemon;friend.position=[.54,.68];friend.previousPosition=[.54,.68];friend.nextDecisionAt=1e9;for(let i=0;i<120;i++){single.step(1/60);crowded.step(1/60);}const furniture=new S(true);furniture.control('nobita');const a=furniture.getState().actors.nobita;a.position=[.24,.635];a.previousPosition=[.24,.635];furniture.setInput(0,-1,true);let penetrated=false;for(let i=0;i<600;i++){furniture.step(1/60);if(!furniture.isWalkable(a.position))penetrated=true;}return{single:single.getState().actors.nobita.position,crowded:crowded.getState().actors.nobita.position,penetrated,stopped:a.position};});
 expect(result.crowded).toEqual(result.single);expect(result.penetrated).toBe(false);expect(result.stopped[1]).toBeGreaterThan(.58);
});

test('losing window focus clears held movement',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#profile',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__profileAdventureDebug?.getState().ready);await page.locator('[data-profile-actor=nobita]').click();await page.keyboard.down('d');await page.waitForTimeout(200);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForTimeout(100);const distance=await page.evaluate(()=>window.__profileAdventureDebug.getState().actors.nobita.walkDistance);await page.waitForTimeout(200);expect(await page.evaluate(()=>window.__profileAdventureDebug.getState().actors.nobita.walkDistance)).toBeCloseTo(distance,5);await page.keyboard.up('d');
});
