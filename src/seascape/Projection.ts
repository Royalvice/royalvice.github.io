/** The cabin eye has its own fixed frustum. All events and landmarks use this projection. */
export const CABIN_VIEW = { center:[.52,.63], span:[1.08,.72], aspect:2.4, canonicalAspect:1.6 } as const;
export function projectToCabin(x:number,y:number):[number,number]{return[.5+(x-CABIN_VIEW.center[0])/CABIN_VIEW.span[0],.5+(y-CABIN_VIEW.center[1])/CABIN_VIEW.span[1]];}
export function unprojectCabin(x:number,y:number):[number,number]{return[CABIN_VIEW.center[0]+(x-.5)*CABIN_VIEW.span[0],CABIN_VIEW.center[1]+(y-.5)*CABIN_VIEW.span[1]];}
export const cabinProjectionGLSL=`vec2 cabinProjection(vec2 uv){return vec2(${CABIN_VIEW.center[0]},${CABIN_VIEW.center[1]})+(uv-.5)*vec2(${CABIN_VIEW.span[0]},${CABIN_VIEW.span[1]});}`;
