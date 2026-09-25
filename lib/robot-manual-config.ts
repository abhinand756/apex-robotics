// Manually editable manufacturing config — edit here without touching canvas math
// Geometry in SVG viewBox units (100x100 centered at feet 50,95) — bigger & modern

export const MANUAL_STAGES = [
  { id: "legs", label: "METAL FORMING", from: 0.14, to: 0.186, color: "#2b3c4f" },
  { id: "torso", label: "SCREW FITTING", from: 0.172, to: 0.206, color: "#263548" },
  { id: "arms", label: "PRECISION WELDING", from: 0.20, to: 0.252, color: "#1e2e42" },
  { id: "head", label: "SENSOR FIT", from: 0.248, to: 0.304, color: "#2a3d55" },
  { id: "core", label: "CORE", from: 0.30, to: 0.34, color: "#1a2636" },
  { id: "visor", label: "VISOR", from: 0.35, to: 0.40, color: "#0f1a26" },
] as const;

export type ManualPartId = (typeof MANUAL_STAGES)[number]["id"];

// EDIT ROBOT GEOMETRY — bigger, modern proportions
export const ROBOT_GEOMETRY = {
  viewBox: "0 0 100 100",
  hipY: 60, // raised for bigger torso
  hipX: 11,
  thighLen: 15,
  shinLen: 13,
  footW: 14,
  torsoW: 38, // wider chest
  torsoH: 32, // taller chest
  headW: 26,
  headH: 20,
  visorW: 18,
  visorH: 5,
  jointR: 2.6,
  shoulderW: 13,
} as const;
