// Geometry for rooms marked on a floor plan. All rectangles are in plan coordinates: 0..1 of the image's
// width and height, so a marking fits the plan on any screen size. Pure functions, no DOM.

export const MIN_SIDE = 0.02; // 2 % of the plan: smaller than this is a mis-tap, not a room

const clamp01 = (v) => Math.min(Math.max(Number(v) || 0, 0), 1);
const round = (v) => Math.round(v * 10000) / 10000;

// Screen position → plan coordinates, given the plan's on-screen box (as from getBoundingClientRect()).
export function toPlanPoint(clientX, clientY, box) {
  return {
    x: clamp01((clientX - box.left) / box.width),
    y: clamp01((clientY - box.top) / box.height),
  };
}

// Two corners in any order (drag up-left as well as down-right) → { x, y, w, h } inside the plan.
export function rectFromPoints(a, b) {
  const x1 = clamp01(Math.min(a.x, b.x));
  const y1 = clamp01(Math.min(a.y, b.y));
  const x2 = clamp01(Math.max(a.x, b.x));
  const y2 = clamp01(Math.max(a.y, b.y));
  return { x: round(x1), y: round(y1), w: round(x2 - x1), h: round(y2 - y1) };
}

// Repairs a stored rectangle (e.g. from an imported file) so it lies inside the plan.
export function clampRect(r) {
  const x = clamp01(r?.x);
  const y = clamp01(r?.y);
  return { x: round(x), y: round(y), w: round(Math.min(clamp01(r?.w), 1 - x)), h: round(Math.min(clamp01(r?.h), 1 - y)) };
}

export const isUsableRect = (r) => r.w >= MIN_SIDE && r.h >= MIN_SIDE;

// Where to put a room's label: the centre of its largest area (an L-shaped room has two).
export function labelAnchor(areas) {
  if (!areas.length) return null;
  const big = areas.reduce((best, a) => (a.w * a.h > best.w * best.h ? a : best));
  return { x: round(big.x + big.w / 2), y: round(big.y + big.h / 2) };
}

// Index of the area under a point, searching the last drawn first (it is on top). -1 if none.
export function areaAt(areas, p) {
  for (let i = areas.length - 1; i >= 0; i--) {
    const a = areas[i];
    if (p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h) return i;
  }
  return -1;
}
