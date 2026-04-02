import {FONTS} from '../../../shared/constants';

interface VoteProgressProps {
  voted: number;
  skipped: number;
}

export function VoteProgress({voted, skipped}: VoteProgressProps) {
  return (
    <span
      style={{
        fontSize: 10,
        color: '#90a1b9',
        fontFamily: FONTS.body,
      }}>
      {voted} voted · {skipped} skipped
    </span>
  );
}
