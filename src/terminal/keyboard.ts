export interface TerminalKey { code: string; label: string; value?: string; shift?: string; width: number; row: number; x: number; accent?: boolean }
type Key = [code: string, label: string, width?: number, value?: string, shift?: string];
const letters = (text: string): Key[] => [...text].map((v) => ["Key" + v, v, 1, v.toLowerCase(), v]);
const rows: Key[][] = [
  [["Escape","ESC"], ...Array.from({length:12}, (_, i): Key => ["F"+(i+1),"F"+(i+1)]), ["Delete","DEL"]],
  [["Backquote","`",1,"`","~"], ...[..."1234567890"].map((v,i): Key => ["Digit"+v,v,1,v,"!@#$%^&*()"[i]]), ["Minus","-",1,"-","_"],["Equal","=",1,"=","+"],["Backspace","BACK",2],["Home","HOME"]],
  [["Tab","TAB",1.5], ...letters("QWERTYUIOP"),["BracketLeft","[",1,"[","{"],["BracketRight","]",1,"]","}"],["Backslash","\\",1.5,"\\","|"],["End","END"]],
  [["CapsLock","CAPS",1.75], ...letters("ASDFGHJKL"),["Semicolon",";",1,";",":"],["Quote","'",1,"'",'"'],["Enter","ENTER",2.25],["PageUp","PGUP"]],
  [["ShiftLeft","SHIFT",2.25], ...letters("ZXCVBNM"),["Comma",",",1,",","<"],["Period",".",1,".",">"],["Slash","/",1,"/","?"],["ShiftRight","SHIFT",1.75],["ArrowUp","UP"],["PageDown","PGDN"]],
  [["ControlLeft","CTRL",1.25],["MetaLeft","SYS",1.25],["AltLeft","ALT",1.25],["Space","",6.25," "," "],["AltRight","ALT"],["Fn","FN"],["ControlRight","CTRL"],["ArrowLeft","LEFT"],["ArrowDown","DOWN"],["ArrowRight","RIGHT"]]
];
export const TERMINAL_KEYS: TerminalKey[] = rows.flatMap((row, rowIndex) => {
  let x = 0;
  return row.map(([code,label,width=1,value,shift]) => {
    const key = {code,label,width,value,shift,row:rowIndex,x,accent:code==="Enter" || code==="Escape"};
    x += width;
    return key;
  });
});
