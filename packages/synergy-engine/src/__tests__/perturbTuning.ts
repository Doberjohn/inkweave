// Rewrites every value admin's tuning editor can change, within the editor's own checks (scores
// stay integers 1-10, texts keep their placeholders), before each test file in `test:perturbed`.
// Engine tests read tuned values from TUNING, never as literals, so that run passes like the
// normal one, and the editor's commits to master can't fail CI.
import {TUNING} from '../data/tuning';

// One step down (1 goes up to 2), so no score lands on the cap a derived score stops at (the
// Shift activation bonus adds 1, up to 10).
const step = (n: number) => (n > 1 ? n - 1 : 2);

for (const tier of Object.values(TUNING.ruleTexts['shift-targets'])) {
  if (tier.score !== undefined) tier.score = step(tier.score);
  if (tier.text) tier.text = `${tier.text} (edited)`;
}
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
for (const key of Object.keys(ramp.templates))
  ramp.templates[key] = `${ramp.templates[key]} (edited)`;
for (const p of Object.values(TUNING.playstyles)) {
  Object.assign(p, {name: `${p.name} (edited)`, tagline: `${p.tagline} (edited)`});
}
for (const r of Object.values(TUNING.directRules)) {
  Object.assign(r, {name: `${r.name} (edited)`, description: `${r.description} (edited)`});
}
