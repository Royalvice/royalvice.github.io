import { pixelText } from "../terminal/pixelFont";
export type ProfileRoomTvState = { frame: number; cycleElapsed: number };
/** Silent, original attract graphics; gameplay runs only in the opened cabinet. */
export class ProfileRoomTv {
  readonly canvas = document.createElement("canvas");
  private state: ProfileRoomTvState = { frame: 0, cycleElapsed: 0 };
  constructor(private reducedMotion: boolean) {
    this.canvas.width=96;this.canvas.height=72;this.setTime(0);
  }
  setTime(seconds:number) {
    const time=this.reducedMotion?0:Math.max(0,seconds);
    this.state={frame:Math.floor(time*10),cycleElapsed:time%20};
    const ctx=this.canvas.getContext("2d")!;ctx.fillStyle="#071510";ctx.fillRect(0,0,96,72);
    ctx.strokeStyle="#7a7347";ctx.strokeRect(2.5,2.5,91,67);
    pixelText(ctx,"YZY ARCADE",18,10,"#d8c789");
    const names=["METAL SLUG","KOF 98","3RD STRIKE","RAIDEN II"];
    const name=names[Math.floor(time/5)%names.length];
    pixelText(ctx,name,(96-name.length*6)/2,36,"#99c6ac");
    ctx.fillStyle="#567659";ctx.fillRect(12,26,72,1);
    pixelText(ctx,"15 GAMES",24,54,"#c3b479");
    if(this.reducedMotion||Math.floor(time)%2===0){ctx.fillStyle="#ded49a";ctx.fillRect(44,64,8,2);}
  }
  reset(){this.setTime(0);}
  getState():ProfileRoomTvState{return {...this.state};}
}
