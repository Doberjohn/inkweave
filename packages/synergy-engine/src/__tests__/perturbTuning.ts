// Rewrites every value admin's tuning editor can change, within the editor's own checks (scores
// stay integers 1-10, texts keep their placeholders), before each test file in `test:perturbed`.
// Engine tests read tuned values from TUNING, never as literals, so that run passes like the
// normal one, and the editor's commits to master can't fail the engine suite. (A few web tests
// still name playstyles as the catalog does, #1015.)
import {TUNING} from '../data/tuning';

// One step down (1 goes up to 2), so no score lands on the cap a derived score stops at (the
// Shift activation bonus adds 1, up to 10). Shift has more tiers than there are scores, so some
// stay tied: Shift tests also check each tier's line, which `reword` keeps unique.
const step = (n: number) => (n > 1 ? n - 1 : 2);

const PLACEHOLDERS = /<BASE>|<SHIFT>|\{RAMP\}|\{TRIGGER\}|\{COST\}|\{A\}|\{B\}/g;
let lines = 0;
// A new line in place of the tuned one, so a test that pins any of its wording fails. It keeps the
// line's placeholders, each named twice, so a swap that stops at the first one fails too.
const reword = (text: string) => {
  const kept = text.match(PLACEHOLDERS) ?? [];
  return [`Edited line ${++lines}`, ...kept, ...kept].join(' ');
};

function editShift() {
  for (const tier of Object.values(TUNING.ruleTexts['shift-targets'])) {
    if (tier.score !== undefined) tier.score = step(tier.score);
    if (tier.text) tier.text = reword(tier.text);
  }
}

function editRamp() {
  const ramp = TUNING.ruleTexts.ramp;
  // Each Ramp score moves to the nearest value no other Ramp score holds (lower first), so a test
  // that reads the wrong key fails too, even while tuned scores tie (all three chain shapes do).
  const taken = new Set<number>();
  for (const key of Object.keys(ramp.scores)) {
    const tuned = ramp.scores[key];
    const [edited] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      .filter((n) => n !== tuned && !taken.has(n))
      .sort((a, b) => Math.abs(a - tuned) - Math.abs(b - tuned) || a - b);
    taken.add(edited);
    ramp.scores[key] = edited;
  }
  for (const key of Object.keys(ramp.templates)) ramp.templates[key] = reword(ramp.templates[key]);
}

function editCatalog() {
  for (const p of Object.values(TUNING.playstyles)) {
    Object.assign(p, {name: reword(p.name), tagline: reword(p.tagline)});
  }
  for (const r of Object.values(TUNING.directRules)) {
    Object.assign(r, {name: reword(r.name), description: reword(r.description)});
  }
}

// Vitest runs this file before every test file. Without per-file isolation the files share one
// TUNING, which a second pass would edit again, so it is marked once edited.
const EDITED = Symbol.for('inkweave.editedTuning');
if (!(EDITED in TUNING)) {
  editShift();
  editRamp();
  editCatalog();
  Object.defineProperty(TUNING, EDITED, {value: true});
}
