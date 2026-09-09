import { unprojectCabin } from "./Projection";
import { CabinWindowScene } from './CabinWindowScene';
import { SeascapeState } from './SeascapeState';
import '../styles/cabin-window.css';

export class CabinWindowController {
  private scene:CabinWindowScene|null=null;
  private fallbackCanvas=document.createElement("canvas");
  private isExpanded=false;
  private sourceFrame:(c:HTMLCanvasElement)=>void;
  private sharedState:SeascapeState;
  private dialog=document.createElement('dialog');
  private surface=document.createElement('div');
  private observer:IntersectionObserver;
  private visible=false;private destroyed=false;
  private down:{x:number;y:number;at:number}|null=null;
  constructor(private trigger:HTMLButtonElement,state:SeascapeState,private reduced:boolean,onFrame:(c:HTMLCanvasElement)=>void,private modalChanged:(open:boolean)=>void){
    this.sharedState=state;this.sourceFrame=onFrame;
    try {this.scene=new CabinWindowScene(state,reduced,onFrame);}catch(error){console.warn('Cabin uses its rendered fallback',error);}
    this.fallbackCanvas.className='cabin-window-canvas';this.fallbackCanvas.width=960;this.fallbackCanvas.height=400;
    this.dialog.className='cabin-window-dialog';this.dialog.id='ship-window';this.dialog.setAttribute('aria-label','Moonlit voyage through the cabin window');
    this.dialog.innerHTML='<button class="cabin-window-close" type="button" aria-label="Close cabin window">×</button><p class="cabin-window-caption">EVA01 → OASIS <span>THE NIGHT WATCH</span></p>';
    this.surface.className='cabin-window-surface';this.dialog.prepend(this.surface);document.body.append(this.dialog);
    this.trigger.setAttribute('aria-controls',this.dialog.id);
    this.trigger.addEventListener('click',this.open);
    this.dialog.querySelector('button')!.addEventListener('click',this.close);
    this.dialog.addEventListener('close',this.restore);this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});this.dialog.addEventListener('click',this.backdrop);
    this.surface.addEventListener('pointermove',this.move);this.surface.addEventListener('pointerleave',this.leave);
    this.surface.addEventListener('pointerdown',this.pointerDown);this.surface.addEventListener('pointerup',this.pointerUp);this.surface.addEventListener('pointercancel',this.cancelPointer);
    this.observer=new IntersectionObserver(([entry])=>{this.visible=entry.isIntersecting;this.sync();},{threshold:.01});this.observer.observe(trigger);
    document.addEventListener('visibilitychange',this.sync);
    (window as any).__cabinWindowDebug={getState:()=>({...(this.scene?.snapshot()??{ready:true,time:state.elapsed,contextCount:0,fallback:true}),open:this.dialog.open}),setTime:(t:number)=>state.setTime(t),triggerMeteor:()=>state.triggerMeteor('shower'),triggerUfo:()=>{state.cyclePhaseOverride='beam-opening';},open:this.open,close:this.close};
  }
  async init(){
    try {await this.scene?.init();}catch(error){this.scene?.destroy();this.scene=null;console.warn('Cabin uses its rendered fallback',error);}
    if(!this.scene){const image=new Image();image.onload=()=>{this.fallbackCanvas.getContext('2d')!.drawImage(image,0,0,960,400);this.sourceFrame(this.fallbackCanvas);};image.src='/assets/horizon/cabin-fallback.webp';}
    this.trigger.dataset.ready='true';this.trigger.disabled=false;this.sync();
  }
  private sync=()=>this.scene?.setActive(!document.hidden&&(this.dialog.open||this.visible)&&!this.destroyed);
  private open=()=>{if(this.dialog.open||this.destroyed)return;this.isExpanded=true;this.surface.append(this.scene?.canvas??this.fallbackCanvas);this.scene?.setExpanded(true);this.trigger.setAttribute('aria-expanded','true');this.dialog.showModal();this.modalChanged(true);this.sync();};
  private close=()=>{if(!this.dialog.open)return;this.dialog.close();this.restore();};
  private restore=()=>{if(this.dialog.open||!this.isExpanded)return;this.isExpanded=false;this.scene?.setExpanded(false);(this.scene?.canvas??this.fallbackCanvas).remove();this.trigger.setAttribute('aria-expanded','false');this.down=null;this.modalChanged(false);this.trigger.focus({preventScroll:true});this.sync();};
  private backdrop=(e:MouseEvent)=>{if(e.target===this.dialog){const r=this.dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.close();}};
  private move=(e:PointerEvent)=>{const r=this.surface.getBoundingClientRect();this.scene?.setLook((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);};
  private leave=()=>this.scene?.setLook(0,0);
  private pointerDown=(e:PointerEvent)=>{if(e.isPrimary&&e.button===0)this.down={x:e.clientX,y:e.clientY,at:e.timeStamp};};
  private pointerUp=(e:PointerEvent)=>{const d=this.down;this.down=null;if(!d||this.reduced||e.timeStamp-d.at>650||Math.hypot(e.clientX-d.x,e.clientY-d.y)>9)return;const r=this.surface.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=1-(e.clientY-r.top)/r.height;if(y<.40)return;const [sceneX,sceneY]=unprojectCabin(x,y);this.sharedState.launchCinematicFirework(sceneX,sceneY);};
  private cancelPointer=()=>{this.down=null;this.leave();};
  destroy(){this.destroyed=true;if(this.dialog.open)this.close();this.observer.disconnect();document.removeEventListener('visibilitychange',this.sync);this.trigger.removeEventListener('click',this.open);this.scene?.destroy();this.dialog.remove();delete(window as any).__cabinWindowDebug;}
}
