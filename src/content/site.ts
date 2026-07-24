export type SectionId = "profile" | "voyage" | "horizon";
export type ProjectId = "ssat" | "directl" | "eva01" | "docdiff";
export type VoyageNodeId = "docdiff" | "directl" | "neural" | "eva01" | "world";
export type QualityTier = "high" | "balanced" | "low" | "fallback";

export interface LinkItem {
  label: string;
  href?: string;
  state?: "coming-soon";
}

export interface ProjectMedia {
  type: "image" | "video";
  src: string;
  poster?: string;
  alt: string;
}

export interface Project {
  id: ProjectId;
  title: string;
  venue: string;
  direction: string;
  summary: string;
  media: ProjectMedia;
  heroTexture: string;
  heroVideo?: string;
  trophyTier: "legendary-holo" | "gold" | "silver" | "blue-crystal";
  links: LinkItem[];
}

export interface NewsItem {
  id: string;
  date: string;
  type: "PAPER" | "CODE";
  text: string;
  url?: string;
}

export interface VoyageNode {
  id: VoyageNodeId;
  title: string;
  subtitle: string;
  progress: number;
  x: number;
  y: number;
  status: "complete" | "current" | "future";
  landmark: "dock" | "lighthouse" | "reef" | "harbor" | "gate";
  projectIds: ProjectId[];
  log: string;
  venue: string;
}

export interface VoyageLogEntry {
  placeholder: boolean;
  entry: "00" | "01" | "02" | "03" | "04";
  title: string;
  subtitle: string;
  watch: string;
  bearing: string;
  seaState: string;
  date: string;
  paragraphs: [string, string?];
  projectIds: ProjectId[];
}

export interface SiteContent {
  profile: {
    name: string;
    avatar: string;
    intro: string;
    researchSummary: string;
    contributions: string[];
    skills: string[];
    interests: { id: "game" | "fitness" | "music" | "metaphysics"; label: string }[];
    status: string;
    social: { id: "github" | "scholar" | "huggingface"; label: string; href: string }[];
  };
  projects: Project[];
  news: NewsItem[];
  voyage: { progress: 0.75; nodes: VoyageNode[]; logs: Record<VoyageNodeId, VoyageLogEntry> };
  awards: { title: string; text: string }[];
  services: { tag: string; text: string }[];
  archive: { title: string; venue: string }[];
  ending: {
    kicker: "THE END";
    chapters: { title: "OASIS Vision" | "Personal Route" | "Next Save Point"; text: string }[];
  };
}

export const projects: Project[] = [
  {
    id: "ssat",
    title: "SSAT",
    venue: "SIGGRAPH 2026",
    direction: "Realtime Light-field Path Tracing",
    summary: "Sparse spatial-angular-temporal reconstruction for real-time light-field path tracing.",
    media: { type: "image", src: "/assets/gallery/hero/ssat_teaser.png", alt: "SSAT teaser" },
    heroTexture: "/assets/gallery/hero/ssat_teaser.png",
    trophyTier: "legendary-holo",
    links: [
      { label: "Page", href: "https://coronaengine.github.io/ssat-page/" },
      { label: "Paper", state: "coming-soon" },
      { label: "Code", state: "coming-soon" }
    ]
  },
  {
    id: "directl",
    title: "DirectL",
    venue: "ACM TOG / SIGGRAPH Asia 2024",
    direction: "Radiance Field Rendering",
    summary: "Efficient radiance-field rendering for 3D light-field displays.",
    media: {
      type: "video",
      src: "/assets/gallery/hero/directl_preview.mp4",
      poster: "/assets/gallery/hero/directl_frame.jpg",
      alt: "DirectL radiance-field preview"
    },
    heroTexture: "/assets/gallery/hero/directl_frame.jpg",
    heroVideo: "/assets/gallery/hero/directl_preview.mp4",
    trophyTier: "legendary-holo",
    links: [
      { label: "Page", href: "https://coronaengine.github.io/ssat-page/" },
      { label: "arXiv", href: "https://arxiv.org/abs/2407.14053" },
      { label: "Code", state: "coming-soon" }
    ]
  },
  {
    id: "eva01",
    title: "EVA01",
    venue: "SIGGRAPH Asia 2026 (TOG)",
    direction: "3D Understanding, Generation, Editing",
    summary: "Unified native 3D understanding and generation with mesh tokens.",
    media: { type: "image", src: "/assets/gallery/hero/eva01_teaser.webp", alt: "EVA01 native 3D teaser" },
    heroTexture: "/assets/gallery/hero/eva01_teaser.webp",
    trophyTier: "blue-crystal",
    links: [
      { label: "Page", href: "https://www.seeles.ai/research/pages/EVA01" },
      { label: "arXiv", href: "https://arxiv.org/abs/2605.16745" },
      { label: "Code", href: "https://github.com/SeeleAI/OpenEVA" },
      { label: "Hug", href: "https://huggingface.co/collections/SEELE-AI/openeva" }
    ]
  },
  {
    id: "docdiff",
    title: "DocDiff",
    venue: "ACM MM 2023",
    direction: "Document Enhancement",
    summary: "Residual diffusion restoration for degraded document images.",
    media: { type: "image", src: "/assets/gallery/hero/docdiff_fig.png", alt: "DocDiff document enhancement figure" },
    heroTexture: "/assets/gallery/hero/docdiff_fig.png",
    trophyTier: "silver",
    links: [
      { label: "arXiv", href: "https://arxiv.org/abs/2305.03892" },
      { label: "Code", href: "https://github.com/Royalvice/DocDiff" }
    ]
  }
];

export const siteContent: SiteContent = {
  profile: {
    name: "Zongyuan Yang",
    avatar: "/assets/profile/nobita.png",
    intro: "I am Zongyuan Yang, a Second-year PhD at BUPT.",
    researchSummary: "Neural Graphics & 3D AIGC & Interactive World Models",
    contributions: [
      "Real-time light-field rendering for naked-eye 3D displays",
      "Native 3D MLLM pre-training and post-training",
      "3D memory latent development for Interactive World Models"
    ],
    skills: ["Deep Learning", "Agent Harnessing", "Computer Graphics"],
    interests: [
      { id: "game", label: "Game Dev" },
      { id: "fitness", label: "Fitness" },
      { id: "music", label: "Music" },
      { id: "metaphysics", label: "Metaphysics" }
    ],
    status: "Currently exploring game development with Godot.",
    social: [
      { id: "github", label: "GitHub", href: "https://github.com/Royalvice" },
      { id: "scholar", label: "Google Scholar", href: "https://scholar.google.com.hk/citations?user=2IYvwdwAAAAJ&hl=zh-CN" },
      { id: "huggingface", label: "Hugging Face", href: "https://huggingface.co/Royalvice" }
    ]
  },
  projects,
  news: [
    { id: "thoth-010", date: "2026.07", type: "CODE", text: "Thoth v0.1.0 shipped: agent harness with Clarify & Loop." },
    { id: "eva01", date: "2026.07", type: "PAPER", text: "EVA01 accepted to SIGGRAPH Asia 2026 (TOG): native 3D MLLM online." },
    { id: "eccv-2026", date: "2026.06", type: "PAPER", text: "ECCV 2026 paper accepted: CV lane unlocked." },
    { id: "siggraph-2026", date: "2026.04", type: "PAPER", text: "SIGGRAPH 2026 paper accepted: real-time neural graphics." },
    { id: "iccv-2025", date: "2025.05", type: "PAPER", text: "ICCV 2025 paper accepted: CV lane clear." },
    { id: "tog-2024", date: "2024.10", type: "PAPER", text: "TOG paper at SIGGRAPH Asia 2024: real-time neural graphics.", url: "https://arxiv.org/abs/2407.14053" },
    { id: "docdiff-2023", date: "2023.05", type: "CODE", text: "DocDiff shipped and accepted to ACM MM 2023.", url: "https://github.com/Royalvice/DocDiff" }
  ],
  voyage: {
    progress: 0.75,
    nodes: [
      { id: "docdiff", title: "Document Dock", subtitle: "DocDiff · Departure Archive", progress: 0.08, x: 7, y: 69, status: "complete", landmark: "dock", projectIds: ["docdiff"], venue: "ACM MM 2023", log: "Document restoration becomes the first working harbor." },
      { id: "neural", title: "Prism Sea", subtitle: "Neural Graphics · SSAT", progress: 0.30, x: 28, y: 54, status: "complete", landmark: "reef", projectIds: ["ssat"], venue: "SIGGRAPH 2026", log: "SSAT and display-native rendering split the image into a navigable field." },
      { id: "directl", title: "Light-Field Lighthouse", subtitle: "DirectL · Radiance Field", progress: 0.52, x: 47, y: 38, status: "complete", landmark: "lighthouse", projectIds: ["directl"], venue: "ACM TOG 2024", log: "Efficient radiance fields illuminate the spatial-display current." },
      { id: "eva01", title: "Native 3D Harbor", subtitle: "EVA01 · Current Berth", progress: 0.76, x: 60, y: 65, status: "current", landmark: "harbor", projectIds: ["eva01"], venue: "SIGGRAPH Asia 2026 (TOG)", log: "The current stage: native 3D understanding and generation." },
      { id: "world", title: "OASIS Gate", subtitle: "Interactive World Models", progress: 0.95, x: 63, y: 25, status: "future", landmark: "gate", projectIds: [], venue: "NEXT QUEST", log: "The route continues toward interactive, playable world models." }
    ],
    logs: {
      docdiff: {
        placeholder: true, entry: "00", title: "Document Dock", subtitle: "Departure Archive · DocDiff", watch: "First Watch", bearing: "082° E", seaState: "Calm / Copper", date: "ACM MM · 2023",
        paragraphs: ["At first light, the archive was sealed and the instruments were checked. The voyage begins with systems that preserve what would otherwise be lost."], projectIds: ["docdiff"]
      },
      neural: {
        placeholder: true, entry: "01", title: "Prism Sea", subtitle: "Neural Graphics · SSAT", watch: "Morning Watch", bearing: "114° ESE", seaState: "Refracted / II", date: "SIGGRAPH · 2026",
        paragraphs: ["The water split every signal into color and angle. Beyond the reef, images began to behave like spaces rather than flat records."], projectIds: ["ssat"]
      },
      directl: {
        placeholder: true, entry: "02", title: "Light-Field Lighthouse", subtitle: "DirectL · Radiance Field", watch: "Dog Watch", bearing: "138° SE", seaState: "Mist / III", date: "ACM TOG · 2024",
        paragraphs: ["A narrow beam crossed the fog and returned as many views at once. The lighthouse held the course through a field of radiance."], projectIds: ["directl"]
      },
      eva01: {
        placeholder: true, entry: "03", title: "Native 3D Harbor", subtitle: "EVA01 · Current Berth", watch: "Second Watch", bearing: "164° SSE", seaState: "Working Tide / II", date: "SIGGRAPH ASIA · 2026 (TOG)",
        paragraphs: ["The harbor lights answered in sequence. Geometry, language, and generation now share the same native channel."], projectIds: ["eva01"]
      },
      world: {
        placeholder: true, entry: "04", title: "OASIS Gate", subtitle: "Interactive World Models", watch: "Night Watch", bearing: "191° S", seaState: "Uncharted / Green", date: "NEXT QUEST",
        paragraphs: ["The chart ends at a green aperture. Beyond it lies a world that remembers, responds, and continues without a final frame."], projectIds: []
      }
    }
  },
  awards: [
    { title: "SIGGRAPH Technical Papers", text: "Three first-author research routes unlocked." },
    { title: "ACM TOG", text: "Journal graphics work presented at SIGGRAPH Asia 2024." },
    { title: "ICCV", text: "Vision research milestones in 2023 and 2025." },
    { title: "ACM MM", text: "DocDiff document restoration milestone." }
  ],
  services: [],
  archive: [
    { title: "GDB", venue: "Pattern Recognition 2024" },
    { title: "TextDiff", venue: "Pattern Recognition 2025" },
    { title: "DDG-Net", venue: "ICCV 2023" }
  ],
  ending: {
    kicker: "THE END",
    chapters: [
      { title: "OASIS Vision", text: "" },
      { title: "Personal Route", text: "" },
      { title: "Next Save Point", text: "" }
    ]
  }
};
