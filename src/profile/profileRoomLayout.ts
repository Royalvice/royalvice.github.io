import { ROOM_FURNITURE } from "./roomFurniture";
export type ProfileRoomStationId =
  | "blackboard"
  | "water-cooler"
  | "primary-desk"
  | "secondary-desk"
  | "sofa-left"
  | "sofa-right"
  | "tv-console"
  | "poster-left"
  | "poster-right"
  | "anywhere-door"
  | "ultra-cabinet" | "flowers" | "ruru" | "performance" | "model-bench";

export type ProfileRoomDeskStation = "primary-desk" | "secondary-desk";

export type ProfileActorFacing = "up" | "down" | "left" | "right";
export type ProfileRoomMount = "wall" | "floor" | "ceiling" | "furniture-anchor";
export type ProfileRoomPoint = [number, number];
export type ProfileRoomBounds = [number, number, number, number];

export type ProfileRoomSpriteKey =
  | "chandelier"
  | "blackboard"
  | "eraser"
  | "secondaryDesk"
  | "chair"
  | "sofa"
  | "waterCooler"
  | "tvCabinet"
  | "ps5";

export interface ProfileRoomSpriteMeta {
  sourceRect: [number, number, number, number];
  pivot: ProfileRoomPoint;
  mount: ProfileRoomMount;
  contactPoints?: ProfileRoomPoint[];
  screenRect?: [number, number, number, number];
  childAnchors?: Record<string, ProfileRoomPoint>;
}

export interface ProfileRoomPropDefinition {
  id: string;
  sprite?: ProfileRoomSpriteKey;
  worldAnchor: ProfileRoomPoint;
  desktopSize: ProfileRoomPoint;
  mobileSize: ProfileRoomPoint;
  collisionBounds?: ProfileRoomBounds;
  interactionAnchors?: Array<{
    station: ProfileRoomStationId;
    position: ProfileRoomPoint;
    facing: ProfileActorFacing;
  }>;
}

export const PROFILE_ROOM_LAYOUT_VERSION = "cabin-v6" as const;
export const PROFILE_ROOM_WALK_BOUNDS: ProfileRoomBounds = [0.055, 0.35, 0.945, 0.928];
export const PROFILE_ROOM_NAV_GRID = { columns: 48, rows: 36 } as const;

export const PROFILE_ROOM_SPRITE_META: Record<ProfileRoomSpriteKey, ProfileRoomSpriteMeta> = {
  chandelier: {
    sourceRect: [0, 0, 128, 128], pivot: [0.5, 0.86], mount: "ceiling"
  },
  blackboard: {
    sourceRect: [128, 0, 128, 128], pivot: [0.5, 0.5], mount: "wall"
  },
  eraser: {
    sourceRect: [256, 0, 128, 128], pivot: [0.5, 0.5], mount: "furniture-anchor"
  },
  secondaryDesk: {
    sourceRect: [0, 128, 128, 128], pivot: [0.5, 0.945], mount: "floor",
    contactPoints: [[0.18, 0.945], [0.82, 0.945]]
  },
  chair: {
    sourceRect: [128, 128, 128, 128], pivot: [0.5, 0.945], mount: "floor",
    contactPoints: [[0.28, 0.945], [0.72, 0.945]]
  },
  sofa: {
    sourceRect: [256, 128, 128, 128], pivot: [0.5, 0.945], mount: "floor",
    contactPoints: [[0.13, 0.945], [0.87, 0.945]]
  },
  waterCooler: {
    sourceRect: [0, 256, 128, 128], pivot: [0.5, 0.95], mount: "floor",
    contactPoints: [[0.34, 0.95], [0.66, 0.95]]
  },
  tvCabinet: {
    sourceRect: [128, 256, 128, 128], pivot: [0.5, 0.95], mount: "floor",
    contactPoints: [[0.12, 0.95], [0.88, 0.95]],
    // Relative to the destination rectangle. The v4 packer preserves this exact aperture.
    screenRect: [0.304688, 0.335938, 0.375, 0.25],
    // The console sits on the cabinet's north-east surface, not on the floor
    // beside the cabinet.  These coordinates are relative to the TV sprite
    // destination rectangle and are shared by the Canvas renderer and review
    // tooling.
    childAnchors: { ps5: [0.73, 0.61] }
  },
  ps5: {
    sourceRect: [256, 256, 128, 128], pivot: [0.5, 0.95], mount: "furniture-anchor"
  }
};

// All positions and footprints use one 640 x 480 room. Both viewports share it.
export const PROFILE_ROOM_PROPS: Record<string, ProfileRoomPropDefinition> = {
  posterLeft: {id:"poster-left",worldAnchor:[0.103125,0.212500],desktopSize:[0.100000,0.179167],mobileSize:[0.100000,0.179167],interactionAnchors:[{station:"poster-left",position:[0.118750,0.370833],facing:"up"}]},
  posterRight: {id:"poster-right",worldAnchor:[0.859375,0.208333],desktopSize:[0.096875,0.175000],mobileSize:[0.096875,0.175000],interactionAnchors:[{station:"poster-right",position:[0.839063,0.370833],facing:"up"}]},
  blackboard: {id:"blackboard",sprite:"blackboard",worldAnchor:[0.256250,0.285417],desktopSize:[0.128125,0.070833],mobileSize:[0.128125,0.070833],interactionAnchors:[{station:"blackboard",position:[0.259375,0.375000],facing:"up"}]},
  chandelier: {id:"chandelier",sprite:"chandelier",worldAnchor:[0.5,0.46],desktopSize:[0.071875,0.110417],mobileSize:[0.071875,0.110417]},
  primaryDesk: {id:"primary-desk",sprite:"secondaryDesk",worldAnchor:[0.242188,0.585417],desktopSize:[ROOM_FURNITURE.primaryDesk.size[0]/640,ROOM_FURNITURE.primaryDesk.size[1]/480],mobileSize:[ROOM_FURNITURE.primaryDesk.size[0]/640,ROOM_FURNITURE.primaryDesk.size[1]/480],collisionBounds:[0.135937,0.522917,0.350000,0.585417],interactionAnchors:[{station:"primary-desk",position:[0.242188,0.627083],facing:"up"}]},
  secondaryDesk: {id:"secondary-desk",sprite:"secondaryDesk",worldAnchor:[0.082812,0.775000],desktopSize:[ROOM_FURNITURE.secondaryDesk.size[0]/640,ROOM_FURNITURE.secondaryDesk.size[1]/480],mobileSize:[ROOM_FURNITURE.secondaryDesk.size[0]/640,ROOM_FURNITURE.secondaryDesk.size[1]/480],collisionBounds:[0.035937,0.735417,0.131250,0.775000],interactionAnchors:[{station:"secondary-desk",position:[0.082812,0.818750],facing:"up"}]},
  sofa: {id:"sofa",sprite:"sofa",worldAnchor:[0.296875,0.793750],desktopSize:[ROOM_FURNITURE.sofa.size[0]/640,ROOM_FURNITURE.sofa.size[1]/480],mobileSize:[ROOM_FURNITURE.sofa.size[0]/640,ROOM_FURNITURE.sofa.size[1]/480],collisionBounds:[0.168750,0.725000,0.425000,0.793750],interactionAnchors:[{station:"sofa-left",position:[0.237500,0.837500],facing:"down"},{station:"sofa-right",position:[0.362500,0.837500],facing:"down"}]},
  tv: {id:"tv-console",sprite:"tvCabinet",worldAnchor:[0.725000,0.862500],desktopSize:[0.200000,0.266667],mobileSize:[0.200000,0.266667],collisionBounds:[0.637500,0.791667,0.814063,0.862500],interactionAnchors:[{station:"tv-console",position:[0.725000,0.910417],facing:"up"}]},
  door: {id:"anywhere-door",worldAnchor:[0.923438,0.468750],desktopSize:[0.076563,0.191667],mobileSize:[0.076563,0.191667],collisionBounds:[0.893750,0.447917,0.960938,0.483333],interactionAnchors:[{station:"anywhere-door",position:[0.923438,0.527083],facing:"up"}]},
  waterCooler: {id:"water-cooler",sprite:"waterCooler",worldAnchor:[0.903125,0.677083],desktopSize:[ROOM_FURNITURE.waterCooler.size[0]/640,ROOM_FURNITURE.waterCooler.size[1]/480],mobileSize:[ROOM_FURNITURE.waterCooler.size[0]/640,ROOM_FURNITURE.waterCooler.size[1]/480],collisionBounds:[0.885938,0.637500,0.920312,0.677083],interactionAnchors:[{station:"water-cooler",position:[0.903125,0.725000],facing:"up"}]},
  ultraCabinet: {id:"ultra-cabinet",worldAnchor:[0.726562,0.583333],desktopSize:[0.234375,0.245833],mobileSize:[0.234375,0.245833],collisionBounds:[0.623437,0.525000,0.829688,0.583333],interactionAnchors:[{station:"ultra-cabinet",position:[0.726562,0.631250],facing:"up"}]},
  flowers: {id:"flowers",worldAnchor:[0.428125,0.462500],desktopSize:[ROOM_FURNITURE.flowers.size[0]/640,ROOM_FURNITURE.flowers.size[1]/480],mobileSize:[ROOM_FURNITURE.flowers.size[0]/640,ROOM_FURNITURE.flowers.size[1]/480],collisionBounds:[0.412500,0.441667,0.443750,0.472917],interactionAnchors:[{station:"flowers",position:[0.468750,0.493750],facing:"left"}]},
  modelBench: {id:"model-bench",worldAnchor:[0.904687,0.860417],desktopSize:[0.081250,0.083333],mobileSize:[0.081250,0.083333],collisionBounds:[0.868750,0.816667,0.940625,0.868750],interactionAnchors:[{station:"model-bench",position:[0.904687,0.914583],facing:"up"}]},
  ruruBed: {id:"ruru-bed",worldAnchor:[0.501563,0.883333],desktopSize:[0.075000,0.062500],mobileSize:[0.075000,0.062500],interactionAnchors:[{station:"ruru",position:[0.551562,0.881250],facing:"left"}]},
  coffeeTable: {id:"coffee-table",worldAnchor:[0.300000,0.916667],desktopSize:[ROOM_FURNITURE.coffeeTable.size[0]/640,ROOM_FURNITURE.coffeeTable.size[1]/480],mobileSize:[ROOM_FURNITURE.coffeeTable.size[0]/640,ROOM_FURNITURE.coffeeTable.size[1]/480],collisionBounds:[0.237500,0.889583,0.362500,0.935417]},
  performance: {id:"performance",worldAnchor:[0.540625,0.679167],desktopSize:[0.100000,0.070833],mobileSize:[0.100000,0.070833],interactionAnchors:[{station:"performance",position:[0.540625,0.679167],facing:"down"}]}
};
// Compatibility metadata only: no workstation can bypass physical collision.
export const PROFILE_ROOM_DESK_ACCESS: Record<ProfileRoomDeskStation,{propKey:"primaryDesk"|"secondaryDesk";frontLane:ProfileRoomPoint;ingressGuardBottom:number;alignmentHalfWidth:number}> = {
 "primary-desk":{propKey:"primaryDesk",frontLane:[.29,.597],ingressGuardBottom:.597,alignmentHalfWidth:.02},
 "secondary-desk":{propKey:"secondaryDesk",frontLane:[.12,.774],ingressGuardBottom:.774,alignmentHalfWidth:.02}
};
export const PROFILE_ROOM_LAMP_ANCHORS: ProfileRoomPoint[] = [[.052,.20],[.205,.13],[.795,.13],[.947,.20]];

export const PROFILE_ROOM_STATION_POSITIONS = Object.values(PROFILE_ROOM_PROPS)
  .flatMap((prop) => prop.interactionAnchors || [])
  .reduce((positions, anchor) => {
    positions[anchor.station] = anchor.position;
    return positions;
  }, {} as Record<ProfileRoomStationId, ProfileRoomPoint>);

export const PROFILE_ROOM_STATION_FACING = Object.values(PROFILE_ROOM_PROPS)
  .flatMap((prop) => prop.interactionAnchors || [])
  .reduce((facings, anchor) => {
    facings[anchor.station] = anchor.facing;
    return facings;
  }, {} as Record<ProfileRoomStationId, ProfileActorFacing>);

export const PROFILE_ROOM_COLLISION_BOUNDS = Object.values(PROFILE_ROOM_PROPS)
  .filter((prop): prop is ProfileRoomPropDefinition & { collisionBounds: ProfileRoomBounds } => Boolean(prop.collisionBounds))
  .map((prop) => ({ id: prop.id, bounds: prop.collisionBounds }));

export const profileRoomLayoutSnapshot = () => ({
  version: PROFILE_ROOM_LAYOUT_VERSION,
  walkBounds: [...PROFILE_ROOM_WALK_BOUNDS] as ProfileRoomBounds,
  navGrid: { ...PROFILE_ROOM_NAV_GRID },
  props: Object.fromEntries(Object.entries(PROFILE_ROOM_PROPS).map(([id, prop]) => [id, {
    id: prop.id,
    worldAnchor: [...prop.worldAnchor],
    desktopSize: [...prop.desktopSize],
    mobileSize: [...prop.mobileSize],
    pivot: prop.sprite ? [...PROFILE_ROOM_SPRITE_META[prop.sprite].pivot] : undefined,
    collisionBounds: prop.collisionBounds ? [...prop.collisionBounds] : undefined
  }])),
  stationPositions: Object.fromEntries(Object.entries(PROFILE_ROOM_STATION_POSITIONS).map(([id, point]) => [id, [...point]])),
  tvScreenRect: [...(PROFILE_ROOM_SPRITE_META.tvCabinet.screenRect || [])],
  tvChildAnchors: Object.fromEntries(Object.entries(PROFILE_ROOM_SPRITE_META.tvCabinet.childAnchors || {}).map(([id, point]) => [id, [...point]])),
  lampAnchors: PROFILE_ROOM_LAMP_ANCHORS.map((point) => [...point])
});
