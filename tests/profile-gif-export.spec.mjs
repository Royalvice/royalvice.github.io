import {test,expect} from 'playwright/test';
import {CARD_SPECS} from '../tools/profile-gif-export/specs.mjs';

test('the export drives real commands, visits every news item and resets the 3D scene',async({page})=>{
 test.setTimeout(180000);
 await page.route('https://api.visitorbadge.io/**',r=>r.fulfill({body:'',contentType:'image/svg+xml'}));
 await page.goto('/?profile-gif-export=1#profile');
 await page.locator('[data-profile-terminal]').click({timeout:90000});
 await page.waitForFunction(()=>window.__terminal3D?.capture);
 const result=await page.evaluate(async()=>{
  const {createTerminalTimeline}=await import('/tools/profile-gif-export/terminal-timeline.mjs');
  const capture=window.__terminal3D.capture,step=createTerminalTimeline(capture);
  const first=step(0),seen=new Set(),outputs=[],commands=[];let last;
  for(let f=1;f<480;f++){
   last=step(f);
   if(last.mode==='news')seen.add(last.selected);
   if([90,160,250].includes(f))outputs.push(last);
   if(f===440)commands.push(...window.__terminal3D.capture.newsIds);
  }
  return {first,last,seen:[...seen],outputs,commands,count:capture.newsIds.length};
 });
 expect(CARD_SPECS.news.frames).toBe(480);
 expect(result.outputs[0].output.join(' ')).toContain('/home/');
 expect(result.outputs[1].output.join(' ')).toContain('research/');
 expect(result.outputs[2].cwd).toMatch(/\/research$/);
 expect(result.seen.sort()).toEqual(Array.from({length:result.count},(_,i)=>i));
 for(const key of ['input','mode','cwd','cursor','selected','lastKey','yaw'])expect(result.last[key]).toEqual(result.first[key]);
 expect(result.last.keys.every(k=>k.travel===0&&!k.held)).toBe(true);
 expect(result.last.screenMeshVertices).toBeGreaterThan(100);
 expect(result.first.buffer).toEqual([1920,1080]);
 expect(result.last.buffer).toEqual([1920,1080]);
 await page.setViewportSize({width:1000,height:800});
 await page.waitForTimeout(250);
 expect(await page.evaluate(()=>window.__terminal3D.capture.render(0).buffer)).toEqual([1920,1080]);
});

test('normal homepage does not enable GIF capture controls',async({page})=>{
 await page.goto('/#profile');await page.locator('[data-profile-terminal]').click();
 await page.waitForFunction(()=>window.__terminal3D?.getState().ready);
 expect(await page.evaluate(()=>window.__terminal3D.capture)).toBeUndefined();
});

test('the research card export reuses live content without starting WebGL scenes',async({page})=>{
 await page.addInitScript(()=>{
  window.__webglCalls=0;const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){if(/webgl/i.test(type))window.__webglCalls++;return original.call(this,type,...args)};
 });
 await page.goto('/tools/profile-gif-export/profile-harness.html');
 await expect(page.locator('.research-summary')).toHaveText('Building Agents That Make 3A Games');
 await expect(page.locator('.skill-stack')).toContainText('Multimodal LLMs');
 await expect(page.locator('canvas')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__webglCalls)).toBe(0);
 await expect.poll(()=>page.evaluate(()=>[...document.fonts].some(f=>f.family.replace(/["']/g,'')==='Satisfy'&&f.status==='loaded'))).toBe(true);
});
