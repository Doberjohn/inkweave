import type {PairSynergyConnection} from 'inkweave-synergy-engine';
import {getPlaystyleById} from 'inkweave-synergy-engine';

/** Aggregated rule grouping for the synergy detail modal. */
export interface ConnectionGroupData {
  key: string;
  label: string;
  score: number;
  connections: PairSynergyConnection[];
  category: 'direct' | 'playstyle';
}

/**
 * Group raw pair connections for display: direct rules stay as their own group,
 * playstyle rules merge by `playstyleId`. Sorted by score descending.
 */
export function groupConnections(connections: PairSynergyConnection[]): ConnectionGroupData[] {
  const playstyleGroups = new Map<string, PairSynergyConnection[]>();
  const result: ConnectionGroupData[] = [];

  for (const conn of connections) {
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
