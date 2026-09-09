/** The cabin's shared orthographic art camera, looking straight at the back wall. */
export const ROOM_PROJECTION = Object.freeze({
  pitchDegrees: 45,
  yawDegrees: 0,
  depthScale: Math.SQRT1_2,
  heightScale: Math.SQRT1_2,
  tileWidth: 32,
  // A square on the ground is foreshortened by sin(camera pitch).
  tileDepth: 32 * Math.SQRT1_2,
  shadowX: .24,
  shadowY: .16,
});
