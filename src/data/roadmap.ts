export const researchRoadmap = [
  {
    slug: "robotics-instruction",
    title: "Better Instructing Robotics",
    question: "How can a person specify intent so that a robot understands the task, constraints, and acceptable corrections?",
    now: "Collecting instruction patterns and studying how language goals become executable robot behavior.",
    next: "Design clearer task interfaces and test how instruction formats affect transfer and reliability.",
    links: [
      { label: "Research", href: "/research" },
      { label: "Notes", href: "/notes" },
    ],
  },
  {
    slug: "sim-to-real",
    title: "Sim-to-real Generalization",
    question: "How can a policy trained in simulation remain useful when sensors, dynamics, and environments stop matching the simulator?",
    now: "Tracking mismatch sources and reading methods for robust transfer, adaptation, and evaluation.",
    next: "Build small experiments that expose transfer failure modes before scaling to richer robotics settings.",
    links: [
      { label: "Sim-to-real note", href: "/notes/sim-to-real-transfer-gap" },
      { label: "Projects", href: "/projects" },
    ],
  },
  {
    slug: "next-paradigm",
    title: "Next Robotics Paradigm",
    question: "What diagram best explains embodied intelligence after demos stop being enough?",
    now: "Comparing task instruction, generalization, memory, planning, and real-world feedback as one system.",
    next: "Turn scattered notes into a clearer public research map for embodied intelligence.",
    links: [
      { label: "Now", href: "/now" },
      { label: "Library", href: "/library" },
    ],
  },
];
