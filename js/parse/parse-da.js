// Dictated Danish text → items. "Jeg ser en sofa, to lamper og en kasse med gamle kabler. Printeren skal smides ud."
// becomes Sofa ×1, Lamper ×2, Kasse med gamle kabler ×1, Printeren ×1 (Smid ud).
//
// Deliberately simple and predictable: the user checks the result in a preview before saving, so a wrong split
// costs one tap. Splits on commas, full stops, line breaks, " og ", " samt ", " plus " – never on "med".

const NUMBER_WORDS = {
  en: 1, et: 1, 'én': 1, 'ét': 1, to: 2, tre: 3, fire: 4, fem: 5, seks: 6, syv: 7, otte: 8, ni: 9, ti: 10, elleve: 11, tolv: 12,
};

// "en masse bøger", "en del kabler": the quantity word is part of the description, not a count.
const VAGUE_AFTER_EN = /^(?:en|et)\s+(?:masse|del|hel\s+del|bunke|stak|sjat)\b/i;

// Spoken lead-ins that are not part of the item: "jeg ser", "der står", "og så ligger der" …
const LEAD_IN = new RegExp(
  '^(?:(?:og|så|også|samt|plus|men)\\s+)*' +
  '(?:(?:jeg|vi)\\s+(?:ser|kan\\s+se|har)|der\\s+(?:er|står|ligger|hænger)|her\\s+(?:er|står|ligger|hænger)|' +
  '(?:står|ligger|hænger)\\s+der|er\\s+der)?\\s*(?:(?:også|så)\\s+)?',
  'i',
);

// A decision said at the end of an item, also as a clause ("… der skal med"). Checked in order; first match wins.
const DECISION_SUFFIXES = [
  ['trash', /\s*[-–:]?\s*(?:(?:som|der)\s+)?(?:skal\s+)?(?:smides\s+ud|smid\s+ud|smides|kasseres|ud|i\s+skraldespanden|på\s+genbrugspladsen)$/i],
  ['donate', /\s*[-–:]?\s*(?:(?:som|der)\s+)?(?:skal\s+)?(?:doneres|donér|doner|gives\s+væk|til\s+genbrug)$/i],
  ['sell', /\s*[-–:]?\s*(?:(?:som|der)\s+)?(?:skal\s+)?(?:sælges|sælg|på\s+dba|til\s+salg)$/i],
  ['keep', /\s*[-–:]?\s*(?:(?:som|der)\s+)?(?:skal\s+)?(?:beholdes|behold|med|med\s+i\s+flytningen)$/i],
];

// "skal med" must only count as a decision when "skal" is there – "kasse med" is a description.
const KEEP_NEEDS_SKAL = /(?:^|\s)med(?:\s+i\s+flytningen)?$/i;
const HAS_SKAL = /\bskal\s+med(?:\s+i\s+flytningen)?$/i;
// Likewise "ud" alone is too loose ("gardiner ud mod gaden"); require "skal ud".
const TRASH_BARE_UD = /(?:^|\s)ud$/i;
const HAS_SKAL_UD = /\b(?:skal|smid|smides)\s+ud$/i;

export function splitSegments(text) {
  return String(text ?? '')
    .replace(/\r/g, '')
    .split(/[,;\n]+|(?<!\b(?:stk|ca|fx|evt|inkl))\.(?=\s|$)|\s+(?:og|samt|plus)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function takeDecision(segment) {
  for (const [decision, re] of DECISION_SUFFIXES) {
    if (!re.test(segment)) continue;
    if (decision === 'keep' && KEEP_NEEDS_SKAL.test(segment) && !HAS_SKAL.test(segment) && !/beholdes|behold$/i.test(segment)) continue;
    if (decision === 'trash' && TRASH_BARE_UD.test(segment) && !HAS_SKAL_UD.test(segment)) continue;
    return { rest: segment.replace(re, '').trim(), decision };
  }
  return { rest: segment, decision: undefined };
}

function takeQuantity(segment) {
  if (VAGUE_AFTER_EN.test(segment)) return { rest: segment, qty: 1 };
  const digits = segment.match(/^(\d{1,4})(?:\s*(?:stk\.?|x|×))?\s+(.+)$/i);
  if (digits) return { rest: digits[2], qty: Number(digits[1]) };
  const word = segment.match(/^(\S+)\s+(.+)$/);
  if (word && Object.hasOwn(NUMBER_WORDS, word[1].toLowerCase())) return { rest: word[2], qty: NUMBER_WORDS[word[1].toLowerCase()] };
  return { rest: segment, qty: 1 };
}

const capitalize = (s) => s.charAt(0).toLocaleUpperCase('da-DK') + s.slice(1);

export function parseItem(segment) {
  let s = segment.replace(LEAD_IN, '').trim();
  const { rest: withoutDecision, decision } = takeDecision(s);
  s = withoutDecision.replace(LEAD_IN, '').trim();
  const { rest, qty } = takeQuantity(s);
  const name = rest.replace(/^[\s\-–:]+|[\s.,!?\-–:]+$/g, '').trim();
  if (!name) return null;
  const item = { name: capitalize(name), qty };
  if (decision) item.decision = decision;
  return item;
}

export function parseDa(text) {
  return splitSegments(text).map(parseItem).filter(Boolean);
}
