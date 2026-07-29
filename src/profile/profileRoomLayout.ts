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
  | "anywhere-door";

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

export const PROFILE_ROOM_LAYOUT_VERSION = "grounded-v4" as const;
export const PROFILE_ROOM_WALK_BOUNDS: ProfileRoomBounds = [0.06, 0.36, 0.94, 0.91];
export const PROFILE_ROOM_NAV_GRID = { columns: 36, rows: 18 } as const;

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

export const PROFILE_ROOM_PROPS: Record<string, ProfileRoomPropDefinition> = {
  posterLeft: {
    id: "poster-left", worldAnchor: [0.145, 0.225], desktopSize: [0.06, 0.16], mobileSize: [0.098, 0.126],
    interactionAnchors: [{ station: "poster-left", position: [0.145, 0.39], facing: "up" }]
  },
  blackboard: {
    id: "blackboard", sprite: "blackboard", worldAnchor: [0.325, 0.22], desktopSize: [0.165, 0.17], mobileSize: [0.235, 0.12],
    interactionAnchors: [{ station: "blackboard", position: [0.325, 0.39], facing: "up" }]
  },
  posterRight: {
    id: "poster-right", worldAnchor: [0.675, 0.225], desktopSize: [0.06, 0.16], mobileSize: [0.098, 0.126],
    interactionAnchors: [{ station: "poster-right", position: [0.675, 0.39], facing: "up" }]
  },
  chandelier: {
    id: "chandelier", sprite: "chandelier", worldAnchor: [0.5, 0.39], desktopSize: [0.122, 0.216], mobileSize: [0.194, 0.156]
  },
  waterCooler: {
    id: "water-cooler", sprite: "waterCooler", worldAnchor: [0.79, 0.475], desktopSize: [0.073, 0.203], mobileSize: [0.122, 0.156],
    collisionBounds: [0.75, 0.405, 0.83, 0.49],
    interactionAnchors: [{ station: "water-cooler", position: [0.79, 0.515], facing: "up" }]
  },
  door: {
    id: "anywhere-door", worldAnchor: [0.92, 0.52], desktopSize: [0.074, 0.225], mobileSize: [0.122, 0.173],
    collisionBounds: [0.89, 0.405, 0.945, 0.515],
    interactionAnchors: [{ station: "anywhere-door", position: [0.875, 0.535], facing: "right" }]
  },
  secondaryDesk: {
    id: "secondary-desk", sprite: "secondaryDesk", worldAnchor: [0.23, 0.665], desktopSize: [0.118, 0.197], mobileSize: [0.19, 0.147],
    collisionBounds: [0.14, 0.585, 0.32, 0.69],
    interactionAnchors: [{ station: "secondary-desk", position: [0.23, 0.72], facing: "up" }]
  },
  primaryDesk: {
    id: "primary-desk", sprite: "secondaryDesk", worldAnchor: [0.48, 0.665], desktopSize: [0.132, 0.207], mobileSize: [0.205, 0.153],
    collisionBounds: [0.385, 0.58, 0.575, 0.69],
    interactionAnchors: [{ station: "primary-desk", position: [0.48, 0.72], facing: "up" }]
  },
  tv: {
    id: "tv-cabinet", sprite: "tvCabinet", worldAnchor: [0.77, 0.655], desktopSize: [0.13, 0.207], mobileSize: [0.205, 0.153],
    collisionBounds: [0.685, 0.565, 0.855, 0.675],
    interactionAnchors: [{ station: "tv-console", position: [0.87, 0.69], facing: "left" }]
  },
  sofa: {
    id: "sofa", sprite: "sofa", worldAnchor: [0.77, 0.86], desktopSize: [0.158, 0.213], mobileSize: [0.245, 0.168],
    collisionBounds: [0.675, 0.835, 0.865, 0.905],
    interactionAnchors: [
      { station: "sofa-left", position: [0.72, 0.815], facing: "up" },
      { station: "sofa-right", position: [0.8, 0.815], facing: "up" }
    ]
  }
};

/**
 * Desk users do not enter a workstation diagonally through its side.  They
 * first reach the clear front lane, align with the chair/desk centre, then
 * walk straight into the interaction anchor.  The ingress guard extends
 * below the foot-point collision box because a tall sprite's visible torso
 * reaches the desk before its feet do.
 */
export const PROFILE_ROOM_DESK_ACCESS: Record<ProfileRoomDeskStation, {
  propKey: "primaryDesk" | "secondaryDesk";
  frontLane: ProfileRoomPoint;
  ingressGuardBottom: number;
  alignmentHalfWidth: number;
}> = {
  "secondary-desk": {
    propKey: "secondaryDesk",
    frontLane: [0.23, 0.88],
    ingressGuardBottom: 0.88,
    alignmentHalfWidth: 0.025
  },
  "primary-desk": {
    propKey: "primaryDesk",
    frontLane: [0.48, 0.88],
    ingressGuardBottom: 0.88,
    alignmentHalfWidth: 0.025
  }
};

export const PROFILE_ROOM_LAMP_ANCHORS: ProfileRoomPoint[] = [0.055, 0.233, 0.411, 0.589, 0.767, 0.945]
  .map((x) => [x, 0.145] as ProfileRoomPoint);

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
