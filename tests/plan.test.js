// Geometry for marking rooms on the floor plan (plan coordinates 0..1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPlanPoint, rectFromPoints, clampRect, isUsableRect, labelAnchor, areaAt } from '../js/model/plan.js';

test('screen position → plan coordinates, clamped to the plan', () => {
  const box = { left: 10, top: 20, width: 200, height: 100 };
  assert.deepEqual(toPlanPoint(110, 70, box), { x: 0.5, y: 0.5 });
  assert.deepEqual(toPlanPoint(-50, 500, box), { x: 0, y: 1 });
});

test('a rectangle can be dragged in any direction', () => {
  const r = { x: 0.2, y: 0.1, w: 0.3, h: 0.4 };
  assert.deepEqual(rectFromPoints({ x: 0.2, y: 0.1 }, { x: 0.5, y: 0.5 }), r);
  assert.deepEqual(rectFromPoints({ x: 0.5, y: 0.5 }, { x: 0.2, y: 0.1 }), r);
  assert.deepEqual(rectFromPoints({ x: 0.5, y: 0.1 }, { x: 0.2, y: 0.5 }), r);
});

test('stored rectangles are kept inside the plan; mis-taps are not rooms', () => {
  assert.deepEqual(clampRect({ x: 0.8, y: -1, w: 0.5, h: 2 }), { x: 0.8, y: 0, w: 0.2, h: 1 });
  assert.deepEqual(clampRect({}), { x: 0, y: 0, w: 0, h: 0 });
  assert.equal(isUsableRect({ x: 0, y: 0, w: 0.01, h: 0.5 }), false);
  assert.equal(isUsableRect({ x: 0, y: 0, w: 0.05, h: 0.05 }), true);
});

test('the label sits in the largest part of an L-shaped room', () => {
  assert.equal(labelAnchor([]), null);
  assert.deepEqual(labelAnchor([{ x: 0, y: 0, w: 0.1, h: 0.1 }, { x: 0.2, y: 0.2, w: 0.4, h: 0.2 }]), { x: 0.4, y: 0.3, maxW: 0.4 });
});

test('the area under a point, top-most first', () => {
  const areas = [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }];
  assert.equal(areaAt(areas, { x: 0.3, y: 0.3 }), 1);
  assert.equal(areaAt(areas, { x: 0.1, y: 0.1 }), 0);
  assert.equal(areaAt(areas, { x: 0.9, y: 0.1 }), -1);
});
