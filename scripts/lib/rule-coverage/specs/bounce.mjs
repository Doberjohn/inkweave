import {countWithNames, pairsAndScores, poolLine, section} from '../blocks.mjs';
import {fmt, pct, table} from '../render.mjs';
import {byName, holders, pairOf} from '../stats.mjs';

const ROLES = ['self-bounce', 'flexible', 'opponent-bounce', 'return-payoff', 'rebuy-payoff'];
const ENABLERS = ['self-bounce', 'flexible'];

const bounceRoles = (coverage) => coverage.roles(coverage.engine.getBounceRoles, ROLES);

/** "cap 2", "Seven Dwarfs", or both. */
const gateText = ({costCap, classification}) =>
  [costCap === null ? null : `cap ${costCap}`, classification].filter(Boolean).join(', ');

const gated = (gate) => gate.costCap !== null || gate.classification !== null;

/** Every enabler → re-buy body reading that could share a deck, with the enabler's gate. */
function* readings(engine, roles) {
  for (const enabler of holders(roles, ENABLERS)) {
    const gate = engine.getBounceTargetGate(enabler);
    for (const body of roles.get('rebuy-payoff')) {
      if (body !== enabler && engine.canShareDeck(enabler, body)) yield {enabler, gate, body};
    }
  }
}

/** Whether the gate names a classification the body lacks. */
const failsClassGate = (engine, gate, body) =>
  gate.classification !== null && !engine.hasClassification(body, gate.classification);

/** A pair's verdict before any reading: not admitted, no class gate, no losing bodies. */
const freshVerdict = () => ({admitted: false, classGate: false, bodies: new Set()});

/** Records one reading on its pair's verdict: admitted, or rejected and by which gate. */
function judge(verdict, engine, {gate, body}) {
  if (engine.bounceGateAdmits(gate, body)) {
    verdict.admitted = true;
    return;
  }
  verdict.bodies.add(body);
  if (failsClassGate(engine, gate, body)) verdict.classGate = true;
}

/**
 * Every enabler → re-buy body reading that could share a deck, judged by the enabler's target
 * gate: what the rule would pair without the gates, and why the gates drop the rest.
 */
function gateStudy(coverage, roles) {
  const {engine} = coverage;
  const verdicts = new Map();
  for (const reading of readings(engine, roles)) {
    const {key} = pairOf(reading.enabler, reading.body);
    if (!verdicts.has(key)) verdicts.set(key, freshVerdict());
    judge(verdicts.get(key), engine, reading);
  }
  const rejected = [...verdicts.values()].filter((verdict) => !verdict.admitted);
  return {
    qualifying: verdicts.size,
    rejected: rejected.length,
    byClass: rejected.filter((verdict) => verdict.classGate).length,
    losers: new Set(rejected.flatMap((verdict) => [...verdict.bodies])),
  };
}

export default {
  doc: 'BOUNCE_RULE.md',
  blocks: {
    'gated-enablers': (coverage) => {
      const roles = bounceRoles(coverage);
      const enablers = holders(roles, ENABLERS);
      const partners = coverage.partners('bounce');
      const rows = enablers
        .map((card) => ({card, gate: coverage.engine.getBounceTargetGate(card)}))
        .filter(({gate}) => gated(gate))
        .sort(
          (a, b) =>
            (a.gate.costCap ?? Infinity) - (b.gate.costCap ?? Infinity) || byName(a.card, b.card),
        )
        .map(({card, gate}) => {
          const ids = [...(partners.get(card.id) ?? [])];
          return [
            card.fullName,
            gateText(gate),
            countWithNames(ids.map(coverage.card).sort(byName), 3),
          ];
        });
      return section(
        `Gated enablers in the pool: **${fmt(rows.length)} of ${fmt(enablers.length)}**.`,
        table(['Gated enabler', 'Gate', 'Bounce partners'], rows),
      );
    },
    coverage: (coverage) => {
      const roles = bounceRoles(coverage);
      const counts = ROLES.map((role) => `${role} ${fmt(roles.get(role).length)}`).join(', ');
      const study = gateStudy(coverage, roles);
      const bodies = roles.get('rebuy-payoff').length;
      return section(
        poolLine(coverage),
        `- **Roles**: ${counts}; **${fmt(holders(roles).length)} participating cards**.\n` +
          `- ${fmt(coverage.partners('bounce').size)} cards carry a Bounce group.\n` +
          `- Without the target gates, ${fmt(study.qualifying)} enabler and re-buy pairs would qualify, ` +
          `and ${fmt(study.rejected)} of them (${pct(study.rejected, study.qualifying)}) are legally ` +
          `impossible: ${fmt(study.rejected - study.byClass)} fall to cost caps, ${fmt(study.byClass)} to ` +
          `a classification gate. ${fmt(study.losers.size)} of the ${fmt(bodies)} re-buy bodies lose ` +
          'at least one pair.',
        pairsAndScores(coverage.pairs('bounce')),
      );
    },
  },
};
