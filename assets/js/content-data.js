window.HOME_HERO = {
  profile: {
    title: "Zongyuan Yang",
    avatar: "assets/profile/nobita.png",
    identity: ["PhD", "BUPT", "Seele AI"],
    directions: [
      "3D MLLM",
      "Interactive World Model",
      "Neural Graphics",
      "Realtime Rendering"
    ],
    vision: "Building an OASIS where everyone gets to play, create, and feel ridiculously alive.",
    modules: [
      {
        title: "Now Building",
        tag: "NOW",
        body: "Native 3D + displays."
      },
      {
        title: "Research Chain",
        tag: "ROUTE",
        body: "Graphics to 3D MLLM."
      },
      {
        title: "OASIS Target",
        tag: "END",
        body: "Playable creation worlds."
      },
      {
        title: "Signal Ports",
        tag: "LINK",
        body: "Papers, code, models."
      }
    ],
    contacts: [
      { type: "email", label: "Email", href: "mailto:yangzongyuan0@bupt.edu.cn" },
      { type: "github", label: "GitHub", href: "https://github.com/Royalvice" },
      { type: "scholar", label: "Google Scholar", href: "https://scholar.google.com.hk/citations?user=2IYvwdwAAAAJ&hl=zh-CN" },
      { type: "huggingface", label: "Hugging Face", href: "https://huggingface.co/Royalvice" }
    ],
    achievements: [
      { label: "2x SIGGRAPH", material: "holographic-diamond" },
      { label: "ICCV", material: "metallic-gold" },
      { label: "ACM MM", material: "metallic-silver" }
    ]
  },
  exhibits: [
    {
      id: "ssat",
      title: "SSAT",
      achievement: "SIGGRAPH 2026",
      direction: "Realtime Light-field Path Tracing",
      media: { type: "image", src: "img/ssat_teaser.png" },
      trophy: { material: "legendary-gold-crystal" },
      summary: "Sparse spatial-angular-temporal reconstruction for real-time light-field path tracing.",
      links: [
        { label: "Page", href: "https://coronaengine.github.io/ssat-page/" },
        { label: "Paper", state: "coming-soon" },
        { label: "Code", state: "coming-soon" }
      ]
    },
    {
      id: "directl",
      title: "DirectL",
      achievement: "SIGGRAPH Asia / ACM TOG 2024",
      direction: "Radiance Field Rendering",
      media: { type: "video", src: "img/directl_preview.mp4" },
      trophy: { material: "prism-render-engine" },
      summary: "Efficient radiance-field rendering pipeline for 3D light-field displays.",
      links: [
        { label: "Page", href: "https://coronaengine.github.io/ssat-page/" },
        { label: "arXiv", href: "https://arxiv.org/abs/2407.14053" },
        { label: "Code", state: "coming-soon" }
      ]
    },
    {
      id: "eva01",
      title: "EVA01",
      achievement: "Native 3D MLLM",
      direction: "3D Understanding, Generation, Editing",
      media: { type: "image", src: "assets/exhibits/eva01-teaser.webp" },
      trophy: { material: "ml3d-crystal-core" },
      summary: "A native 3D multimodal model route for understanding, generating, and editing mesh worlds.",
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
      achievement: "ACM MM 2023",
      direction: "Document Enhancement",
      media: { type: "image", src: "img/docdiff_fig.png" },
      trophy: { material: "silver-document-scanner" },
      summary: "Residual diffusion restoration for degraded document images.",
      links: [
        { label: "arXiv", href: "https://arxiv.org/abs/2305.03892" },
        { label: "Code", href: "https://github.com/Royalvice/DocDiff" }
      ]
    }
  ]
};

window.SITE_CONTENT = {
  profile: {
    name: "Zongyuan Yang",
    title: "Second-year PhD student @ LIVIN, BUPT",
    fields: ["3D Display", "Neural Rendering", "3D AIGC"]
  },
  textCapsules: [
    {
      type: "VISION",
      title: "Research Vision",
      body: "Placeholder for your long-form research vision. This capsule is designed for a personal statement about spatial displays, generative 3D content, and the kind of future interface you want to build."
    },
    {
      type: "DIRECTION",
      title: "Current Direction",
      body: "Placeholder for your active research direction. Use this space for light-field rendering, real-time reconstruction, 3D generation, and display-native content pipelines."
    },
    {
      type: "INTEREST",
      title: "Research Interests",
      body: "3D Display, Neural Rendering, 3D AIGC, light-field systems, naked-eye 3D, spatial media, and intelligent visual content creation."
    },
    {
      type: "PERSONAL",
      title: "Personal Log",
      body: "Placeholder for personal interests, taste, games, tools, design ideas, and anything that makes the lab cabinet feel like yours instead of a generic academic page."
    }
  ],
  news: [
    { date: "2026.07", type: "SHIP", rarity: "legendary", text: "Thoth v0.1.0 shipped: agent harness with Clarify & Loop." },
    { date: "2026.06", type: "MODEL", rarity: "legendary", text: "EVA01 shipped: native 3D MLLM online." },
    { date: "2026.06", type: "PAPER", rarity: "epic", text: "ECCV 2026 paper accepted: CV lane unlocked." },
    { date: "2026.04", type: "PAPER", rarity: "legendary", text: "SIGGRAPH 2026 paper accepted: real-time neural graphics." },
    { date: "2025.05", type: "PAPER", rarity: "epic", text: "ICCV 2025 paper accepted: CV lane clear." },
    { date: "2024.10", type: "TOG", rarity: "legendary", text: "TOG paper at SIGGRAPH Asia 2024: real-time neural graphics." },
    { date: "2023.05", type: "DROP", rarity: "rare", text: "DocDiff shipped and accepted to ACM MM 2023." }
  ],
  cabinetItems: [
    { id: "ssat", label: "SIGGRAPH 2026", rarity: "legendary", model: "./mesh/a.glb", title: "SSAT", slot: [-5.8, 3.7, 0], scale: 3.7 },
    { id: "directl", label: "TOG 2024", rarity: "legendary", model: "./mesh/b.glb", title: "DirectL", slot: [5.8, 3.7, 0], scale: 3.2 },
    { id: "eye3", label: "ICCV 2025", rarity: "epic", model: "./mesh/c.glb", title: "EYE3", slot: [-5.8, -2.2, 0], scale: 2.2 },
    { id: "elf", label: "PR 2026", rarity: "rare", model: "./mesh/d.glb", title: "ELF", slot: [5.8, -2.2, 0], scale: 2.6 },
    { id: "docdiff", label: "ACM MM 2023", rarity: "epic", model: null, title: "DocDiff", slot: [-5.8, -7.7, 0], scale: 1 },
    { id: "gdb", label: "ICCV / PR", rarity: "rare", model: null, title: "Archive", slot: [5.8, -7.7, 0], scale: 1 }
  ],
  publicationGroups: [
    {
      label: "3D Display & Neural Rendering",
      items: [
        {
          title: "SSAT: Real-Time Light-Field Path Tracing for 3D Displays via Sparse Spatial-Angular-Temporal Reconstruction",
          venue: "SIGGRAPH 2026",
          year: "2026",
          rarity: "legendary",
          media: { type: "image", src: "img/ssat_teaser.png", alt: "SSAT teaser" },
          authors: "Zongyuan Yang, et al.",
          links: [
            { label: "Page", href: "https://coronaengine.github.io/ssat-page/" },
            { label: "Paper", state: "coming-soon" },
            { label: "Code", state: "coming-soon" }
          ]
        },
        {
          title: "DirectL: Efficient Radiance Fields Rendering for 3D Light Field Displays",
          venue: "ACM TOG / SIGGRAPH Asia 2024",
          year: "2024",
          rarity: "legendary",
          media: { type: "video", src: "img/directl_preview.mp4", alt: "DirectL preview" },
          authors: "Zongyuan Yang, Baolin Liu, Yingde Song, Lan Yi, Yongping Xiong, Zhaohe Zhang, Xunbo Yu",
          links: [
            { label: "Page", href: "https://coronaengine.github.io/ssat-page/" },
            { label: "arXiv", href: "https://arxiv.org/abs/2407.14053" },
            { label: "Code", state: "coming-soon" }
          ]
        },
        {
          title: "EYE3: Turn Anything into Naked-eye 3D",
          venue: "ICCV 2025",
          year: "2025",
          rarity: "epic",
          media: null,
          authors: "Yingde Song, Zongyuan Yang, Baolin Liu, Yongping Xiong, Sai Chen, Lan Yi, Zhaohe Zhang, Xunbo Yu",
          links: [{ label: "Paper", href: "#", title: "coming soon" }]
        },
        {
          title: "ELF: Edit Anything for Light Field Displays",
          venue: "Pattern Recognition",
          year: "2026",
          rarity: "rare",
          media: null,
          authors: "Baolin Liu, Zongyuan Yang, Yingde Song, Yongping Xiong",
          links: [{ label: "Paper", href: "https://doi.org/10.1016/j.patcog.2026.113282" }]
        }
      ]
    },
    {
      label: "Document & Image Enhancement",
      items: [
        {
          title: "DocDiff: Document Enhancement via Residual Diffusion Models",
          venue: "ACM MM 2023",
          year: "2023",
          rarity: "epic",
          media: { type: "image", src: "img/docdiff_fig.png", alt: "DocDiff figure" },
          authors: "Zongyuan Yang, Baolin Liu, Yongping Xiong, Lan Yi, Guibin Wu, Xiaojun Tang, Ziqi Liu, Junjie Zhou, Xing Zhang",
          links: [
            { label: "arXiv", href: "https://arxiv.org/abs/2305.03892" },
            { label: "Code", href: "https://github.com/Royalvice/DocDiff" }
          ]
        },
        {
          title: "GDB: Gated Convolutions-based Document Binarization",
          venue: "Pattern Recognition",
          year: "2024",
          rarity: "rare",
          media: null,
          authors: "Zongyuan Yang, Baolin Liu, Yongping Xiong, Guibin Wu",
          links: [{ label: "Paper", href: "https://doi.org/10.1016/j.patcog.2023.109989" }]
        },
        {
          title: "TextDiff: Enhancing Scene Text Image Super-Resolution with Mask-Guided Residual Diffusion Models",
          venue: "Pattern Recognition",
          year: "2025",
          rarity: "rare",
          media: null,
          authors: "Baolin Liu, Zongyuan Yang, Chinwai Chiu, Yongping Xiong",
          links: [
            { label: "Paper", href: "https://doi.org/10.1016/j.patcog.2025.111513" },
            { label: "arXiv", href: "https://arxiv.org/abs/2308.06743" }
          ]
        },
        {
          title: "DDG-Net: Discriminability-Driven Graph Network for Weakly-supervised Temporal Action Localization",
          venue: "ICCV 2023",
          year: "2023",
          rarity: "epic",
          media: null,
          authors: "Xiaojun Tang, Junsong Fan, Chuanchen Luo, Zhaoxiang Zhang, Man Zhang, Zongyuan Yang",
          links: [
            { label: "Paper", href: "https://doi.org/10.1109/ICCV51070.2023.00609" },
            { label: "arXiv", href: "https://arxiv.org/abs/2307.16415" }
          ]
        }
      ]
    }
  ],
  experiences: [
    { date: "2024-now", title: "PhD Stage", text: "State Key Laboratory of Networking and Switching Technology, LIVIN Lab, BUPT." },
    { date: "2023-2024", title: "3D Display Route", text: "Exploring light-field rendering, naked-eye 3D, and display-native content pipelines." },
    { date: "2021-2023", title: "Document Enhancement Route", text: "Diffusion and restoration work for document and scene-text image enhancement." }
  ],
  awards: [
    { title: "SIGGRAPH Technical Papers", text: "Legendary research item unlocked in 2026." },
    { title: "ACM TOG", text: "Journal-level graphics trophy, presented at SIGGRAPH Asia 2024." },
    { title: "ICCV", text: "Vision conference achievement unlocked in 2023 and 2025." },
    { title: "ACM MM", text: "Multimedia achievement unlocked with DocDiff." }
  ],
  services: [
    { tag: "REVIEW", text: "Academic reviewing and community service placeholder." },
    { tag: "OPEN", text: "Project, code, and artifact links can be expanded here." },
    { tag: "CONTACT", text: "Email, scholar, and GitHub portals are available from the profile card." }
  ],
  stackBoard: {
    direction: {
      kicker: "Capability Stack",
      title: "Neural Graphics Rendering -> 3D MLLM -> Game World Model",
      body: "From display-native rendering to native 3D intelligence, then toward playable worlds.",
      tags: ["Rendering", "3D Understanding", "3D Generation", "Spatial Displays", "Interactive Worlds"]
    },
    voyage: {
      label: "PhD Voyage",
      progress: 0.75,
      progressText: "3 / 4",
      currentStage: "Current Stage",
      caption: "A small research boat drifting from neural graphics toward native 3D intelligence.",
      nodes: [
        { id: "docdiff", title: "DocDiff", lane: "Document Bay", progress: 0.08 },
        { id: "directl", title: "DirectL", lane: "Light-field Current", progress: 0.32 },
        { id: "neural", title: "SSAT / EYE3 / ELF", lane: "Neural Graphics Reef", progress: 0.54 },
        { id: "eva01", title: "EVA01", lane: "3D MLLM Harbor", progress: 0.76 },
        { id: "world", title: "Game World Model", lane: "OASIS Horizon", progress: 0.95 }
      ]
    },
    lanes: [
      {
        label: "Neural Graphics Rendering",
        items: [
          {
            title: "SSAT",
            venue: "SIGGRAPH 2026",
            rarity: "legendary",
            media: { type: "image", src: "/assets/gallery/hero/ssat_teaser.png", alt: "SSAT teaser" },
            text: "Realtime light-field rendering with sparse spatial reconstruction.",
            links: [
              { label: "Page", href: "https://coronaengine.github.io/ssat-page/" },
              { label: "Paper", state: "coming-soon" },
              { label: "Code", state: "coming-soon" }
            ]
          },
          {
            title: "DirectL",
            venue: "ACM TOG / SIGGRAPH Asia 2024",
            rarity: "legendary",
            media: { type: "video", src: "/assets/gallery/hero/directl_preview.mp4", poster: "/assets/gallery/hero/directl_frame.jpg", alt: "DirectL preview video" },
            text: "Radiance-field rendering for 3D light-field displays.",
            links: [
              { label: "Page", href: "https://coronaengine.github.io/ssat-page/" },
              { label: "arXiv", href: "https://arxiv.org/abs/2407.14053" },
              { label: "Code", state: "coming-soon" }
            ]
          },
          {
            title: "EYE3: Turn Anything into Naked-eye 3D",
            venue: "ICCV 2025",
            rarity: "epic",
            text: "A display-native route for converting visual content into naked-eye 3D experiences.",
            links: [{ label: "Paper", href: "#", state: "coming-soon" }]
          },
          {
            title: "ELF: Edit Anything for Light Field Displays",
            venue: "Pattern Recognition 2026",
            rarity: "rare",
            text: "Editing visual content for light field displays and spatial media.",
            links: [{ label: "Paper", href: "https://doi.org/10.1016/j.patcog.2026.113282" }]
          }
        ]
      },
      {
        label: "3D MLLM",
        featured: {
          title: "EVA01",
          subtitle: "Unified Native 3D Understanding and Generation via Mixture-of-Transformers",
          venue: "arXiv 2026",
          media: { type: "image", src: "/assets/gallery/hero/eva01_teaser.webp", alt: "EVA01 native 3D teaser" },
          hero: "/assets/gallery/hero/eva01_teaser.webp",
          text: "Native 3D understanding and generation with mesh tokens.",
          links: [
            { label: "Page", href: "https://www.seeles.ai/research/pages/EVA01" },
            { label: "arXiv", href: "https://arxiv.org/abs/2605.16745" },
            { label: "Code", href: "https://github.com/SeeleAI/OpenEVA" },
            { label: "Hug", href: "https://huggingface.co/collections/SEELE-AI/openeva" }
          ]
        }
      },
      {
        label: "Unclassified",
        items: [
          {
            title: "DocDiff",
            venue: "ACM MM 2023",
            rarity: "epic",
            text: "Document enhancement via residual diffusion models.",
            links: [
              { label: "arXiv", href: "https://arxiv.org/abs/2305.03892" },
              { label: "Code", href: "https://github.com/Royalvice/DocDiff" }
            ]
          }
        ]
      }
    ],
    archive: [
      { title: "GDB", venue: "Pattern Recognition 2024" },
      { title: "TextDiff", venue: "Pattern Recognition 2025" },
      { title: "DDG-Net", venue: "ICCV 2023" }
    ]
  },
  ending: {
    kicker: "The End!",
    title: "The next save point is a playable OASIS.",
    lead: "This page is a quiet placeholder for the research vision and personal route behind the cabinet.",
    chapters: [
      {
        title: "OASIS Vision",
        text: "A future where spatial intelligence becomes a playground, and every creator can build worlds that feel alive."
      },
      {
        title: "Personal Route",
        text: "From document restoration to neural graphics, from light fields to native 3D models, the path keeps moving toward playable imagination."
      },
      {
        title: "Next Save Point",
        text: "Game World Model, interactive creation, and a gentler interface for people to explore the unknown."
      }
    ]
  }
};
