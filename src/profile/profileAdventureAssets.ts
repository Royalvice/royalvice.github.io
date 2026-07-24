export type ProfileActorId = "nobita" | "doraemon" | "shizuka" | "gian" | "suneo";

export const PROFILE_ACTOR_IDS: ProfileActorId[] = ["nobita", "doraemon", "shizuka", "gian", "suneo"];

export type ProfileSpriteFrameId =
  | "idle"
  | "walk-contact"
  | "walk-passing"
  | "walk-opposite-contact"
  | "interaction-a"
  | "interaction-b"
  | "portal-reaction"
  | "celebration"
  | "character-signature";

export type ProfileActorDefinition = {
  id: ProfileActorId;
  label: string;
  baseAssetUrl: string;
  movementAssetUrl: string;
  lifeAssetUrl: string;
  fallbackColor: string;
  scale: number;
};

const actor = (
  id: ProfileActorId,
  label: string,
  fallbackColor: string,
  scale: number
): ProfileActorDefinition => ({
  id,
  label,
  // v4 is assembled from independently reviewed, transparent 128px frames.
  // Keep the old paths only in the explicit compatibility export below; the
  // production actor loader must never silently fall back to v2/v3 sheets.
  baseAssetUrl: `/assets/profile/adventure/room-v4/actors/${id}-base-3x3.webp`,
  movementAssetUrl: `/assets/profile/adventure/room-v4/actors/${id}-movement-3x3.webp`,
  lifeAssetUrl: `/assets/profile/adventure/room-v4/actors/${id}-life-3x3.webp`,
  fallbackColor,
  scale
});

export const PROFILE_ACTORS: Record<ProfileActorId, ProfileActorDefinition> = {
  nobita: actor("nobita", "Nobita", "#f1c947", 0.94),
  doraemon: actor("doraemon", "Doraemon", "#159bd7", 1),
  shizuka: actor("shizuka", "Shizuka", "#ee86a3", 0.9),
  gian: actor("gian", "Gian", "#d96e26", 1.08),
  suneo: actor("suneo", "Suneo", "#4a9e5b", 0.86)
};

export const PROFILE_BASE_FRAME_ORDER: ProfileSpriteFrameId[] = [
  "idle",
  "walk-contact",
  "walk-passing",
  "walk-opposite-contact",
  "interaction-a",
  "interaction-b",
  "portal-reaction",
  "celebration",
  "character-signature"
];

export const PROFILE_MOVEMENT_FRAME_ORDER = [
  "down-0",
  "down-1",
  "down-2",
  "side-0",
  "side-1",
  "side-2",
  "up-0",
  "up-1",
  "up-2"
] as const;

export const PROFILE_LIFE_FRAME_ORDER = [
  "think-a",
  "think-b",
  "drink-a",
  "drink-b",
  "sit-game-a",
  "sit-game-b",
  "portal-enter",
  "portal-return",
  "room-reaction"
] as const;

export const PROFILE_ROOM_V3_ASSETS = {
  manifest: "/assets/profile/adventure/room-v3/profile-room-v3-manifest.json",
  furniture: "/assets/profile/adventure/room-v3/furniture/furniture-grounded-v4-3x3.webp",
  door: "/assets/profile/adventure/room-v3/props/anywhere-door-2x1.webp",
  lamps: "/assets/profile/adventure/room-v3/props/bulkhead-wall-lamp-v4-4x1.webp",
  spiritedAwayPoster: "/assets/profile/adventure/room-v3/posters/spirited-away-pixel.webp",
  onePiecePoster: "/assets/profile/adventure/room-v3/posters/one-piece-east-blue-pixel.webp",
  fallbackDesktop: "/assets/profile/adventure/room-v3/posters/profile-room-v3-fallback-desktop.webp",
  fallbackMobile: "/assets/profile/adventure/room-v3/posters/profile-room-v3-fallback-mobile.webp"
} as const;

/**
 * Room furniture remains the reviewed v3 set.  Only actor atlases are
 * versioned to v4 in this pass, so the room has no duplicate furniture
 * downloads while the new 27-frame character sets are audited.
 */
export const PROFILE_ROOM_V4_ASSETS = {
  manifest: "/assets/profile/adventure/room-v4/profile-room-v4-manifest.json",
  furniture: PROFILE_ROOM_V3_ASSETS.furniture,
  door: PROFILE_ROOM_V3_ASSETS.door,
  lamps: PROFILE_ROOM_V3_ASSETS.lamps,
  spiritedAwayPoster: PROFILE_ROOM_V3_ASSETS.spiritedAwayPoster,
  onePiecePoster: PROFILE_ROOM_V3_ASSETS.onePiecePoster,
  fallbackDesktop: PROFILE_ROOM_V3_ASSETS.fallbackDesktop,
  fallbackMobile: PROFILE_ROOM_V3_ASSETS.fallbackMobile
} as const;

// Kept for callers that only need the final fallback locations.  The public
// alias follows the production v4 manifest while PROFILE_ROOM_V3_ASSETS
// remains available to older tests/tools that explicitly request it.
export const PROFILE_SPRITE_ROOM_ASSETS = PROFILE_ROOM_V4_ASSETS;
