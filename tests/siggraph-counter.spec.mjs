import {test,expect} from 'playwright/test';
for(const width of [1440,1024,390])test(`SIGGRAPH reel visually lands on 3 at ${width}px and after resizing`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/?profile-gif-export=1#profile');
 await page.locator('.siggraph-lever').click();
 await expect(page.locator('[data-siggraph-machine]')).toHaveAttribute('data-result','3');
 await page.waitForTimeout(250);
 const visibleDigit=()=>page.locator('.siggraph-reel').evaluate(reel=>{
  const r=reel.getBoundingClientRect(),cy=(r.top+r.bottom)/2;
  return [...reel.querySelectorAll('b')].find(b=>{const d=b.getBoundingClientRect();return d.top<=cy&&d.bottom>=cy;})?.textContent;
 });
 expect(await visibleDigit()).toBe('3');
 await page.setViewportSize({width:width===390?768:width-180,height:760});
 expect(await visibleDigit()).toBe('3');
 await page.locator('.siggraph-lever').click();
 await expect(page.locator('[data-siggraph-machine]')).toHaveAttribute('data-result','3');
 await page.waitForTimeout(250);expect(await visibleDigit()).toBe('3');
});
