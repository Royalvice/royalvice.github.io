import type { ProjectId, QualityTier, SectionId, VoyageNodeId } from "../content/site";

export interface AppState {
  activeSection: SectionId;
  selectedProject: ProjectId | null;
  previewProject: ProjectId | null;
  selectedVoyageNode: VoyageNodeId;
  terminalPaused: boolean;
  reducedMotion: boolean;
  qualityTier: QualityTier;
  documentVisible: boolean;
  journeyTransition: number;
  horizonSettled: boolean;
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lowPower = window.matchMedia("(max-width: 760px)").matches || (navigator.hardwareConcurrency || 8) <= 4;

export const appState: AppState = {
  activeSection: "profile",
  selectedProject: null,
  previewProject: null,
  selectedVoyageNode: "eva01",
  terminalPaused: false,
  reducedMotion,
  qualityTier: lowPower ? "low" : "high",
  documentVisible: !document.hidden,
  journeyTransition: 0,
  horizonSettled: false
};

export function setActiveSection(section: SectionId): void {
  appState.activeSection = section;
  document.documentElement.dataset.section = section;
}
