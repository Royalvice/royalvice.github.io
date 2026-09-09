import type { NewsItem } from "../content/site";
import type { TerminalKey } from "./keyboard";
import { pixelText, wrapPixelText } from "./pixelFont";
import { TerminalFilesystem, SHELL_COMMANDS, GHOSTTY as C, type ShellLine, type RoomSignal } from "./TerminalFilesystem";

export interface TerminalActions { hold(): void; expand(): void; view(delta: number): void; room(signal:RoomSignal):void }
export class TerminalProgram {
  readonly canvas = document.createElement("canvas");
  input=""; cursor=0; selected=0; scroll=0; mode="news"; caps=false; shift=false;
  ctrl=false; alt=false; meta=false; fn=false; brightness=1; lastKey=""; status="FOLLOW";
  message=""; history: string[]=[]; historyIndex=0; selectAll=false;
  rows: {index:number;top:number;bottom:number}[]=[];
  output: ShellLine[]=[]; outputScroll=0;
  readonly filesystem:TerminalFilesystem;
  get hint():string {return this.filesystem.suggest(this.input,this.history);}
  constructor(readonly news: NewsItem[], private actions: TerminalActions) { this.canvas.width=640; this.canvas.height=400; this.filesystem=new TerminalFilesystem(news); }
  insert(value: string): void {
    if(this.selectAll){this.input="";this.cursor=0;this.selectAll=false;}
    this.input=(this.input.slice(0,this.cursor)+value+this.input.slice(this.cursor)).slice(0,96);
    this.cursor=Math.min(this.input.length,this.cursor+value.length); this.message="";
  }
  press(key: TerminalKey, physical=false): void {
    this.lastKey=key.label || "SPACE";
    const code=key.code;
    if(code.startsWith("Shift")){this.shift=physical?true:!this.shift;return;}
    if(code.startsWith("Control")){this.ctrl=physical?true:!this.ctrl;return;}
    if(code.startsWith("Alt")){this.alt=physical?true:!this.alt;return;}
    if(code.startsWith("Meta")){this.meta=physical?true:!this.meta;return;}
    if(code==="Fn"){this.fn=!this.fn;return;}
    if(code==="CapsLock"){this.caps=!this.caps;return;}
    if(this.ctrl && code==="KeyL"){this.mode="output";this.output=[];this.input="";this.cursor=0;}
    else if(this.ctrl && code==="KeyC"){this.input="";this.cursor=0;this.message="^C";}
    else if(this.ctrl && code==="KeyA"){this.selectAll=true;}
    else if(key.value!==undefined){
      const shifted=code.startsWith("Key")?this.shift!==this.caps:this.shift;
      this.insert(shifted?(key.shift??key.value):key.value);
      if(!physical){this.shift=false;this.ctrl=false;this.alt=false;this.meta=false;}
    } else if(code==="Backspace"){
      if(this.selectAll){this.input="";this.cursor=0;this.selectAll=false;}
      else if(this.cursor>0){this.input=this.input.slice(0,this.cursor-1)+this.input.slice(this.cursor);this.cursor--;}
    } else if(code==="Delete") this.input=this.input.slice(0,this.cursor)+this.input.slice(this.cursor+1);
    else if(code==="Enter") this.execute();
    else if(code==="Escape"){this.input="";this.cursor=0;this.mode="news";this.scroll=0;this.selected=0;this.message="";}
    else if(code==="Tab"){if(this.hint){this.input=this.hint;this.cursor=this.input.length;}}
    else if(code==="ArrowLeft") this.cursor=Math.max(0,this.cursor-1);
    else if(code==="ArrowRight"){if(this.cursor===this.input.length && this.hint){this.input=this.hint;this.cursor=this.input.length;}else this.cursor=Math.min(this.input.length,this.cursor+1);}
    else if(code==="Home"){if(this.input)this.cursor=0;else this.navigate(-this.news.length);}
    else if(code==="End"){if(this.input)this.cursor=this.input.length;else this.navigate(this.news.length);}
    else if(code==="PageUp") this.navigate(-3);
    else if(code==="PageDown") this.navigate(3);
    else if(code==="ArrowUp" || code==="ArrowDown"){
      const direction=code==="ArrowUp"?-1:1;
      if((this.input || this.mode==="output") && this.history.length){this.historyIndex=Math.max(0,Math.min(this.history.length,this.historyIndex+direction));this.input=this.history[this.historyIndex]??"";this.cursor=this.input.length;}
      else this.navigate(direction);
    } else if(code==="F1") this.run("help",true);
    else if(code==="F2") this.run("news",true);
    else if(code==="F3") this.run("pwd");
    else if(code==="F4") this.run("ls");
    else if(code==="F5"){this.mode="output";this.output=[];this.outputScroll=0;}
    else if(code==="F6") this.actions.hold();
    else if(code==="F7") this.brightness=Math.max(.6,this.brightness-.1);
    else if(code==="F8") this.brightness=Math.min(1.35,this.brightness+.1);
    else if(code==="F9") this.actions.view(-1);
    else if(code==="F10") this.actions.view(0);
    else if(code==="F11") this.actions.expand();
    else if(code==="F12"){this.run("news",true);this.input="";this.cursor=0;this.caps=this.shift=this.ctrl=this.alt=this.meta=this.fn=false;this.message="SYSTEM READY";}
  }
  release(code: string): void {
    if(code.startsWith("Shift"))this.shift=false;
    if(code.startsWith("Control"))this.ctrl=false;
    if(code.startsWith("Alt"))this.alt=false;
    if(code.startsWith("Meta"))this.meta=false;
  }
  navigate(delta: number): void {
    if(this.mode==="output"){this.outputScroll=Math.max(0,Math.min(Math.max(0,this.output.length-11),this.outputScroll+delta));return;}
    this.selected=Math.max(0,Math.min(this.news.length-1,this.selected+delta));
    if(this.selected<this.scroll)this.scroll=this.selected;
    if(this.selected>(this.rows.at(-1)?.index??this.scroll+3))this.scroll=this.selected;
  }
  private execute(): void {
    if(!this.input.trim()){if(this.mode!=="news")return;const item=this.news[this.selected];if(item?.url)window.open(item.url,"_blank","noopener,noreferrer");else this.message="USE UP / DOWN TO EXPLORE";return;}
    const command=this.input.trim();this.history.push(this.input);this.historyIndex=this.history.length;
    this.input="";this.cursor=0;this.run(command);
  }
  private run(command: string, hardware=false): void {
    this.mode="output";this.message="";this.outputScroll=0;
    if(hardware && command==="news"){this.mode="news";this.selected=0;this.scroll=0;return;}
    if(hardware && command==="help"){
      this.output=[{text:"A small shell. A room with possibilities.",color:C.foreground},
        {text:""},{text:"pwd          locate your desk",color:C.green},
        {text:"ls -a        look a little closer",color:C.blue},
        {text:"cd room/night   stay for the night",color:C.purple},
        {text:"df -h        room left for ideas",color:C.cyan},
        {text:"find . -name '*.key'   find a way out",color:C.yellow},
        {text:""},{text:"TAB / RIGHT  accept hint   UP  history",color:C.muted},
        {text:"F2  research log   ESC  return to room",color:C.muted}];return;
    }
    const result=this.filesystem.run(command);
    this.output=result.lines.flatMap(line=>line.text?wrapPixelText(line.text,47).map(text=>({...line,text})):[line]);
    if(result.news){this.mode="news";this.selected=0;this.scroll=0;}
    if(result.signal)this.actions.room(result.signal);
  }
  draw(time: number, reducedMotion: boolean, largeText=false): void {
    const ctx=this.canvas.getContext("2d")!;
    ctx.fillStyle=C.background;ctx.fillRect(0,0,640,400);
    ctx.fillStyle=C.black;ctx.fillRect(0,0,640,51);
    pixelText(ctx,"YZY",24,17,C.foreground,3);
    pixelText(ctx,"RESEARCH / ROOM SHELL",99,22,C.muted,1);
    pixelText(ctx,"01 / LOCAL",535,22,C.cyan,1);
    ctx.fillStyle=C.line;ctx.fillRect(24,49,592,1);
    this.rows=[];
    if(this.mode==="news"){
      let y=66;
      for(let i=this.scroll;i<this.news.length;i++){
        const item=this.news[i],lineHeight=largeText?25:18;
        const lines=wrapPixelText(item.text,largeText?26:39);const height=lines.length*lineHeight+12;
        if(y+height>305)break;
        this.rows.push({index:i,top:y-4,bottom:y+height-6});
        if(i===this.selected){ctx.fillStyle=C.line;ctx.fillRect(21,y-5,594,height-3);pixelText(ctx,">",25,y,C.green,1);}
        pixelText(ctx,item.date,36,y,C.muted,2);
        lines.forEach((line,n)=>{
          let x=132;const scale=largeText?3:2;
          for(const part of line.split(/(SIGGRAPH(?: Asia)?|ACM|TOG|ECCV|ICCV|SSAT|EVA01|DirectL|DocDiff|Thoth|EYE3)/g)) {
            const ink=/^(SSAT|EVA01|DirectL|DocDiff|Thoth|EYE3)$/.test(part)?C.yellow:/^(SIGGRAPH(?: Asia)?|ACM|TOG|ECCV|ICCV)$/.test(part)?C.cyan:n===0?C.foreground:C.muted;
            pixelText(ctx,part,x,y+n*lineHeight,ink,scale);x+=part.length*6*scale;
          }
        });
        y+=height;
      }
      pixelText(ctx,`${this.selected+1}/${this.news.length}   RESEARCH LOG     UP/DOWN SELECT / ENTER OPEN`,24,309,C.cyan,1);
    } else {
      this.output.slice(this.outputScroll,this.outputScroll+11).forEach((line,i)=>pixelText(ctx,line.text,28,66+i*21,line.color??C.foreground,2));
      if(this.output.length>11)pixelText(ctx,`${this.outputScroll+1}-${Math.min(this.output.length,this.outputScroll+11)}/${this.output.length}  WHEEL / PGDN`,24,309,C.muted,1);
    }
    ctx.fillStyle=C.black;ctx.fillRect(0,329,640,71);
    ctx.fillStyle=C.line;ctx.fillRect(24,329,592,1);
    pixelText(ctx,"yzy",24,339,C.green,1);pixelText(ctx,"@dungeon",42,339,C.muted,1);
    pixelText(ctx,this.filesystem.shortPath,100,339,C.blue,1);
    pixelText(ctx,"$",24,357,C.green,2);
    const start=Math.max(0,this.cursor-44),display=this.input.slice(start,start+46);
    if(this.selectAll){ctx.fillStyle=C.line;ctx.fillRect(47,355,Math.min(display.length,46)*12+2,20);}
    const command=this.input.split(/\s/)[0],valid=SHELL_COMMANDS.includes(command as typeof SHELL_COMMANDS[number]);
    let x=48;
    for(let i=0;i<display.length;i++){
      const index=start+i,char=display[i],ink=index<command.length?(valid?C.green:C.red):/[\-*'"]/.test(char)?C.yellow:C.blue;
      pixelText(ctx,char,x,357,ink,2);x+=12;
    }
    if(this.cursor===this.input.length && this.hint.startsWith(this.input))pixelText(ctx,this.hint.slice(this.input.length,46+start),x,357,C.hint,2);
    if(reducedMotion || Math.floor(time*1.8)%2===0){ctx.fillStyle=C.foreground;ctx.fillRect(48+(this.cursor-start)*12,373,10,2);}
    const mods=[this.caps?"CAPS":"",this.shift?"SHIFT":"",this.ctrl?"CTRL":"",this.alt?"ALT":"",this.meta?"SYS":"",this.fn?"FN":""].filter(Boolean).join(" ");
    pixelText(ctx,(mods || this.message || "F1 GUIDE / F2 LOG     TAB COMPLETE     ESC LEAVE").slice(0,65),24,386,C.muted,1);
    // A restrained phosphor texture inside the curved glass, not a page overlay.
    ctx.globalAlpha=.07;ctx.fillStyle="#000";for(let y=1;y<400;y+=3)ctx.fillRect(0,y,640,1);ctx.globalAlpha=1;
  }
}
