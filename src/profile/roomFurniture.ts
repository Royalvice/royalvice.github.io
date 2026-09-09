import manifest from '../../public/assets/profile/dungeon-v8/furniture/manifest.json';

export interface GroundedFurniture {
  size:number[];
  pivot:number[];
  feet:number[][];
  url:string;
}
const asset=(name:keyof typeof manifest,feet:number[][]):GroundedFurniture=>({
  size:manifest[name].size,pivot:manifest[name].pivot,feet,
  url:`/assets/profile/dungeon-v8/furniture/${name}.webp`,
});
/** Contacts are measured on the opaque feet / pot base, not the alpha bounding box. */
export const ROOM_FURNITURE:Record<string,GroundedFurniture>={
  primaryDesk:asset('desk',[[.045,1],[.67,1],[.967,1],[.12,.67]]),
  sofa:asset('sofa',[[.065,1],[.935,1]]),
  secondaryDesk:asset('sideboard',[[.06,1],[.94,1]]),
  coffeeTable:asset('tea-table',[[.085,1],[.92,1],[.17,.78],[.82,.78]]),
  waterCooler:asset('cooler',[[.22,1],[.78,1]]),
  flowers:asset('plant',[[.38,.89],[.62,.89]]),
};
