import { PROFILE_ACTORS,PROFILE_ACTOR_IDS,type ProfileActorId } from './profileAdventureAssets';
import { PROFILE_ROOM_PROPS } from './profileRoomLayout';
import type { ProfileRoomSimulation } from './ProfileRoomSimulation';
export class CabinControls {
 private bar:HTMLElement;private keys=new Set<string>();private disposers:Array<()=>void>=[];private run=false;private stick:{x:number;y:number}|null=null;private dialogObserver:MutationObserver;
 constructor(private root:HTMLElement,private sim:ProfileRoomSimulation,private changed:()=>void){
  root.classList.add('cabin-v5');this.bar=document.createElement('div');this.bar.className='cabin-controls';
  this.bar.innerHTML=`<div class="cabin-control-summary"><span data-cabin-control-label>FIVE FRIENDS · CLICK A CHARACTER TO JOIN</span><button type="button" data-cabin-release hidden>退出操控 · ESC</button></div><div class="cabin-player-panel" hidden><div class="cabin-character-switcher">${PROFILE_ACTOR_IDS.map(id=>`<button type="button" data-cabin-select="${id}" aria-label="Control ${PROFILE_ACTORS[id].label}">${PROFILE_ACTORS[id].label}</button>`).join('')}</div><div class="cabin-touch-controls"><div class="cabin-stick" role="group" aria-label="Movement joystick"><span></span></div><small>内圈走路 · 外圈跑步</small><button type="button" data-cabin-interact>互动<br><small>E</small></button></div><p class="cabin-key-hint">WASD / ↑↓←→ 移动 · SHIFT 跑步 · E 互动</p></div>`;
  root.append(this.bar);
  this.bar.querySelectorAll<HTMLButtonElement>('[data-cabin-select]').forEach(b=>this.on(b,'click',()=>this.select(b.dataset.cabinSelect as ProfileActorId)));
  this.on(this.bar.querySelector('[data-cabin-release]')!,'click',()=>this.select(null));this.on(this.bar.querySelector('[data-cabin-interact]')!,'click',()=>this.interact());
  this.on(document,'keydown',((e:KeyboardEvent)=>{
   if(e.key==='Escape'){if(!document.querySelector('dialog[open]'))this.select(null);this.clear();return;}
   if(!this.active()||this.editable(e.target))return;
   const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift','e'].includes(k)){e.preventDefault();if(k==='e'&&!e.repeat)this.interact();else{this.keys.add(k);this.input();}}
  }) as EventListener);
  this.on(document,'keyup',((e:KeyboardEvent)=>{this.keys.delete(e.key.toLowerCase());this.input();}) as EventListener);
  this.on(window,'cabin:view-change',()=>this.clear());this.on(window,'resize',()=>this.clear());this.on(window,'blur',()=>this.clear());this.on(document,'visibilitychange',()=>{if(document.hidden)this.clear();});
  this.on(document,'focusin',e=>{if(this.editable(e.target))this.clear();});
  this.on(window,'scroll',()=>{if(!this.visible())this.clear();});
  this.dialogObserver=new MutationObserver(()=>{if(document.querySelector('dialog[open]'))this.clear();});this.dialogObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  const stick=this.bar.querySelector<HTMLElement>('.cabin-stick')!;let pointer=-1;
  const move=(e:PointerEvent)=>{if(e.pointerId!==pointer)return;const r=stick.getBoundingClientRect(),radius=r.width*.38,dx=(e.clientX-r.left-r.width/2)/radius,dy=(e.clientY-r.top-r.height/2)/radius,l=Math.hypot(dx,dy);this.run=this.run?l>.70:l>.88;this.stick=l<.12?{x:0,y:0}:{x:dx/Math.max(1,l),y:dy/Math.max(1,l)};stick.style.setProperty('--stick-x',`${this.stick.x*radius}px`);stick.style.setProperty('--stick-y',`${this.stick.y*radius}px`);this.input();};
  this.on(stick,'pointerdown',((e:PointerEvent)=>{if(!this.active())return;e.preventDefault();pointer=e.pointerId;stick.setPointerCapture(pointer);move(e);}) as EventListener);this.on(stick,'pointermove',move as EventListener);
  const release=()=>{pointer=-1;this.clear();};this.on(stick,'pointerup',release);this.on(stick,'pointercancel',release);this.on(stick,'lostpointercapture',release);
 }
 select(id:ProfileActorId|null){this.sim.control(id);this.clear();this.sync();this.changed();}
 clear(){this.keys.clear();this.stick=null;this.run=false;this.sim.clearInput();const s=this.bar.querySelector<HTMLElement>('.cabin-stick');s?.style.setProperty('--stick-x','0px');s?.style.setProperty('--stick-y','0px');}
 private editable(t:EventTarget|null){return t instanceof HTMLElement&&Boolean(t.closest('input,textarea,select,[contenteditable="true"],.terminal-shell,.arcade-cabinet-dialog'));}
 private visible(){const r=this.root.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&document.documentElement.dataset.activeSection!=='horizon';}
 private active(){return Boolean(this.sim.getState().controlledActor)&&!document.hidden&&!document.querySelector('dialog[open]')&&this.visible();}
 private input(){if(!this.active()){this.sim.clearInput();return;}const x=this.stick?.x??(Number(this.keys.has('d')||this.keys.has('arrowright'))-Number(this.keys.has('a')||this.keys.has('arrowleft'))),y=this.stick?.y??(Number(this.keys.has('s')||this.keys.has('arrowdown'))-Number(this.keys.has('w')||this.keys.has('arrowup')));this.sim.setInput(x,y,this.run||this.keys.has('shift'));}
 interact(){const s=this.sim.getState(),id=s.controlledActor;if(!id)return;const a=s.actors[id];const targets=[['primaryDesk','[data-profile-terminal]'],['secondaryDesk','[data-music-box]'],['tv','[data-profile-tv]'],['door','[data-profile-door]'],['ultraCabinet','[data-profile-ultra]'],['ruruBed','[data-profile-ruru]']] as const;
  const candidates=targets.map(([prop,selector])=>({selector,d:Math.hypot(a.position[0]-(prop==='ruruBed'?s.ruru.position[0]:PROFILE_ROOM_PROPS[prop].worldAnchor[0]),(a.position[1]-(prop==='ruruBed'?s.ruru.position[1]:PROFILE_ROOM_PROPS[prop].worldAnchor[1]))*.75)}));candidates.push({selector:'[data-profile-window]',d:Math.hypot(a.position[0]-.5,(a.position[1]-.36)*.75)});const target=candidates.sort((a,b)=>a.d-b.d)[0];if(target.d<.15)this.root.querySelector<HTMLButtonElement>(target.selector)?.click();
 }
 sync(){const id=this.sim.getState().controlledActor;this.bar.querySelector('[data-cabin-control-label]')!.textContent=id?`${PROFILE_ACTORS[id].label.toUpperCase()} · YOU ARE HERE`:'FIVE FRIENDS · CLICK A CHARACTER TO JOIN';(this.bar.querySelector('[data-cabin-release]') as HTMLElement).hidden=!id;(this.bar.querySelector('.cabin-player-panel') as HTMLElement).hidden=!id;this.bar.querySelectorAll<HTMLElement>('[data-cabin-select]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cabinSelect===id)));}
 private on(t:EventTarget,e:string,fn:EventListener){t.addEventListener(e,fn);this.disposers.push(()=>t.removeEventListener(e,fn));}
 destroy(){this.clear();this.dialogObserver.disconnect();this.disposers.forEach(f=>f());this.bar.remove();}
}
