import { arcadeReward } from './ArcadeReward';
import { ArcadeSession } from './ArcadeSession';
import { ArcadeCabinetScene } from './ArcadeCabinetScene';
import './arcade-cabinet.css';

type Game = { id:string; title:string; name:string; year:number; system:string; genre:string; bios?:string; buttons:number; vertical?:boolean };
type Availability = { games:Record<string,{available:boolean;missing:string[]}> };
type Runner = { canvas:()=>HTMLCanvasElement|null; input:(index:number,down:boolean)=>void; pause:()=>void; resume:()=>void; volume:(value:number)=>void; unlockAudio:()=>void; snapshot:()=>unknown; cheats:()=>Array<{key:string;label:string;values:string[];value:string}>; setCheat:(key:string,value:string)=>boolean };
type Options = { reducedMotion:boolean; onOpen?:()=>void; onClose?:()=>void };
const keyMap:Record<string,number>={ArrowUp:4,KeyW:4,ArrowDown:5,KeyS:5,ArrowLeft:6,KeyA:6,ArrowRight:7,KeyD:7,KeyJ:1,KeyK:9,KeyL:10,KeyU:0,KeyI:8,KeyO:11,Enter:3,Digit1:3,Digit5:2,KeyC:2};

export class ArcadeCabinet {
  private dialog:HTMLDialogElement;
  private canvas:HTMLCanvasElement;
  private scene:ArcadeCabinetScene|null=null;
  private frame:HTMLIFrameElement|null=null;
  private trigger:HTMLElement|null=null;
  private games:Game[]=[];
  private available:Availability={games:{}};
  private selected:Game|null=null;
  private activeGame:string|null=null;
  private sessions=new Map<string,ArcadeSession>();
  private session:ArcadeSession|null=null;
  private status='请选择一张游戏卡。';
  private phase:'select'|'loading'|'playing'|'error'='select';
  private running=false;
  private muted=false;
  private animation=0;
  private timeout=0;
  private abort=new AbortController();
  private boot:Promise<void>;
  private musicVolume:number|null=null;
  private previousOverflow='';
  private gamepadHeld=new Set<number>();
  private nowOpen=false;
  private destroyed=false;
  private inserting=false;
  private insertTimer=0;
  private releaseStick:()=>void=()=>{};
  constructor(private options:Options) {
    this.dialog=document.createElement('dialog');this.dialog.id='arcade-cabinet-dialog';this.dialog.className='arcade-cabinet-dialog';this.dialog.dataset.arcadeDialog='';
    this.dialog.setAttribute('aria-labelledby','arcade-cabinet-title');
    this.dialog.innerHTML=`<div class="arcade-shell">
      <header class="arcade-header"><div><span class="arcade-eyebrow">DUNGEON / AFTER HOURS</span><h2 id="arcade-cabinet-title">晚间街机室</h2></div><div class="arcade-wallet"><span>POCKET TOKENS</span><strong data-arcade-wallet>0</strong></div><button class="arcade-close" type="button" data-arcade-close aria-label="关闭街机，返回房间">×</button></header>
      <div class="arcade-layout"><section class="arcade-machine" aria-label="实体街机"><div class="arcade-scene-wrap"><canvas data-arcade-scene tabindex="0" aria-label="3D 街机。Left wooden sign: DISCLAIMER. Non-commercial arcade. Games and music belong to their respective rights holders. No affiliation or endorsement. Contact: Royalvice. 拖动摇杆或点击实体按键；也可使用下方控件。"></canvas><p data-arcade-graphics-error hidden>当前设备无法绘制 3D 街机。</p></div>
        <button class="arcade-keepsake" type="button" data-arcade-insert><span class="keepsake-coin" aria-hidden="true">✦</span><span data-arcade-insert-label>投入金币</span><small>ONE WISH · ENDLESS PLAY</small></button><div class="arcade-controls"><div class="arcade-transport"><button type="button" data-arcade-input="2">加币 <kbd>5</kbd></button><button type="button" data-arcade-input="3">START <kbd>↵</kbd></button><button type="button" data-arcade-pause disabled>暂停</button><button type="button" data-arcade-mute aria-pressed="false">声音开</button></div>
        <div class="arcade-touch"><div class="arcade-stick" data-arcade-stick tabindex="0" role="group" aria-label="虚拟摇杆，拖动控制八方向；键盘也可使用方向键"><span class="arcade-stick-ring"></span><span class="arcade-stick-knob"></span></div><div class="arcade-action-pad">${[1,9,10,0,8,11].map((index,n)=>`<button type="button" data-arcade-input="${index}" aria-label="动作 ${n+1}">${n+1}</button>`).join('')}</div></div>
        <p class="arcade-keyguide">WASD / 方向键移动 · J K L / U I O 动作 · P 暂停</p></div>
      </section><aside class="arcade-library" aria-label="游戏目录"><div class="arcade-library-heading"><span>THE CARTRIDGE SHELF</span><b>15</b></div><div class="arcade-game-list" data-arcade-list></div><div class="arcade-selection"><span data-arcade-meta></span><h3 data-arcade-title>合金弹头</h3><p data-arcade-status role="status" aria-live="polite"></p><button type="button" class="arcade-load" data-arcade-load>装入游戏</button><small data-arcade-reward-hint>口袋空空的，去夜空下许个愿吧。</small><details class="arcade-cheats" data-arcade-cheats hidden><summary>金手指 · 自选开启</summary><div data-arcade-cheat-list></div></details></div></aside></div>
    </div>`;
    document.body.append(this.dialog);this.canvas=this.dialog.querySelector('canvas')!;
    const signal=this.abort.signal;
    arcadeReward.addEventListener('change',()=>{for(const session of this.sessions.values())session.unlocked=arcadeReward.state.inserted;this.render();},{signal});
    this.dialog.querySelector('[data-arcade-insert]')!.addEventListener('click',()=>this.insertKeepsake(),{signal});
    this.dialog.querySelector('[data-arcade-close]')!.addEventListener('click',()=>this.close(),{signal});
    this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();},{signal});
    this.dialog.addEventListener('click',event=>{if(event.target===this.dialog){const r=this.dialog.getBoundingClientRect();const e=event as MouseEvent;if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.close();}},{signal});
    this.dialog.querySelector('[data-arcade-load]')!.addEventListener('click',()=>void this.load(),{signal});
    this.dialog.querySelector('[data-arcade-pause]')!.addEventListener('click',()=>this.pauseToggle(),{signal});
    this.dialog.querySelector('[data-arcade-mute]')!.addEventListener('click',()=>{this.muted=!this.muted;this.runner()?.volume(this.muted?0:.55);this.render();},{signal});
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-arcade-input]').forEach(button=>{
      const index=Number(button.dataset.arcadeInput);
      button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);this.input(index,true,`touch:${event.pointerId}`);},{signal});
      for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>this.input(index,false,`touch:${(event as PointerEvent).pointerId}`),{signal});
      button.addEventListener('click',event=>{if(event.detail===0){this.input(index,true,'accessible');setTimeout(()=>this.input(index,false,'accessible'),120);}},{signal});
    });
    const stick=this.dialog.querySelector<HTMLElement>('[data-arcade-stick]')!;
    let stickPointer:number|null=null;
    const moveStick=(event:PointerEvent)=>{
      if(stickPointer!==event.pointerId)return;
      const r=stick.getBoundingClientRect(),radius=r.width*.30;
      let x=event.clientX-r.left-r.width/2,y=event.clientY-r.top-r.height/2;
      const length=Math.hypot(x,y);if(length>radius){x*=radius/length;y*=radius/length;}
      stick.style.setProperty('--stick-x',`${x}px`);stick.style.setProperty('--stick-y',`${y}px`);
      const active=length>radius*.2,angle=Math.atan2(y,x),sector=Math.round(angle/(Math.PI/4));
      const dx=active?Math.round(Math.cos(sector*Math.PI/4)):0,dy=active?Math.round(Math.sin(sector*Math.PI/4)):0;
      const directions:[[number,boolean],[number,boolean],[number,boolean],[number,boolean]]=[[4,dy<0],[5,dy>0],[6,dx<0],[7,dx>0]];
      stick.dataset.direction=directions.filter(([,held])=>held).map(([i])=>i).join(',');
      for(const [index,held] of directions)this.input(index,held,'virtual-stick');
    };
    this.releaseStick=()=>{
      stickPointer=null;stick.dataset.direction='';
      stick.style.setProperty('--stick-x','0px');stick.style.setProperty('--stick-y','0px');stick.classList.remove('is-dragging');
      for(const index of [4,5,6,7])this.input(index,false,'virtual-stick');
    };
    stick.addEventListener('pointerdown',event=>{
      if(stickPointer!==null)return;event.preventDefault();stickPointer=event.pointerId;
      stick.setPointerCapture(event.pointerId);stick.classList.add('is-dragging');moveStick(event);
    },{signal});
    stick.addEventListener('pointermove',moveStick,{signal});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,event=>{if((event as PointerEvent).pointerId===stickPointer)this.releaseStick();},{signal});
    window.addEventListener('keydown',this.keyDown,{signal,capture:true});window.addEventListener('keyup',this.keyUp,{signal,capture:true});
    window.addEventListener('blur',this.suspend,{signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)this.suspend();},{signal});
    window.addEventListener('message',this.message,{signal});
    this.boot=this.catalog().catch(()=>{this.status='暂时无法读取游戏目录，请关闭后重试。';this.render();});
    (window as any).__arcadeCabinetDebug={getState:()=>this.snapshot()};
  }
  private async catalog() {
    const [catalog,availability]=await Promise.all([fetch('/arcade/catalog.json'),fetch('/arcade/availability.json',{cache:'no-store'})]);
    if(!catalog.ok||!availability.ok)throw new Error('Arcade catalog unavailable');
    this.games=await catalog.json();this.available=await availability.json();
    const list=this.dialog.querySelector('[data-arcade-list]')!;
    for(const [n,game] of this.games.entries()) {
      const button=document.createElement('button');button.type='button';button.dataset.arcadeGame=game.id;button.className='arcade-game';
      const number=document.createElement('span');number.className='arcade-game-number';number.textContent=String(n+1).padStart(2,'0');
      const title=document.createElement('span');title.textContent=game.title;
      const year=document.createElement('small');year.textContent=String(game.year);
      button.append(number,title,year);button.addEventListener('click',()=>this.select(game),{signal:this.abort.signal});list.append(button);
    }
    this.select(this.games[0]);
  }
  async open(trigger:HTMLElement|null=null) {
    if(this.nowOpen||this.destroyed)return;
    this.nowOpen=true;this.trigger=trigger;trigger?.setAttribute('aria-expanded','true');
    this.previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    this.options.onOpen?.();this.dialog.showModal();
    await this.boot;if(!this.nowOpen||this.destroyed)return;
    try{if(!this.scene)this.scene=new ArcadeCabinetScene(this.canvas,this.options.reducedMotion,this.input,()=>this.insertKeepsake());this.scene.setActive(true);}catch(error){console.warn('Arcade graphics unavailable',error);this.dialog.querySelector<HTMLElement>('[data-arcade-graphics-error]')!.hidden=false;this.status='这台设备暂时无法启动 3D 街机。';}
    this.render();this.canvas.focus({preventScroll:true});this.animation=requestAnimationFrame(this.tick);
  }
  close() {
    if(!this.nowOpen)return;
    this.suspend();this.nowOpen=false;cancelAnimationFrame(this.animation);this.scene?.setActive(false);
    this.dialog.close();document.body.style.overflow=this.previousOverflow;this.trigger?.setAttribute('aria-expanded','false');
    this.options.onClose?.();this.trigger?.focus({preventScroll:true});
  }
  private runner():Runner|null{return (this.frame?.contentWindow as any)?.arcadeRunner??null;}
  private select(game:Game) {
    if(this.activeGame&&this.activeGame!==game.id)this.suspend();
    this.selected=game;
    if(this.activeGame===game.id&&this.session?.ready){this.phase='playing';this.status='游戏进度已保留。按「继续」回到屏幕。';}
    else {this.phase='select';this.status=this.available.games[game.id]?.available?'游戏卡已就位。装入后投币，再按 START。':'游戏文件尚未放入，暂时无法开始。';}
    this.render();
  }
  private async load() {
    const game=this.selected;if(!game||this.phase==='loading'||!this.scene)return;
    if(this.activeGame===game.id&&this.session?.ready){this.pauseToggle();return;}
    const availability=this.available.games[game.id];
    if(!availability?.available){this.status='游戏文件尚未放入，暂时无法开始。';this.render();return;}
    this.suspend();clearTimeout(this.timeout);this.frame?.remove();this.frame=null;
    this.activeGame=game.id;
    this.session=this.sessions.get(game.id)??new ArcadeSession((button,down)=>this.runner()?.input(button,down));
    this.session.unlocked=arcadeReward.state.inserted;this.sessions.set(game.id,this.session);this.session.ready=false;this.session.paused=true;
    this.phase='loading';this.status='正在启动游戏板，请稍候…';
    const frame=document.createElement('iframe');frame.className='arcade-runtime';frame.title='街机模拟器运行画布';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.allow='autoplay';
    // Render portrait boards in a portrait framebuffer. The CRT adds the
    // side margins once; a 4:3 source would already contain its own margins.
    frame.style.width=game.vertical?'360px':'640px';
    frame.src=`/arcade/runner.html?game=${encodeURIComponent(game.id)}`;this.frame=frame;this.canvas.parentElement!.append(frame);
    this.timeout=window.setTimeout(()=>this.fail('启动时间过长，请检查游戏文件与 BIOS 的版本后重试。'),90000);this.render();
  }
  private message=(event:MessageEvent)=>{
    if(event.origin!==location.origin||event.source!==this.frame?.contentWindow||event.data?.source!=='yzy-arcade')return;
    if(event.data.type==='started') {
      clearTimeout(this.timeout);if(!this.session)return;
      this.session.ready=true;this.phase='playing';
      if(this.nowOpen&&this.selected?.id===this.activeGame){this.session.paused=false;this.running=true;this.duckMusic(true);this.status=arcadeReward.state.inserted?'加币，再按 START。祝你玩得开心。':'先投入纪念金币，再加币开始。';}
      else {this.session.paused=true;this.runner()?.pause();}
      this.runner()?.volume(this.muted?0:.55);this.renderCheats();this.render();
    }else if(event.data.type==='error')this.fail(`游戏未能启动：${String(event.data.detail).slice(0,170)}`);
  };
  private fail(message:string){clearTimeout(this.timeout);this.suspend();this.phase='error';this.status=message;if(this.session)this.session.ready=false;this.render();}
  private pauseToggle() {
    if(!this.session?.ready||this.activeGame!==this.selected?.id)return;
    if(this.running)this.suspend();else {this.session.paused=false;this.running=true;this.runner()?.resume();this.duckMusic(true);this.status='投币 5 · 开始 Enter · 暂停 P';this.render();}
    this.canvas.focus({preventScroll:true});
  }
  private suspend=()=>{
    this.releaseStick();this.session?.release();this.scene?.release();if(this.session)this.session.paused=true;
    this.running=false;this.gamepadHeld.clear();this.runner()?.pause();this.duckMusic(false);this.render();
  };
  private duckMusic(active:boolean) {
    const audio=document.querySelector<HTMLAudioElement>('audio[data-home-music]');if(!audio)return;
    if(active&&this.musicVolume===null){this.musicVolume=audio.volume;audio.volume*=.12;}
    if(!active&&this.musicVolume!==null){audio.volume=this.musicVolume;this.musicVolume=null;}
  }
  private input=(index:number,down:boolean,source:string)=>{
    if(!this.nowOpen)return;
    if(index===2&&down&&!arcadeReward.state.inserted){this.status=arcadeReward.state.earned?'先把纪念金币投入机身的金色投币口。':'还没有金币，到处点点吧';this.render();return;}
    if(this.activeGame!==this.selected?.id)return;
    const action=[1,9,10,0,8,11].indexOf(index);if(down&&action>=this.selected.buttons)return;
    if(down)this.runner()?.unlockAudio();
    const accepted=this.session?.input(index,down,source);
    if(index===2&&accepted)this.status='已加币 · 无限畅玩。按 START 开始。';
    else if(index===2&&down&&!arcadeReward.state.inserted)this.status=arcadeReward.state.earned?'先把纪念金币投入机身的金色投币口。':'还没有金币，到处点点吧';
    this.scene?.setHeld(this.session?.pressed??[]);this.renderControls();
    if(index===2)this.render();
  };
  private keyDown=(event:KeyboardEvent)=>{
    if(!this.nowOpen)return;
    if(event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.close();return;}
    const target=event.target as HTMLElement;
    if(target.matches('input,textarea,select')||target.isContentEditable||event.metaKey||event.ctrlKey||event.altKey)return;
    // Keep Enter/Space accessible for the selected shelf card and toolbar.
    if(target.closest('button')&&(event.code==='Enter'||event.code==='Space'))return;
    if(event.code==='KeyP'){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)this.pauseToggle();return;}
    const index=keyMap[event.code];if(index===undefined)return;
    event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)this.input(index,true,`key:${event.code}`);
  };
  private keyUp=(event:KeyboardEvent)=>{if(!this.nowOpen||keyMap[event.code]===undefined)return;event.preventDefault();event.stopImmediatePropagation();this.input(keyMap[event.code],false,`key:${event.code}`);};
  private tick=()=>{
    if(!this.nowOpen)return;
    if(this.running&&!document.hidden){
      const gamepad=navigator.getGamepads?.()?.find(pad=>pad?.connected&&pad.mapping==='standard');
      const next=new Set<number>();
      if(gamepad){[1,9,10,0,8,11].forEach((index,n)=>{if(gamepad.buttons[n]?.pressed)next.add(index);});if(gamepad.buttons[8]?.pressed)next.add(2);if(gamepad.buttons[9]?.pressed)next.add(3);[4,5,6,7].forEach((index,n)=>{if(gamepad.buttons[12+n]?.pressed)next.add(index);});if(gamepad.axes[0]<-.35)next.add(6);if(gamepad.axes[0]>.35)next.add(7);if(gamepad.axes[1]<-.35)next.add(4);if(gamepad.axes[1]>.35)next.add(5);}
      for(const index of this.gamepadHeld)if(!next.has(index))this.input(index,false,'gamepad');
      for(const index of next)if(!this.gamepadHeld.has(index))this.input(index,true,'gamepad');
      this.gamepadHeld=next;
    }
    this.animation=requestAnimationFrame(this.tick);
  };
  private renderControls() {
    const pressed=this.session?.pressed??[];
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-arcade-input]').forEach(button=>{const index=Number(button.dataset.arcadeInput);button.classList.toggle('is-held',pressed.includes(index));button.disabled=(index!==2&&!this.running)||[1,9,10,0,8,11].indexOf(index)>=(this.selected?.buttons??6);});
  }
  private render() {
    if(!this.selected)return;
    const selected=this.selected,reward=arcadeReward.state,coins=reward.inserted?Infinity:reward.earned?1:0;
    this.dialog.querySelector('[data-arcade-wallet]')!.textContent=Number.isFinite(coins)?String(coins):'∞';
    this.dialog.querySelector('[data-arcade-title]')!.textContent=selected.title;
    this.dialog.querySelector('[data-arcade-insert-label]')!.textContent=this.inserting?'金币入场…':reward.inserted?'纪念金币 · 已投入':reward.earned?'投入你的金币':'投入金币';
    this.dialog.querySelector('[data-arcade-reward-hint]')!.textContent=reward.inserted?'无限加币已解锁 · 金手指可自选开启':reward.earned?'一枚夜空送来的金币，开启无限畅玩。':'口袋空空的，去夜空下许个愿吧。';
    this.dialog.querySelector<HTMLElement>('[data-arcade-cheats]')!.hidden=!reward.inserted||!this.session?.ready||selected.id!==this.activeGame;
    this.dialog.dataset.reward=reward.inserted?'inserted':reward.earned?'earned':'empty';
    this.dialog.querySelector('[data-arcade-meta]')!.textContent=`${selected.system} / ${selected.year} / ${selected.genre}`;
    this.dialog.querySelector('[data-arcade-status]')!.textContent=this.status;
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-arcade-game]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.arcadeGame===selected.id)));
    const load=this.dialog.querySelector<HTMLButtonElement>('[data-arcade-load]')!;
    const canPlay=!!this.available.games[selected.id]?.available;
    load.disabled=!canPlay||this.phase==='loading';
    load.textContent=!canPlay?'等待游戏卡':this.phase==='loading'?'正在启动…':this.activeGame===selected.id&&this.session?.ready?(this.running?'暂停游戏':'继续游戏'):'装入游戏';
    const pause=this.dialog.querySelector<HTMLButtonElement>('[data-arcade-pause]')!;pause.disabled=!this.session?.ready||this.activeGame!==selected.id;pause.textContent=this.running?'暂停':'继续';
    const mute=this.dialog.querySelector<HTMLButtonElement>('[data-arcade-mute]')!;mute.textContent=this.muted?'声音关':'声音开';mute.setAttribute('aria-pressed',String(this.muted));
    const playing=selected.id===this.activeGame&&!!this.session?.ready;
    this.scene?.setDisplay({...selected,coins,playing,paused:playing&&!this.running,message:!canPlay?'CARTRIDGE NOT INSTALLED':this.phase==='loading'?'BOOTING GAME BOARD':this.phase==='error'?'CHECK ROM AND BIOS':'INSERT COIN / PRESS START'},playing?this.runner()?.canvas()??null:null);
    this.scene?.setHeld(this.session?.pressed??[]);this.renderControls();
  }
  private insertKeepsake() {
    if(this.inserting){this.status='已经投过了';this.render();return;}
    const result=arcadeReward.insert();
    if(result==='empty')this.status='还没有金币，到处点点吧';
    else if(result==='already')this.status='已经投过了';
    else {
      this.inserting=true;this.dialog.classList.add('is-inserting');this.scene?.insertCoin();
      this.status='金币已投入。无限加币和金手指已解锁，祝你玩得开心。';
      this.insertTimer=window.setTimeout(()=>{this.inserting=false;this.dialog.classList.remove('is-inserting');
        if(this.running){this.input(2,true,'keepsake');this.input(2,false,'keepsake');}
        this.render();
      },this.options.reducedMotion?100:1200);
    }
    this.render();
  }
  private renderCheats() {
    const list=this.dialog.querySelector('[data-arcade-cheat-list]')!;list.replaceChildren();
    const cheats=this.runner()?.cheats()??[];
    if(!cheats.length){list.textContent='当前游戏内核未提供可用金手指。';return;}
    for(const cheat of cheats){
      const label=document.createElement('label');const title=document.createElement('span');title.textContent=cheat.label;
      const select=document.createElement('select');select.setAttribute('aria-label',cheat.label);
      for(const value of cheat.values){const option=document.createElement('option');option.value=value;option.textContent=value.replace(/^0 - Disabled$/,'关闭').replace(/^1 - Enabled$/,'开启');select.append(option);}
      select.value=cheat.value;
      select.addEventListener('change',()=>{if(!arcadeReward.state.inserted||!this.runner()?.setCheat(cheat.key,select.value))select.value=cheat.value;});
      label.append(title,select);list.append(label);
    }
  }
  private snapshot(){return {open:this.nowOpen,phase:this.phase,selected:this.selected?.id,activeGame:this.activeGame,coins:arcadeReward.state.inserted?"unlimited":arcadeReward.state.earned?1:0,playing:this.running,pressed:this.session?.pressed??[],catalog:this.games.length,available:Object.values(this.available.games).filter(game=>game.available).length,reward:arcadeReward.state,cheats:arcadeReward.state.inserted,renderer:this.scene?.snapshot()??null,emulator:this.runner()?.snapshot()??null,iframes:document.querySelectorAll('.arcade-runtime').length,status:this.status};}
  destroy(){this.close();this.destroyed=true;this.abort.abort();clearTimeout(this.timeout);clearTimeout(this.insertTimer);this.session?.release();this.runner()?.pause();this.frame?.remove();this.scene?.destroy();this.dialog.remove();delete(window as any).__arcadeCabinetDebug;}
}
