import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const output='artifacts/arcade-disclaimer-release';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]});
try{for(const [name,width,height] of [['desktop',1440,1000],['phone',390,844]]){
 const page=await browser.newPage({viewport:{width,height},isMobile:name==='phone',hasTouch:name==='phone'});
 await page.goto('http://127.0.0.1:4173/?profile-gif-export=1#profile');
 await page.waitForFunction(()=>window.__profileAdventureDebug?.getState().ready,null,{timeout:90000});
 await page.locator('[data-profile-tv]').click();
 await page.waitForFunction(()=>window.__arcadeCabinetDebug?.getState().renderer?.notice);await page.waitForTimeout(1000);
 await page.screenshot({path:`${output}/${name}.png`});
 await writeFile(`${output}/${name}.json`,JSON.stringify(await page.evaluate(()=>window.__arcadeCabinetDebug.getState()),null,2));
 await page.close();
}}finally{await browser.close();}
