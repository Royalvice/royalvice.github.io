import {test,expect} from "playwright/test";

test.beforeEach(async({page})=>{
  await page.route("https://api.visitorbadge.io/**",route=>route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg"/>'}));
  await page.goto("/#profile");
  await page.locator("[data-profile-terminal]").click();
  await expect(page.locator(".terminal-shell")).toHaveAttribute("data-renderer","web3d",{timeout:30000});
});
const state=page=>page.evaluate(()=>window.__terminal3D.getState());
async function clickKey(page,code,hold=false){
  const key=(await state(page)).keys.find(key=>key.code===code);
  const canvas=await page.locator(".terminal-canvas").boundingBox();
  await page.mouse.move(canvas.x+key.x,canvas.y+key.y);
  await page.mouse.down();
  if(!hold)await page.mouse.up();
  return key;
}

test("every one of the 82 3D keys receives an actual ray-picked pointer press",async({page})=>{
  test.setTimeout(90000);
  const codes=(await state(page)).keys.map(key=>key.code);
  expect(codes).toHaveLength(82);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  for(const code of codes){
    const key=await clickKey(page,code);
    await expect.poll(async()=>(await state(page)).lastKey).toBe(key.label||"SPACE");
    // Camera keys change the view immediately; its projection is refreshed at
    // prerender. Read the next key position from that completed frame.
    if(code==="F9"||code==="F10")await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if(code==="F11"){
      await expect(page.locator(".terminal-focus")).not.toBeVisible();
      await page.locator("[data-profile-terminal]").click();
      await expect(page.locator(".terminal-focus")).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
  await expect(page.locator(".terminal-shell img")).toHaveCount(0);
  expect((await state(page)).screenMeshVertices).toBeGreaterThan(100);
});

test("3D keys travel, release, edit text, switch case and execute screen commands",async({page})=>{
  await clickKey(page,"KeyA",true);
  await expect.poll(async()=>(await state(page)).keys.find(k=>k.code==="KeyA").travel).toBeGreaterThan(.05);
  await page.mouse.up();
  await expect.poll(async()=>(await state(page)).keys.find(k=>k.code==="KeyA").travel).toBeLessThan(.002);
  expect((await state(page)).input).toBe("a");
  await clickKey(page,"Backspace");expect((await state(page)).input).toBe("");
  await clickKey(page,"ShiftLeft");await clickKey(page,"KeyB");expect((await state(page)).input).toBe("B");
  expect((await state(page)).shift).toBe(false);
  await page.keyboard.press("Escape");
  await page.keyboard.type("pwd");expect((await state(page)).input).toBe("pwd");
  await page.keyboard.press("Enter");expect((await state(page)).mode).toBe("output");
  await page.keyboard.press("F2");
  expect((await state(page)).mode).toBe("news");
  await page.keyboard.press("End");expect((await state(page)).selected).toBe(6);
  await page.keyboard.press("Home");expect((await state(page)).selected).toBe(0);
  await page.keyboard.type("abcd");await page.keyboard.press("ArrowLeft");await page.keyboard.press("Backspace");
  expect((await state(page)).input).toBe("abd");
  await page.keyboard.down("KeyX");
  await page.locator("[data-terminal-toggle]").focus();
  await expect.poll(async()=>(await state(page)).keys.some(k=>k.held)).toBe(false);
  await page.keyboard.up("KeyX");
});

test("the 3D camera preserves proportions and key picking through resize and rotation",async({page})=>{
  for(const width of [1920,1280,1000,390]){
    await page.setViewportSize({width,height:1000});
    await page.locator(".terminal-canvas").scrollIntoViewIfNeeded();
    await expect.poll(async()=>{const s=await state(page);return Math.abs(s.aspect-s.css[0]/s.css[1]);}).toBeLessThan(.001);
    const s=await state(page);
    for(const key of s.keys){
      expect(key.scale).toEqual([1,1,1]);
      expect(key.x).toBeGreaterThan(0);expect(key.x).toBeLessThan(s.css[0]);
      expect(key.y).toBeGreaterThan(0);expect(key.y).toBeLessThan(s.css[1]);
    }
    await clickKey(page,"F12");await clickKey(page,"KeyA");
    expect((await state(page)).input).toBe("a");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  }
  await page.setViewportSize({width:1710,height:1100});
  await page.locator(".terminal-canvas").scrollIntoViewIfNeeded();
  const rect=await page.locator(".terminal-canvas").boundingBox(),before=(await state(page)).yaw;
  await page.mouse.move(rect.x+8,rect.y+rect.height*.4);await page.mouse.down();
  await page.mouse.move(rect.x+80,rect.y+rect.height*.4,{steps:8});await page.mouse.up();
  expect(Math.abs((await state(page)).yaw-before)).toBeGreaterThan(.08);
  await clickKey(page,"F12");await clickKey(page,"KeyZ");expect((await state(page)).input).toBe("z");
});

test("the desk computer preserves its live scene, input and focus across opening and closing",async({page})=>{
  await page.locator(".terminal-canvas").focus();await page.keyboard.type("find");
  await page.keyboard.press("F11");
  await expect(page.locator(".terminal-focus")).not.toBeVisible();
  await expect(page.locator("[data-profile-terminal]")).toBeFocused();
  await expect(page.locator(".profile-console > .terminal-shell")).toHaveCount(0);
  expect((await state(page)).input).toBe("find");
  expect((await state(page)).docked).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.style.overflow)).not.toBe("hidden");
  await page.setViewportSize({width:390,height:844});

  await page.locator("[data-profile-terminal]").click();
  await expect(page.locator(".terminal-canvas")).toBeFocused();
  expect((await state(page)).input).toBe("find");
  await page.keyboard.press("Enter");expect((await state(page)).mode).toBe("output");
  await page.keyboard.press("Escape");await expect(page.locator(".terminal-focus")).not.toBeVisible();
  await expect(page.locator("[data-profile-terminal]")).toBeFocused();
});

test("reduced motion still allows 3D key interaction and has no stuck presses",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});await page.reload();
  await page.locator("[data-profile-terminal]").click();
  await expect(page.locator(".terminal-shell")).toHaveAttribute("data-renderer","web3d",{timeout:30000});
  await clickKey(page,"KeyA");expect((await state(page)).input).toBe("a");
  await expect.poll(async()=>(await state(page)).keys.every(k=>k.travel===0 && !k.held)).toBe(true);
});

async function run(page,command){await page.locator(".terminal-canvas").focus();await page.keyboard.type(command);await page.keyboard.press("Enter");return state(page);}

test("five Linux commands navigate an actual virtual tree with completions, errors and room effects",async({page})=>{
  expect((await run(page,"pwd")).output[0]).toBe("/home/yzy");
  let s=await run(page,"ls");expect(s.output).toContain("research/");expect(s.output).not.toContain(".pocket/");
  s=await run(page,"ls -a");expect(s.output).toContain(".pocket/");
  s=await run(page,"cd room/night");expect(s.cwd).toBe("/home/yzy/room/night");expect(s.atmosphere).toBe("night");
  await expect(page.locator("[data-future-slot]")).toHaveAttribute("data-terminal-light","night");
  s=await run(page,"cd ../day");expect(s.cwd).toBe("/home/yzy/room/day");expect(s.atmosphere).toBe("day");
  await run(page,"cd ~");
  s=await run(page,"df -h");expect(s.output.join(" ")).toContain("roomfs");expect(s.output.join(" ")).toContain("Virtual room archive");
  s=await run(page,"cd missing");expect(s.cwd).toBe("/home/yzy");expect(s.output.join(" ")).toContain("no such directory");
  s=await run(page,"ls welcome.txt");expect(s.output.join(" ")).toContain("Zongyuan Yang");
  await page.keyboard.type("pw");expect((await state(page)).hint).toBe("pwd");
  await page.keyboard.press("Tab");expect((await state(page)).input).toBe("pwd");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");expect((await state(page)).input).toBe("pwd");
  await page.keyboard.press("Escape");
  s=await run(page,"find . -name '*.paper'");expect(s.output).toHaveLength(7);
  s=await run(page,"find . -name '*.key'");expect(s.output.join(" ")).toContain("Anywhere Door opens");
  expect(await page.evaluate(()=>window.__profileAdventureDebug.getState().doorFrame)).toBe("open");
  await page.keyboard.press("Escape");
  expect(await page.evaluate(()=>window.__profileAdventureDebug.getState().doorFrame)).toBe("open");
});

test("the whole room keeps 4:3 and the computer remains anchored to its desk",async({page})=>{
  await page.locator("[data-terminal-expand]").click();
  for(const width of [1920,1440,1000,390]){
    await page.setViewportSize({width,height:1100});

    await expect.poll(async()=>page.evaluate(()=>{
      const dock=document.querySelector("[data-terminal-dock]").getBoundingClientRect();
      const room=document.querySelector(".profile-sprite-canvas").getBoundingClientRect();
      const view=window.__profileAdventureDebug.getState().viewport;
      return dock.left>=room.left && dock.right<=room.right && dock.top>=room.top && dock.bottom<=room.bottom;
    })).toBe(true);
    await expect(page.locator(".terminal-desk-label")).not.toBeVisible();
    await expect(page.locator(".terminal-readable")).not.toBeVisible();
    const ratio=await page.locator('.profile-adventure-stage').evaluate(el=>{const r=el.getBoundingClientRect();return r.width/r.height;});
    expect(ratio).toBeCloseTo(4/3,2);
    expect((await state(page)).docked).toBe(true);
  }
});
