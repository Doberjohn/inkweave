import type {LocationRole, PairSynergyConnection, PlaystyleId} from 'inkweave-synergy-engine';
import type {ConnectionGroupData, LabelledConnection} from 'inkweave-ui/lorcana/ConnectionGroup';
import {LOCATION_ROLE_CHIP_LABELS, getPlaystyleById} from '../../features/synergies/engineCatalog';

function extractLocationRole(ruleId: string): LocationRole | null {
  const prefix = 'location-';
  if (!ruleId.startsWith(prefix)) return null;
  const candidate = ruleId.slice(prefix.length);
  if (candidate in LOCATION_ROLE_CHIP_LABELS) return candidate as LocationRole;
  return null;
}

/** A connection with the words ConnectionGroup shows for it: a location role's chip label, else the rule's name. */
function labelled(conn: PairSynergyConnection): LabelledConnection {
  const role = extractLocationRole(conn.ruleId);
  return {...conn, roleLabel: role ? LOCATION_ROLE_CHIP_LABELS[role] : conn.ruleName};
}

/**
 * Group raw pair connections for display: direct rules stay as their own group,
 * playstyle rules merge by `playstyleId`. Sorted by score descending.
 */
export function groupConnections(connections: PairSynergyConnection[]): ConnectionGroupData[] {
  const playstyleGroups = new Map<PlaystyleId, LabelledConnection[]>();
  const result: ConnectionGroupData[] = [];

  for (const conn of connections.map(labelled)) {
    if (conn.category === 'playstyle') {
      const existing = playstyleGroups.get(conn.playstyleId);
      if (existing) {
        existing.push(conn);
      } else {
        playstyleGroups.set(conn.playstyleId, [conn]);
      }
    } else {
      result.push({
        key: conn.ruleId,
        label: conn.ruleName,
        score: conn.score,
        connections: [conn],
        category: 'direct',
      });
    }
  }

  for (const [playstyleId, conns] of playstyleGroups) {
    const playstyle = getPlaystyleById(playstyleId);
    const maxScore = Math.max(...conns.map((c) => c.score));
    result.push({
      key: playstyleId,
      label: playstyle?.name ?? playstyleId,
      score: maxScore,
      connections: conns,
      category: 'playstyle',
    });
  }

  return result.sort((a, b) => b.score - a.score);
}
