import { PROFILE_ACTOR_IDS, type ProfileActorId } from "./profileAdventureAssets";
import {
  PROFILE_ROOM_COLLISION_BOUNDS,
  PROFILE_ROOM_LAYOUT_VERSION,
  PROFILE_ROOM_NAV_GRID,
  PROFILE_ROOM_PROPS,
  PROFILE_ROOM_STATION_FACING,
  PROFILE_ROOM_STATION_POSITIONS,
  PROFILE_ROOM_WALK_BOUNDS,
  type ProfileActorFacing,
  type ProfileRoomPoint,
  type ProfileRoomStationId
} from "./profileRoomLayout";

export type { ProfileActorFacing, ProfileRoomStationId } from "./profileRoomLayout";

export type ProfileActorState =
  | "choosing"
  | "walking"
  | "waiting"
  | "thinking"
  | "drinking"
  | "working"
  | "watching-tv"
  | "manual-action"
  | "portal-entering"
  | "portal-away"
  | "portal-returning";

type Vec2 = ProfileRoomPoint;

export interface ProfileActorRuntime {
  id: ProfileActorId;
  state: ProfileActorState;
  visible: boolean;
  position: Vec2;
  facing: ProfileActorFacing;
  route: string[];
  routeIndex: number;
  station: ProfileRoomStationId | null;
  stateElapsed: number;
  nextDecisionAt: number;
  frame: string;
  seedState: number;
  activityDuration: number;
  walkDistance: number;
  lastProgressPosition: Vec2;
  blockedElapsed: number;
  blockedBy: ProfileActorId | null;
  replanCount: number;
  recentStations: Array<{ station: ProfileRoomStationId; leftAt: number }>;
  awayDuration: number;
  manualAction: string | null;
  visitedStations: ProfileRoomStationId[];
  speed: number;
  previousPosition: Vec2;
  animationElapsed: number;
  locomotion: "idle" | "walk" | "run";
  actionIndex: number;
  lastReplanAt: number;
}

export interface ProfileRoomSimulationState {
  layoutVersion: typeof PROFILE_ROOM_LAYOUT_VERSION;
  simulationElapsed: number;
  actors: Record<ProfileActorId, ProfileActorRuntime>;
  stationOccupancy: Record<ProfileRoomStationId, ProfileActorId[]>;
  doorFrame: "closed" | "open";
  doorUser: ProfileActorId | null;
  doorStrength: number;
  controlledActor: ProfileActorId | null;
  event: {kind:string;startedAt:number;actor:ProfileActorId}|null;
  ruru: {position:Vec2;previousPosition:Vec2;state:string;facing:ProfileActorFacing;elapsed:number};
  navigation: {
    deadlockRecoveries: number;
    reservedCells: Array<{ cell: string; actor: ProfileActorId }>;
  };
}

import { CABIN_ACTIONS } from './cabinActions';
const STEP=1/60;
const ASPECT=.75;
export const PROFILE_ROOM_ACTOR_SPEED:Record<ProfileActorId,number>={nobita:.065,doraemon:.060,shizuka:.062,gian:.058,suneo:.067};
export { PROFILE_ROOM_STATION_POSITIONS };
const STARTS:Vec2[]=[[.50,.58],[.57,.74],[.36,.84],[.72,.71],[.87,.55]];
const RADIUS=.021;
const dist=(a:Vec2,b:Vec2)=>Math.hypot(a[0]-b[0],(a[1]-b[1])*ASPECT);
const copy=(p:Vec2):Vec2=>[...p];
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const stationIds=Object.keys(PROFILE_ROOM_STATION_POSITIONS) as ProfileRoomStationId[];
const emptyOccupancy=()=>Object.fromEntries(stationIds.map(s=>[s,[]])) as Record<ProfileRoomStationId,ProfileActorId[]>;
const cell=(p:Vec2)=>[Math.round(p[0]*48),Math.round(p[1]*36)] as Vec2;
const fromCell=(x:number,y:number):Vec2=>[x/48,y/36];
const key=(x:number,y:number)=>`${x}:${y}`;

/** Fixed world-space simulation. Rendering and input never change its metric. */
export class ProfileRoomSimulation {
 readonly fixedStep=STEP;
 private elapsed=0;
 private actors={} as Record<ProfileActorId,ProfileActorRuntime>;
 private occupancy=emptyOccupancy();
 private controlledActor:ProfileActorId|null=null;
 private input:Vec2=[0,0];
 private wantsRun=false;
 private doorUntil=0;
 private doorUser:ProfileActorId|null=null;
 private deadlockRecoveries=0;
 private event:ProfileRoomSimulationState['event']=null;
 private nextEventAt=12;
 private musicPlaying=false;
 private musicBedRequested=false;
 private ruru={position:[321/640,424/480] as Vec2,previousPosition:[321/640,424/480] as Vec2,state:'idle',facing:'down' as ProfileActorFacing,elapsed:0};
 private ruruRoute:Vec2[]=[];
 constructor(private reducedMotion:boolean,private seed=0x51f15e){this.reset();}
 reset(){
  this.elapsed=0;this.occupancy=emptyOccupancy();this.controlledActor=null;this.clearInput();this.doorUntil=0;this.doorUser=null;this.event=null;this.nextEventAt=12;this.deadlockRecoveries=0;
  this.ruru={position:[321/640,424/480],previousPosition:[321/640,424/480],state:'idle',facing:'down',elapsed:0};this.ruruRoute=[];
  this.actors={} as Record<ProfileActorId,ProfileActorRuntime>;
  PROFILE_ACTOR_IDS.forEach((id,i)=>{const p=copy(STARTS[i]);this.actors[id]={id,state:'choosing',visible:true,position:p,previousPosition:copy(p),facing:'down',route:[],routeIndex:0,station:null,stateElapsed:0,nextDecisionAt:i*1.7+1,frame:'base:idle',seedState:(this.seed+i*143)>>>0,activityDuration:4,walkDistance:0,lastProgressPosition:copy(p),blockedElapsed:0,blockedBy:null,replanCount:0,recentStations:[],awayDuration:0,manualAction:null,visitedStations:[],speed:0,lastReplanAt:0,animationElapsed:0,locomotion:'idle',actionIndex:i%5};});
 }
 setSeed(seed:number){this.seed=seed>>>0;this.reset();}
 setTime(t:number){this.reset();this.advanceTime(t);}
 advanceTime(t:number){for(let i=0,n=Math.floor(Math.max(0,t)/STEP);i<n;i++)this.step(STEP);}
 setMusicState(playing:boolean){if(playing&&!this.musicPlaying){this.musicBedRequested=true;this.ruruRoute=this.path(this.ruru.position,[321/640,424/480],null);this.ruru.state='walk';}this.musicPlaying=playing;}
 greetRuru(){this.ruru.state='wave';this.ruru.elapsed=0;this.ruruRoute=[];}
 control(id:ProfileActorId|null){
  if(this.controlledActor){const a=this.actors[this.controlledActor];a.state='choosing';a.speed=0;a.nextDecisionAt=this.elapsed+2;}
  this.controlledActor=id;this.clearInput();
  if(id){const a=this.actors[id];if(!a.visible){this.controlledActor=null;return;}this.release(a);a.route=[];a.manualAction=null;a.state='waiting';a.animationElapsed=0;}
 }
 clearInput(){this.input=[0,0];this.wantsRun=false;}
 setInput(x:number,y:number,run=false){const l=Math.max(1,Math.hypot(x,y));this.input=[x/l,y/l];this.wantsRun=run;}
 toggleDoor(){this.setDoorOpen(this.doorFrame!=='open');}
 setDoorOpen(open:boolean){this.doorUntil=open?this.elapsed+8:0;}
 get doorFrame():'open'|'closed'{return this.doorUser||this.elapsed<this.doorUntil?'open':'closed';}
 cancelManualActions(){this.control(null);}
 triggerActor(id:ProfileActorId,action='signature'){
  const a=this.actors[id];const index=CABIN_ACTIONS[id].findIndex(x=>x.id===action);
  if(index>=0)a.actionIndex=index;
  else a.actionIndex=(a.actionIndex+1)%5;
  if(this.controlledActor===id)this.control(null);
  this.sendActorTo(id,CABIN_ACTIONS[id][a.actionIndex].station);
 }
 sendActorTo(id:ProfileActorId,station:ProfileRoomStationId){
  const a=this.actors[id],goal=PROFILE_ROOM_STATION_POSITIONS[station];if(!goal||!a.visible||this.occupancy[station].some(x=>x!==id))return false;
  const route=this.path(a.position,goal,id);if(!route.length&&dist(a.position,goal)>.004)return false;
  this.release(a);a.station=station;this.occupancy[station].push(id);a.route=route.map(p=>`${p[0]},${p[1]}`);a.routeIndex=0;a.state='walking';a.stateElapsed=0;a.manualAction=null;a.blockedElapsed=0;return true;
 }
 private release(a:ProfileActorRuntime){if(a.station)this.occupancy[a.station]=this.occupancy[a.station].filter(id=>id!==a.id);a.station=null;}
 private random(a:ProfileActorRuntime){a.seedState=(Math.imul(a.seedState,1664525)+1013904223)>>>0;return a.seedState/4294967296;}
 private choose(a:ProfileActorRuntime){
  if(this.elapsed<a.nextDecisionAt)return;
  if(!this.doorUser&&!this.event&&this.elapsed>=this.nextEventAt&&this.random(a)<.04&&this.sendActorTo(a.id,'anywhere-door'))return;
  const choices=CABIN_ACTIONS[a.id];
  for(let i=0;i<5;i++){a.actionIndex=(a.actionIndex+1)%5;const action=choices[a.actionIndex];if(action.event&&this.elapsed<this.nextEventAt)continue;if(this.sendActorTo(a.id,action.station))return;}
  if(!this.doorUser&&this.random(a)<.15&&this.sendActorTo(a.id,'anywhere-door'))return;
  a.nextDecisionAt=this.elapsed+2+this.random(a)*3;
 }
 step(dt:number){
  dt=Math.min(STEP,Math.max(0,dt));if(!dt)return;this.elapsed+=dt;
  if(this.event&&this.elapsed-this.event.startedAt>10){this.event=null;this.nextEventAt=this.elapsed+60;}
  for(const a of Object.values(this.actors)){
   a.previousPosition=copy(a.position);a.stateElapsed+=dt;a.animationElapsed+=dt;
   if(a.id===this.controlledActor){this.playerStep(a,dt);continue;}
   if(this.reducedMotion){a.locomotion='idle';continue;}
   if(a.state==='walking'){this.walk(a,dt);}
   else if(a.state==='portal-entering'&&a.stateElapsed>1){a.state='portal-away';a.stateElapsed=0;a.visible=false;}
   else if(a.state==='portal-away'&&a.stateElapsed>3){a.state='portal-returning';a.visible=true;a.stateElapsed=0;}
   else if(a.state==='portal-returning'&&a.stateElapsed>1){this.doorUser=null;this.release(a);a.state='choosing';a.nextDecisionAt=this.elapsed+1;}
   else if(a.manualAction&&a.stateElapsed>=a.activityDuration){this.release(a);a.manualAction=null;a.state='choosing';a.nextDecisionAt=this.elapsed+1+this.random(a)*3;}
   else if(a.state==='choosing'||a.state==='waiting')this.choose(a);
   a.frame=a.locomotion!=='idle'?`movement:${a.facing}:${Math.floor(a.animationElapsed*10)}`:a.manualAction?`action:${a.manualAction}`:'base:idle';
  }
  this.stepRuru(dt);
 }
 private face(a:{facing:ProfileActorFacing},dx:number,dy:number){if(Math.abs(dx)>Math.abs(dy)*1.1)a.facing=dx>0?'right':'left';else if(Math.abs(dy)>Math.abs(dx)*1.1)a.facing=dy>0?'down':'up';}
 private playerStep(a:ProfileActorRuntime,dt:number){
  const [x,y]=this.input,l=Math.hypot(x,y),target=l>.08?PROFILE_ROOM_ACTOR_SPEED[a.id]*(this.wantsRun?1.7:1):0;
  a.speed+=(target-a.speed)*(1-Math.exp(-dt*18));if(!target){a.speed=0;a.locomotion='idle';a.state='waiting';a.frame='base:idle';return;}
  this.face(a,x,y);const p:Vec2=[a.position[0]+x*a.speed*dt,a.position[1]+y*a.speed*dt/ASPECT];
  let moved=this.move(a,p);
  if(!moved)moved=this.move(a,[p[0],a.position[1]])||this.move(a,[a.position[0],p[1]]);
  const mode=moved?(this.wantsRun?'run':'walk'):'idle';if(mode!==a.locomotion)a.animationElapsed=0;a.locomotion=mode;a.state=moved?'walking':'waiting';a.frame=`movement:${a.facing}:${a.locomotion}`;
 }
 private move(a:ProfileActorRuntime,p:Vec2){
  if(!this.segmentClear(a.position,p)||this.blocker(p,a.id))return false;
  const d=dist(a.position,p);if(d<1e-7)return false;a.walkDistance+=d;a.position=p;a.blockedBy=null;return true;
 }
 private blocker(_p:Vec2,_id:ProfileActorId|null):null{return null;}
 private walk(a:ProfileActorRuntime,dt:number){
  if(a.routeIndex>=a.route.length){this.arrive(a);return;}
  let budget=PROFILE_ROOM_ACTOR_SPEED[a.id]*dt;let moved=false;
  while(budget>1e-8&&a.routeIndex<a.route.length){
   const p=a.route[a.routeIndex].split(',').map(Number) as Vec2,d=dist(p,a.position),step=Math.min(d,budget);
   if(d<1e-8){a.routeIndex++;continue;}
   const next:Vec2=[a.position[0]+(p[0]-a.position[0])*step/d,a.position[1]+(p[1]-a.position[1])*step/d];
   const b=this.blocker(next,a.id);
   if(b||!this.segmentClear(a.position,next)){
    a.blockedElapsed+=dt;a.blockedBy=b==='ruru'?null:b;
    if(a.blockedElapsed>1.2&&this.elapsed-a.lastReplanAt>1.2){a.lastReplanAt=this.elapsed;a.replanCount++;const route=this.path(a.position,PROFILE_ROOM_STATION_POSITIONS[a.station!],a.id,true);if(route.length){a.route=route.map(p=>p.join(','));a.routeIndex=0;}}
    if(a.blockedElapsed>5){this.release(a);a.state='choosing';a.nextDecisionAt=this.elapsed+.5;a.blockedElapsed=0;this.deadlockRecoveries++;}
    break;
   }
   this.face(a,next[0]-a.position[0],(next[1]-a.position[1])*ASPECT);a.position=next;a.walkDistance+=step;budget-=step;moved=true;a.blockedElapsed=0;a.blockedBy=null;if(step>=d-1e-8)a.routeIndex++;
  }
  if(a.locomotion!==(moved?'walk':'idle'))a.animationElapsed=0;a.locomotion=moved?'walk':'idle';a.speed=moved?PROFILE_ROOM_ACTOR_SPEED[a.id]:0;
 }
 private arrive(a:ProfileActorRuntime){
  a.locomotion='idle';a.speed=0;a.stateElapsed=0;a.animationElapsed=0;
  if(!a.station){a.state='choosing';return;}
  if(!a.visitedStations.includes(a.station))a.visitedStations.push(a.station);
  if(a.station==='anywhere-door'){if(this.event||this.elapsed<this.nextEventAt){this.release(a);a.state='choosing';return;}this.doorUser=a.id;a.state='portal-entering';a.activityDuration=1;this.nextEventAt=this.elapsed+65;return;}
  const action=CABIN_ACTIONS[a.id][a.actionIndex];a.state='manual-action';a.manualAction=action.station===a.station?action.id:null;a.activityDuration=action.duration;a.facing=action.station===a.station?action.facing:PROFILE_ROOM_STATION_FACING[a.station];
  if(!a.manualAction){a.state='waiting';a.nextDecisionAt=this.elapsed+4;}
  if(action.event&&a.manualAction){if(this.event||this.elapsed<this.nextEventAt){this.release(a);a.manualAction=null;a.state='choosing';a.nextDecisionAt=this.elapsed+2;return;}this.event={kind:action.event,startedAt:this.elapsed,actor:a.id};this.nextEventAt=this.elapsed+70;
   if(action.event==='concert')for(const friend of Object.values(this.actors)){if(friend.id===a.id||friend.id===this.controlledActor||!friend.visible||dist(friend.position,a.position)>.3)continue;const destinations=stationIds.filter(id=>!this.occupancy[id].length&&dist(PROFILE_ROOM_STATION_POSITIONS[id],a.position)>.32);for(const station of destinations)if(this.sendActorTo(friend.id,station))break;}
  }
 }
 private stepRuru(dt:number){
  const r=this.ruru;r.previousPosition=copy(r.position);r.elapsed+=dt;if(this.reducedMotion)return;
  if(r.state==='wave'||r.state==='happy'){if(r.elapsed>3){r.state='idle';r.elapsed=0;}return;}
  if(r.state==='sleep')return;
  const petter=this.occupancy.ruru[0];if(petter&&this.actors[petter].manualAction==='pet-ruru'&&dist(r.position,[321/640,424/480])<.04){r.state='happy';r.elapsed=0;return;}
  if(r.state==='sleep')return;
  if(this.ruruRoute.length){const p=this.ruruRoute[0],d=dist(p,r.position),step=Math.min(d,.023*dt);if(d<.001){this.ruruRoute.shift();return;}const n:Vec2=[r.position[0]+(p[0]-r.position[0])*step/d,r.position[1]+(p[1]-r.position[1])*step/d];if(!this.blocker(n,null)){this.face(r,n[0]-r.position[0],(n[1]-r.position[1])*ASPECT);r.position=n;r.state='walk';}return;}
  if(this.musicBedRequested&&dist(r.position,[321/640,424/480])<.025){r.state='sleep';r.elapsed=0;this.musicBedRequested=false;return;}
  if(r.state==='walk'){r.state='idle';r.elapsed=0;}
  if(r.elapsed>14){const goal:Vec2=this.musicBedRequested?[321/640,424/480]:Math.floor(this.elapsed/14)%2?[.60,.82]:[321/640,424/480];this.ruruRoute=this.path(r.position,goal,null);r.elapsed=0;}
 }
 isWalkable(p:Vec2,radius=RADIUS){
  const [l,t,r,b]=PROFILE_ROOM_WALK_BOUNDS;if(p[0]<l||p[0]>r||p[1]<t||p[1]>b)return false;
  return !PROFILE_ROOM_COLLISION_BOUNDS.some(({bounds:[x1,y1,x2,y2]})=>p[0]>=x1-radius&&p[0]<=x2+radius&&p[1]>=y1-radius/ASPECT&&p[1]<=y2+radius/ASPECT);
 }
 private segmentClear(a:Vec2,b:Vec2){
  if(!this.isWalkable(a)||!this.isWalkable(b))return false;
  // Exact segment/slab intersection: sparse samples can miss furniture corners.
  for(const {bounds:[l,t,r,bt]} of PROFILE_ROOM_COLLISION_BOUNDS){
   let enter=0,leave=1;const mins=[l-RADIUS,t-RADIUS/ASPECT],maxs=[r+RADIUS,bt+RADIUS/ASPECT];
   for(let axis=0;axis<2;axis++){const delta=b[axis]-a[axis];if(Math.abs(delta)<1e-10){if(a[axis]<mins[axis]||a[axis]>maxs[axis]){enter=2;break;}}else{let x=(mins[axis]-a[axis])/delta,y=(maxs[axis]-a[axis])/delta;if(x>y)[x,y]=[y,x];enter=Math.max(enter,x);leave=Math.min(leave,y);}}
   if(enter<=leave)return false;
  }return true;
 }
 private crowdSegmentClear(_start:Vec2,_end:Vec2,_id:ProfileActorId|null){return true;}
 private path(start:Vec2,goal:Vec2,id:ProfileActorId|null,dynamic=false):Vec2[]{
  if(!this.isWalkable(goal))return [];
  if(this.segmentClear(start,goal)&&!dynamic)return [copy(goal)];
  const [rawSx,rawSy]=cell(start),[rawX,rawY]=cell(goal);
  const starts:Vec2[]=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const p=fromCell(rawSx+dx,rawSy+dy);if(this.isWalkable(p)&&this.segmentClear(start,p)&&(!dynamic||this.crowdSegmentClear(start,p,id)))starts.push([rawSx+dx,rawSy+dy]);}
  starts.sort((a,b)=>dist(fromCell(...a),start)-dist(fromCell(...b),start));if(!starts.length)return [];const [sx,sy]=starts[0];
  const ends:Vec2[]=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const p=fromCell(rawX+dx,rawY+dy);if(this.isWalkable(p)&&this.segmentClear(p,goal)&&(!dynamic||this.crowdSegmentClear(p,goal,id)))ends.push([rawX+dx,rawY+dy]);}
  ends.sort((a,b)=>dist(fromCell(...a),goal)-dist(fromCell(...b),goal));if(!ends.length)return [];
  const [gx,gy]=ends[0],sk=key(sx,sy),gk=key(gx,gy),front=[{x:sx,y:sy,f:0}],cost=new Map([[sk,0]]),parent=new Map<string,string>();let found=false;
  while(front.length){front.sort((a,b)=>a.f-b.f);const c=front.shift()!,ck=key(c.x,c.y);if(ck===gk){found=true;break;}
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const x=c.x+dx,y=c.y+dy,p=fromCell(x,y),nk=key(x,y);if(!this.isWalkable(p)||!this.segmentClear(fromCell(c.x,c.y),p)||(dynamic&&!this.crowdSegmentClear(fromCell(c.x,c.y),p,id)))continue;
    const penalty=0;
    const nc=cost.get(ck)!+Math.hypot(dx,dy)+penalty;if(nc>=(cost.get(nk)??Infinity))continue;cost.set(nk,nc);parent.set(nk,ck);front.push({x,y,f:nc+Math.hypot(x-gx,y-gy)});
   }
  }
  if(!found)return [];const result:Vec2[]=[copy(goal)];let k=gk;while(k!==sk){const [x,y]=k.split(':').map(Number);result.unshift(fromCell(x,y));k=parent.get(k)!;if(!k)return [];}
  result.unshift(fromCell(sx,sy));
  // Smooth only static-clear segments; dynamic replans retain their detour.
  if(dynamic)return result;
  const smooth:Vec2[]=[];let p=start;for(let i=0;i<result.length;){let j=result.length-1;while(j>i&&!this.segmentClear(p,result[j]))j--;smooth.push(result[j]);p=result[j];i=j+1;}return smooth;
 }
 getState():ProfileRoomSimulationState{return {layoutVersion:PROFILE_ROOM_LAYOUT_VERSION,simulationElapsed:this.elapsed,actors:this.actors,stationOccupancy:this.occupancy,doorFrame:this.doorFrame,doorUser:this.doorUser,doorStrength:this.doorFrame==='open'?1:0,controlledActor:this.controlledActor,event:this.event,ruru:this.ruru,navigation:{deadlockRecoveries:this.deadlockRecoveries,reservedCells:[]}};}
 getRenderState(alpha=1):ProfileRoomSimulationState{const s=this.getState();return {...s,actors:Object.fromEntries(Object.entries(s.actors).map(([id,a])=>[id,{...a,position:[a.previousPosition[0]+(a.position[0]-a.previousPosition[0])*alpha,a.previousPosition[1]+(a.position[1]-a.previousPosition[1])*alpha]}])) as typeof s.actors,ruru:{...s.ruru,position:[s.ruru.previousPosition[0]+(s.ruru.position[0]-s.ruru.previousPosition[0])*alpha,s.ruru.previousPosition[1]+(s.ruru.position[1]-s.ruru.previousPosition[1])*alpha]}};}
}
