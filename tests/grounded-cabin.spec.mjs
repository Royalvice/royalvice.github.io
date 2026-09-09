import {test,expect} from 'playwright/test';
test('furniture ground contacts land on opaque feet, and assets preserve their source aspect',async({page})=>{
 await page.route('https://api.visitorbadge.io/**',r=>r.fulfill({body:'',contentType:'image/svg+xml'}));
 await page.goto('/#profile',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__profileAdventureDebug?.getState().ready);
 const results=await page.evaluate(async()=>{
  const {ROOM_FURNITURE}=await import('/src/profile/roomFurniture.ts');const viewport=window.__profileAdventureDebug.getState().viewport;const results=[];
  for(const [id,a] of Object.entries(ROOM_FURNITURE)){
   const im=new Image();im.src=a.url;await im.decode();const canvas=document.createElement('canvas');canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(im,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   const alpha=a.feet.map(([u,v])=>{let max=0;for(let y=Math.max(0,Math.round(v*canvas.height)-3);y<Math.min(canvas.height,Math.round(v*canvas.height)+3);y++)for(let x=Math.max(0,Math.round(u*canvas.width)-3);x<Math.min(canvas.width,Math.round(u*canvas.width)+3);x++)max=Math.max(max,pixels[(y*canvas.width+x)*4+3]);return max;});
   results.push({id,alpha,artAspect:canvas.width/canvas.height,drawAspect:viewport.props[id].width/viewport.props[id].height,transparent:pixels.some((v,i)=>i%4===3&&v===0)});
  }return results;
 });
 expect(results).toHaveLength(6);for(const r of results){expect(r.transparent,r.id).toBe(true);expect(r.drawAspect,r.id).toBeCloseTo(r.artAspect,3);for(const a of r.alpha)expect(a,r.id+' foot').toBeGreaterThan(128);}
});
