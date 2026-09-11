/* Same-origin rendering worker. The cabinet owns every input and every coin. */
(async () => {
  // This same-origin canvas is offscreen because the cabinet samples it as a
  // texture. Schedule its frames on the visible host: Chromium otherwise
  // throttles an out-of-viewport iframe even while its game is on the CRT.
  window.requestAnimationFrame = parent.requestAnimationFrame.bind(parent);
  window.cancelAnimationFrame = parent.cancelAnimationFrame.bind(parent);
  const report = (type, detail = '') => parent.postMessage({ source: 'yzy-arcade', type, detail }, location.origin);
  const id = new URL(location.href).searchParams.get('game');
  const catalog = await (await fetch('catalog.json')).json();
  const game = catalog.find(entry => entry.id === id);
  if (!game) { report('error', '未找到这张游戏卡。'); return; }

  // A separate WebGL canvas is sampled by the cabinet's curved CRT texture.
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, options) {
    return getContext.call(this, type, /webgl/.test(type) ? { ...options, preserveDrawingBuffer: true } : options);
  };
  for (const type of ['keydown', 'keyup', 'contextmenu', 'drop']) document.addEventListener(type, event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);

  const rewardUnlocked=()=>{try{return JSON.parse(localStorage.getItem('yzy.arcade.wish-coin.v1')||'null')?.inserted===true;}catch{return false;}};
  const cheatValues=new Map();
  let started = false;
  let loadFailure = '';
  // Pinned releases are prepared by the build, never upgraded by a visitor.
  EmulatorJS.prototype.checkForUpdates = () => {};
  // 4.2.3 passes an ArrayBuffer for external BIOS files, while Emscripten's
  // FS.writeFile requires a typed view. Preserve the ZIP rather than silently
  // dropping it and entering RetroArch's menu instead of booting the board.
  const writeFile = EJS_GameManager.prototype.writeFile;
  EJS_GameManager.prototype.writeFile = function (path, data) {
    return writeFile.call(this, path, data instanceof ArrayBuffer ? new Uint8Array(data) : data);
  };
  // Native failures may still produce a running RetroArch menu. Do not count
  // that as a loaded cartridge or enable coin spending on that error screen.
  const initModule = EmulatorJS.prototype.initModule;
  EmulatorJS.prototype.initModule = function (...args) {
    const runtime = window.EJS_Runtime;
    window.EJS_Runtime = options => {
      const observe = output => message => {
        if (/\[libretro ERROR\]|Failed to load content/i.test(String(message))) loadFailure = 'ROM 或 BIOS 与内核不匹配，请检查游戏文件。';
        output?.(message);
      };
      return runtime({...options,print:observe(options.print),printErr:observe(options.printErr)}).then(module=>{
        // FBNeo's frontend suppresses its ROM diagnostics without verbose
        // native logging. Observe them internally; normal console stays quiet.
        const main=module.callMain;
        module.callMain=args=>main(args.includes('-v')?args:['-v',...args]);
        return module;
      });
    };
    try { return initModule.apply(this,args); } finally { window.EJS_Runtime=runtime; }
  };
  // An offscreen renderer must not request a screen wake lock; the visible
  // host controls pause/resume. Some Emscripten builds do not catch denial.
  if ('wakeLock' in navigator) Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true });
  const originalError = EmulatorJS.prototype.startGameError;
  EmulatorJS.prototype.startGameError = function (message) { report('error', String(message)); return originalError.call(this, message); };
  const emulator = new EmulatorJS('#game', {
    system: 'fbneo', gameUrl: `roms/${game.id}.zip`, gameName: game.id,
    dataPath: 'runtime/', startOnLoad: true, noAutoFocus: true,
    externalFiles: { ...(game.bios ? { [`/${game.bios}.zip`]: `bios/${game.bios}.zip` } : {}), [`/fbneo/cheats/${game.id}.ini`]: `cheats/${game.id}.ini` },
    threads: false, disableDatabases: true, disableLocalStorage: true, cheats: [],
    volume: .55, disableAutoLang: true,
    buttonOpts: Object.fromEntries(['playPause','restart','mute','settings','fullscreen','saveState','loadState','screenRecord','gamepad','cheat','volume','saveSavFiles','loadSavFiles','quickSave','quickLoad','screenshot','cacheManager','netplay'].map(key => [key, false])),
    defaultOptions: { 'shader': 'disabled', 'rewind-enabled': 'disabled', 'virtual-gamepad': 'disabled', 'ejs_threads': 'disabled', 'fbneo-neogeo-mode': 'DIPSWITCH', 'fbneo-diagnostic-input': 'None', 'fbneo-allow-patched-romsets': 'disabled' }
  });
  const stopBuiltInControls = () => { emulator.gamepad?.terminate(); emulator.gamepadSelection = ['', '', '', '']; };
  emulator.on('ready', stopBuiltInControls);
  emulator.on('start', () => {
    if (loadFailure) { emulator.pause(); report('error',loadFailure); return; }
    started = true;
    stopBuiltInControls();
    emulator.gameManager.functions.resetCheat();

    emulator.gameManager.functions.setKeyboardEnabled(0);
    report('started');
  });
  emulator.on('exit', () => report('error', '游戏没有正常启动，请检查 ROM 与 BIOS 是否匹配此内核。'));
  window.addEventListener('error', event => report('error', event.message));
  window.addEventListener('unhandledrejection', event => report('error', String(event.reason)));
  const allowed = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  // Six-key fighting panel: Y X L / B A R. Classic Neo Geo is B A Y X.
  const panel = [1, 9, 10, 0, 8, 11];
  const actions = game.buttons === 6 ? panel : [0, 8, 1, 9, 10, 11];
  window.arcadeRunner = {
    canvas: () => started ? emulator.canvas : null,
    input: (index, down) => { if (started && allowed.has(index)) { const slot=panel.indexOf(index); emulator.gameManager.functions.simulateInput(0, slot<0?index:actions[slot], down ? 1 : 0); } },
    pause: () => { if (started) emulator.pause(); },
    resume: () => { if (started) { emulator.play(); window.arcadeRunner.unlockAudio(); } },
    volume: value => emulator.setVolume(value),
    unlockAudio: () => {
      const contexts = new Set();
      emulator.Module?.AL?.currentCtx?.sources?.forEach(source => { if (source?.gain?.context) contexts.add(source.gain.context); });
      for (const context of contexts) context.resume().catch(() => {});
    },
    cheats: () => {
      if(!started)return [];
      return emulator.gameManager.getCoreOptions().split('\n').filter(line=>line.startsWith('fbneo-cheat-')).map(line=>{
        const [name,choices='']=line.split('; ');const [key,current]=name.split('|');
        const values=choices.split('|').filter(Boolean).map(v=>v.replace('(Default) ',''));
        return {key,label:key.replace(/^fbneo-cheat-\d+-[^-]+-/,'').replace(/_/g,' '),values,value:cheatValues.get(key)??current??values[0]};
      });
    },
    setCheat: (key,value) => {
      if(!started||!rewardUnlocked())return false;
      const option=window.arcadeRunner.cheats().find(option=>option.key===key);
      if(!option||!option.values.includes(value))return false;
      emulator.gameManager.setVariable(key,value);cheatValues.set(key,value);return true;
    },
    snapshot: () => ({ started, paused: emulator.paused, core: emulator.getCore(), frame: started ? emulator.gameManager.functions.getFrameNum() : 0, game: id, cheats: [...cheatValues].filter(([,v])=>!v.startsWith('0 -')), cheatOptions:started?window.arcadeRunner.cheats().length:0, error:loadFailure || null })
  };
})().catch(error => parent.postMessage({ source: 'yzy-arcade', type: 'error', detail: String(error?.message ?? error) }, location.origin));
