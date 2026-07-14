import type { QualityTier } from "../content/site";

export interface SceneRenderer {
  start(): void;
  pause(): void;
  resume(): void;
  resize(): void;
  setQuality(tier: QualityTier): void;
  destroy(): void;
}

export interface TransitionAwareSceneRenderer extends SceneRenderer {
  setTransitionProgress(progress: number): void;
}
