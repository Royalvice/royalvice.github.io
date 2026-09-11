import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../../public/arcade/catalog.json',import.meta.url),'utf8'));
const output=new URL('../../.local/arcade/review/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]});
const results=[];
try {
 for(const game of catalog){
  const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[],logs=[];
  await page.addInitScript(()=>window.EJS_DEBUG_XX=true);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(/ROM at index|Failed to write|Geometry:|\[libretro ERROR\]/i.test(message.text()))logs.push(message.text().slice(0,1000));});
  try{
   await page.goto(`http://127.0.0.1:4173/arcade/runner.html?game=${game.id}`);
   await page.waitForFunction(()=>window.arcadeRunner?.snapshot().frame>1800,null,{timeout:90000});
   await page.waitForTimeout(1000);
   await page.screenshot({path:new URL(`${game.id}-boot.png`,output).pathname});
   await page.evaluate(()=>window.arcadeRunner.input(2,true));await page.waitForTimeout(120);
   await page.evaluate(()=>window.arcadeRunner.input(2,false));await page.waitForTimeout(300);
   await page.evaluate(()=>window.arcadeRunner.input(3,true));await page.waitForTimeout(120);
   await page.evaluate(()=>window.arcadeRunner.input(3,false));await page.waitForTimeout(6000);
   await page.screenshot({path:new URL(`${game.id}-start.png`,output).pathname});
   const state=await page.evaluate(()=>window.arcadeRunner.snapshot());
   results.push({id:game.id,state,errors,logs});console.log(game.id,JSON.stringify(state),JSON.stringify(logs).slice(0,1000));
  }catch(error){results.push({id:game.id,error:String(error),errors,logs});console.log(game.id,String(error));}
  await page.close();await writeFile(new URL('results.json',output),JSON.stringify(results,null,2));
 }
}finally{await browser.close();}
const failed=results.filter(result=>result.error||result.errors.length||result.state?.error||!result.state?.started||result.logs.some(line=>/ROM at index|Failed to write|\[libretro ERROR\]/i.test(line)));
if(failed.length||results.length!==catalog.length){console.error('Boot verification failed:',failed.map(result=>result.id));process.exitCode=1;}
else console.log(`${results.length} cartridges booted without ROM errors. Review the captured screens before accepting visuals.`);
