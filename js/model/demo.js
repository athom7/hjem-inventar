// A fictional example home, so the app can be tried without typing anything in. Matches demo/eksempel-plan.svg
// (1000 × 700). Rooms cover every state: done (Bad, Køkken, Værelse), open (Stue, Soveværelse, Entré), empty (Bryggers).

import { addFloor, addRoom, addArea, addItems } from './inventory.js';

export const DEMO_PLAN_URL = './demo/eksempel-plan.svg';
export const DEMO_ASPECT = 0.7;

const px = (x1, y1, x2, y2) => ({ x: x1 / 1000, y: y1 / 700, w: (x2 - x1) / 1000, h: (y2 - y1) / 700 });

export const DEMO_ROOMS = [
  {
    name: 'Stue',
    areas: [px(360, 330, 800, 680), px(800, 480, 980, 680)], // L-shaped
    items: [
      { name: 'Sofa', decision: 'keep' },
      { name: 'Sofabord', decision: 'sell' },
      { name: 'Lamper', qty: 2 },
      { name: 'Bogreol', decision: 'keep' },
      { name: "Kasse med gamle dvd'er", decision: 'donate' },
      { name: 'Fjernsyn', decision: 'keep' },
    ],
  },
  {
    name: 'Køkken',
    areas: [px(20, 330, 360, 680)],
    items: [
      { name: 'Kaffemaskine', decision: 'keep' },
      { name: 'Kasse med plastikbøtter', decision: 'trash' },
      { name: 'Gammel brødrister', decision: 'trash' },
      { name: 'Spisebord', decision: 'keep' },
      { name: 'Stole', qty: 6, decision: 'sell' },
    ],
  },
  {
    name: 'Soveværelse',
    areas: [px(20, 20, 360, 330)],
    items: [
      { name: 'Dobbeltseng', decision: 'keep' },
      { name: 'Kommode' },
      { name: 'Natborde', qty: 2, decision: 'keep' },
      { name: 'Kasse med gammelt tøj', decision: 'donate' },
    ],
  },
  {
    name: 'Værelse',
    areas: [px(360, 20, 620, 330)],
    items: [
      { name: 'Skrivebord', decision: 'keep' },
      { name: 'Kontorstol', decision: 'sell' },
      { name: 'Kasse med kabler', decision: 'trash' },
      { name: 'Printer', decision: 'trash' },
    ],
  },
  {
    name: 'Bad',
    areas: [px(620, 20, 800, 330)],
    items: [
      { name: 'Vasketøjskurv', decision: 'keep' },
      { name: 'Badevægt', decision: 'keep' },
    ],
  },
  {
    name: 'Entré',
    areas: [px(800, 20, 980, 330)],
    items: [
      { name: 'Skoreol' },
      { name: 'Paraplyer', qty: 3, decision: 'donate' },
    ],
  },
  { name: 'Bryggers', areas: [px(800, 330, 980, 480)], items: [] },
];

// Adds the example floor with its rooms and items to `doc`. The caller stores the image under `imageId`.
export function addDemo(doc, imageId) {
  const floor = addFloor(doc, { name: 'Eksempel-bolig', imageId, aspect: DEMO_ASPECT });
  for (const def of DEMO_ROOMS) {
    const room = addRoom(doc, { name: def.name, floorId: floor.id });
    for (const a of def.areas) addArea(doc, room.id, a);
    addItems(doc, room.id, def.items);
  }
  return floor;
}
