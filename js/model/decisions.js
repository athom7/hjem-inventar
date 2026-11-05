// The five decisions an item can have. Defined once; the UI, stats, export and parser all read from here.
// Order matters: it is the order of buttons in triage and of segments in the distribution bar.

export const DECISIONS = [
  {
    id: 'keep',
    labelDa: 'Behold',
    hintDa: 'Skal med, når vi flytter.',
  },
  {
    id: 'trash',
    labelDa: 'Smid ud',
    hintDa: 'Genbrugspladsen eller skraldespanden.',
  },
  {
    id: 'donate',
    labelDa: 'Donér',
    hintDa: 'Genbrugsbutik, venner eller familie.',
  },
  {
    id: 'sell',
    labelDa: 'Sælg',
    hintDa: 'Sættes til salg online eller på loppemarked.',
  },
  {
    id: 'undecided',
    labelDa: 'Afgør senere',
    hintDa: 'Ikke besluttet endnu.',
  },
];

export const DECISION_IDS = DECISIONS.map((d) => d.id);
export const DECIDED_IDS = DECISION_IDS.filter((id) => id !== 'undecided');
export const DECISION_BY_ID = Object.fromEntries(DECISIONS.map((d) => [d.id, d]));

export const isDecision = (id) => Object.hasOwn(DECISION_BY_ID, id);
export const labelOf = (id) => DECISION_BY_ID[id]?.labelDa ?? id;
