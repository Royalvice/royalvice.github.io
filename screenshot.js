import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox', '--disable-remote-fonts', '--disable-webgl', '--disable-3d-apis']
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
  
  try {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

    // Mock document.fonts.ready to prevent screenshot hangs
    await page.addInitScript(() => {
      Object.defineProperty(document, 'fonts', {
        value: { ready: Promise.resolve() },
        writable: true
      });
    });

    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    
    // Screenshot initial state (no text revealed)
    await page.screenshot({ path: 'screenshot_initial.png', timeout: 10000 });
    
    // Set mock hover flag to force typing to continue during test
    await page.evaluate(() => {
      window.isPlaywrightHoverMock = true;
    });
    
    // Hover over the profile bio container to trigger the sparks and typing
    await page.hover('.profile-bio-container');
    
    // Wait for 1 seconds to capture the typing in action
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshot_typing.png', timeout: 10000 });

    // Wait 5 seconds to ensure text is fully typed
    await page.waitForTimeout(5000); 
    await page.screenshot({ path: 'screenshot_typed.png', fullPage: true, timeout: 10000 });
    
    // Move mouse away to reset hover state
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);
    
    // Hover again to trigger the .all-revealed:hover burn animation
    await page.hover('.profile-bio-container');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshot_burn.png', fullPage: true, timeout: 10000 });
    
    // Log the current HTML state to see which characters got the revealed class
    const bioHtml = await page.innerHTML('.profile-bio');
    console.log("BIO HTML STATE:", bioHtml);
    
    console.log("Screenshots saved.");
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();
