import {GoldTag} from './GoldTag';

/**
 * The BETA chip (#511): previously duplicated character-for-character between
 * the deck ScoreGauge and HealthSummary. Its look lives in GoldTag, which the
 * release notes' Highlight tag shares.
 */
export function BetaTag({style}: {style?: React.CSSProperties}) {
  return <GoldTag style={style}>Beta</GoldTag>;
}
