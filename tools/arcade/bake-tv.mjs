import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=new URL('../../public/assets/profile/arcade-tv/',import.meta.url);
const browser=await chromium.launch({headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]});
try{
  const page=await browser.newPage({viewport:{width:512,height:512}});
  await page.goto('http://127.0.0.1:4173/arcade/runner.html?game=invalid');
  const capture=await page.evaluate(async()=>{
    document.body.innerHTML='<div style="width:512px;height:512px"><canvas style="width:100%;height:100%"></canvas></div>';
    const {ArcadeCabinetScene}=await import('/src/arcade/ArcadeCabinetScene.ts');
    const scene=new ArcadeCabinetScene(document.querySelector('canvas'),true,()=>{});
    const image=await scene.captureRoomView();scene.destroy();return image;
  });
  await mkdir(out,{recursive:true});
  const data=Buffer.from(capture.image.split(',')[1],'base64');
  await writeFile(new URL('television.png',out),data);
  await writeFile(new URL('manifest.json',out),JSON.stringify({source:'src/arcade/ArcadeCabinetScene.ts',camera:{pitch:45,yaw:0},size:[512,512],pivot:capture.pivot,screenRect:capture.screenRect,sha256:createHash('sha256').update(data).digest('hex')},null,2)+'\n');
  console.log('Shared TV model baked',capture.screenRect,capture.pivot);
}finally{await browser.close();}
