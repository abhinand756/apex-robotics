export type ChapterKey = "factory" | "assembly" | "ai" | "training" | "testing" | "activation";

export interface Chapter {
  key: ChapterKey;
  num: string;
  name: string;
  range: [number, number];
}

export const CHAPTERS: Chapter[] = [
  { key: "factory", num: "01", name: "FACTORY", range: [0.0, 0.14] },
  { key: "assembly", num: "02", name: "ROBOT ASSEMBLY", range: [0.14, 0.4] },
  { key: "ai", num: "03", name: "AI CORE", range: [0.4, 0.62] },
  { key: "training", num: "04", name: "TRAINING", range: [0.62, 0.78] },
  { key: "testing", num: "05", name: "TESTING", range: [0.78, 0.9] },
  { key: "activation", num: "06", name: "ACTIVATION", range: [0.9, 1.0] },
];

export const T = {
  intro: [0.0, 0.14] as [number, number],
  assembly: [0.14, 0.4] as [number, number],
  ai: [0.4, 0.62] as [number, number],
  training: [0.62, 0.78] as [number, number],
  testing: [0.78, 0.9] as [number, number],
  activation: [0.9, 1.0] as [number, number],
};

export const ASSEMBLY_PARTS = [
  { id: "frame", num: "01", name: "METAL FORMING", from: 0.14, to: 0.205 },
  { id: "actuators", num: "02", name: "SCREW FITTING", from: 0.205, to: 0.27 },
  { id: "sensor", num: "03", name: "PRECISION WELDING", from: 0.27, to: 0.335 },
  { id: "compute", num: "04", name: "LIVE TESTING", from: 0.335, to: 0.4 },
] as const;

export function activeChapter(p: number): Chapter {
  for (const c of CHAPTERS) {
    if (p >= c.range[0] && p < c.range[1]) return c;
  }
  return CHAPTERS[CHAPTERS.length - 1];
}