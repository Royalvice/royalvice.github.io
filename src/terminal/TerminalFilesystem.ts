import type { NewsItem } from "../content/site";

export const SHELL_COMMANDS = ["pwd", "cd", "df", "ls", "find"] as const;
export const GHOSTTY = {
  background:"#21252b", black:"#1d1f23", foreground:"#e6e6e6", muted:"#89929f",
  hint:"#626b79", line:"#393e47", green:"#98c379", blue:"#71b9f4",
  yellow:"#eac786", purple:"#c88bda", cyan:"#62bac6", red:"#e27881"
};
export type RoomSignal = "day" | "night" | "door";
export type ShellLine = { text:string; color?:string };
type Entry = { path:string; directory:boolean; text?:string };
export type ShellResult = { lines:ShellLine[]; news?:boolean; signal?:RoomSignal };
const HOME="/home/yzy";

/** A small, explicit room filesystem; commands never reach the host shell. */
export class TerminalFilesystem {
  cwd=HOME;
  private previous=HOME;
  readonly entries:Entry[];
  constructor(news:NewsItem[]) {
    const directories=["/","/home",HOME,`${HOME}/research`,`${HOME}/room`,`${HOME}/room/day`,`${HOME}/room/night`,`${HOME}/.pocket`];
    this.entries=directories.map(path=>({path,directory:true}));
    this.entries.push({path:`${HOME}/welcome.txt`,directory:false,text:"Zongyuan Yang / BUPT / graphics, agents and worlds"});
    for(const item of news){const name=item.text.split(/\s|—/)[0].toLowerCase().replace(/[^a-z0-9]/g,"") || item.id;
      this.entries.push({path:`${HOME}/research/${name}.paper`,directory:false,text:`${item.date} ${item.text}`});}
    this.entries.push({path:`${HOME}/room/inhabitants.txt`,directory:false,text:"Nobita, Doraemon, Shizuka, Gian, Suneo"},
      {path:`${HOME}/.pocket/anywhere-door.key`,directory:false,text:"A door is only a path you have not found yet."});
  }
  resolve(path:string):string {
    const absolute=path==="~"?HOME:path.startsWith("~/")?HOME+path.slice(1):path.startsWith("/")?path:`${this.cwd}/${path}`;
    const parts:string[]=[];for(const part of absolute.split("/")){if(part==="..")parts.pop();else if(part && part!==".")parts.push(part);}
    return "/"+parts.join("/");
  }
  get shortPath():string {return this.cwd===HOME?"~":this.cwd.startsWith(HOME+"/")?"~"+this.cwd.slice(HOME.length):this.cwd;}
  suggest(input:string,history:string[]):string {
    if(!input)return "ls";
    const recent=[...history].reverse().find(value=>value.startsWith(input) && value!==input);if(recent)return recent;
    if(!input.includes(" "))return SHELL_COMMANDS.find(c=>c.startsWith(input))??"";
    const examples=["ls -a","cd research","cd room/night","cd room/day","cd ~","df -h","find . -name '*.key'","find . -name '*.paper'"];
    const index=input.lastIndexOf(" "),prefix=input.slice(0,index+1),partial=input.slice(index+1);
    if(["cd","ls","find"].includes(input.split(" ")[0]) && !partial.startsWith("-")){
      const slash=partial.lastIndexOf("/"),base=slash>=0?partial.slice(0,slash+1):"";
      const parent=this.resolve(base || ".");
      const match=this.entries.find(e=>e.path!=="/" && e.path.slice(0,e.path.lastIndexOf("/"))===(parent==="/"?"":parent) && (input.startsWith("cd ")?e.directory:true) && (base+e.path.split("/").at(-1)).startsWith(partial));
      if(match)return prefix+base+match.path.split("/").at(-1)+(match.directory?"/":"");
    }
    return examples.find(c=>c.startsWith(input))??"";
  }
  run(input:string):ShellResult {
    const tokens:string[]=[];let token="",quote="",active=false;
    for(const char of input){if(quote){if(char===quote)quote="";else token+=char;}else if(char==='"'||char==="'"){quote=char;active=true;}else if(/\s/.test(char)){if(active){tokens.push(token);token="";active=false;}}else{token+=char;active=true;}}
    if(quote)return {lines:[{text:"Unclosed quote. Finish the quoted pattern.",color:GHOSTTY.red}]};
    if(active)tokens.push(token);
    const [command,...args]=tokens;
    const fail=(text:string):ShellResult=>({lines:[{text:`${command}: ${text}`,color:GHOSTTY.red}]});
    const line=(text:string,color=GHOSTTY.foreground):ShellLine=>({text,color});
    if(command==="pwd")return args.length?fail("usage: pwd"):{lines:[line(this.cwd,GHOSTTY.blue),line(""),line("Living dungeon / middle desk / YZY-01",GHOSTTY.muted)]};
    if(command==="cd"){
      if(args.length>1)return fail("usage: cd [directory]");
      const path=args[0]==="-"?this.previous:this.resolve(args[0] || "~"),entry=this.entries.find(e=>e.path===path);
      if(!entry)return fail(`${args[0]}: no such directory`);if(!entry.directory)return fail(`${args[0]}: not a directory`);
      this.previous=this.cwd;this.cwd=path;
      if(path.endsWith("/research"))return {news:true,lines:[]};
      const signal=path.endsWith("/room/night")?"night":path.endsWith("/room/day") || path===HOME?"day":undefined;
      return {signal,lines:[line(this.shortPath,GHOSTTY.blue),line(""),line(signal==="night"?"Night shift. The room lights turn blue.":signal==="day"?"The desk lamps return to warm amber.":"Directory changed. Use ls to look around.",GHOSTTY.muted),line(""),line(signal?"The same light stays on when you leave.":"",GHOSTTY.cyan)]};
    }
    if(command==="ls"){
      if(args.some(a=>a.startsWith("-") && !["-a","-l","-la","-al"].includes(a)))return fail("usage: ls [-a] [-l] [path]");
      const paths=args.filter(a=>!a.startsWith("-"));if(paths.length>1)return fail("one path at a time");
      const path=this.resolve(paths[0] || "."),entry=this.entries.find(e=>e.path===path);if(!entry)return fail(`${paths[0]}: no such file or directory`);
      const all=args.some(a=>a.includes("a")&&a.startsWith("-")),long=args.some(a=>a.includes("l")&&a.startsWith("-"));
      const items=entry.directory?this.entries.filter(e=>e.path!=="/" && e.path.slice(0,e.path.lastIndexOf("/"))===(path==="/"?"":path) && (all || !e.path.split("/").at(-1)!.startsWith("."))):[entry];
      return {lines:[line(path,GHOSTTY.muted),line(""),...items.map(e=>line((long?(e.directory?"dr-xr-xr-x  ":"-r--r--r--  "):"")+e.path.split("/").at(-1)+(e.directory?"/":""),e.directory?GHOSTTY.blue:e.path.endsWith(".key")?GHOSTTY.purple:GHOSTTY.foreground)),...(!items.length?[line("This room is quiet.",GHOSTTY.muted)]:[]),...(!entry.directory && entry.text?[line(""),line(entry.text,GHOSTTY.cyan)]:[])]};
    }
    if(command==="df"){
      if(args.length>1 || (args.length && args[0]!=="-h"))return fail("usage: df [-h]");
      const used=this.entries.filter(e=>!e.directory).reduce((total,e)=>total+new TextEncoder().encode(e.text??"").length,0),percent=Math.ceil(used/65536*100);
      const size=args.length?"64K":"65536",usedLabel=args.length?`${(used/1024).toFixed(1)}K`:String(used),free=args.length?`${((65536-used)/1024).toFixed(1)}K`:String(65536-used);
      return {lines:[line("Filesystem   Size   Used  Avail  Use%",GHOSTTY.muted),line(`roomfs       ${size.padEnd(6)} ${usedLabel.padEnd(5)} ${free.padEnd(6)} ${percent}%`,GHOSTTY.cyan),line(""),line("["+"#".repeat(Math.ceil(percent/4))+".".repeat(25-Math.ceil(percent/4))+"]",GHOSTTY.green),line(""),line("Virtual room archive / mounted at ~",GHOSTTY.blue),line(`${this.entries.filter(e=>!e.directory).length} files. Five friends. Room for more.`),line("The best ideas still fit on a small disk.",GHOSTTY.muted)]};
    }
    if(command==="find"){
      let base=".",pattern="*";const rest=[...args];if(rest[0] && !rest[0].startsWith("-"))base=rest.shift()!;
      if(rest.length){if(rest.length!==2 || rest[0]!=="-name")return fail("usage: find [path] [-name 'pattern']");pattern=rest[1];}
      const path=this.resolve(base);if(!this.entries.some(e=>e.path===path))return fail(`${base}: no such file or directory`);
      const glob=new RegExp("^"+[...pattern].map(c=>c==="*"?".*":c==="?"?".":c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("")+"$");
      const found=this.entries.filter(e=>(e.path===path || e.path.startsWith(path==="/"?"/":path+"/")) && glob.test(e.path.split("/").at(-1)!));
      const door=found.some(e=>e.path.endsWith("anywhere-door.key")) && pattern!=="*";
      return {signal:door?"door":undefined,lines:[...found.map(e=>line(e.path.replace(HOME,"~")+(e.directory && e.path!=="/"?"/":""),e.directory?GHOSTTY.blue:GHOSTTY.foreground)),...(!found.length?[line("No paths matched.",GHOSTTY.muted)]:[]),...(door?[line(""),line("Key found. The Anywhere Door opens.",GHOSTTY.purple),line("Close the terminal. Look to your right.",GHOSTTY.cyan)]:[])]};
    }
    return fail(`command not found. F1 lists the five commands.`);
  }
}
