// Export-only choreography. Every key executes the production terminal program.
export function createTerminalTimeline(capture) {
  if(!capture)throw new Error('Terminal capture controls unavailable');
  capture.begin();
  const events=new Map();
  const type=(start,text)=>{
    [...text].forEach((letter,i)=>events.set(start+i*4,letter===' '?'Space':'Key'+letter.toUpperCase()));
    events.set(start+text.length*4+4,'Enter');
  };
  type(48,'pwd');type(120,'ls');type(192,'cd research');
  for(let index=1;index<capture.newsIds.length;index++)events.set(264+index*24,'ArrowDown');
  return frame=>{
    if(frame===0 || frame>=456)capture.reset();
    const key=events.get(frame);if(key)capture.press(key);
    return capture.render(frame>=456?0:frame/24);
  };
}
