import {FONTS} from '../../../shared/constants';

type BannerType = 'rate_limited' | 'unavailable' | 'error';

interface VoteStatusBannerProps {
  type: BannerType;
  onRetry?: () => void;
}

const MESSAGES: Record<BannerType, string> = {
  rate_limited: "You've reached the voting limit (200 per day). Come back soon!",
  unavailable: 'Voting is currently unavailable. You can still browse pairs.',
  error: 'Something went wrong submitting your vote.',
};

const COLORS_MAP: Record<BannerType, {bg: string; border: string; text: string}> = {
  rate_limited: {bg: '#3d3010', border: '#fbbf24', text: '#fbbf24'},
  unavailable: {bg: '#10253d', border: '#60b5f5', text: '#60b5f5'},
  error: {bg: '#3d1a1a', border: '#f59090', text: '#f59090'},
};

export function VoteStatusBanner({type, onRetry}: VoteStatusBannerProps) {
  const colors = COLORS_MAP[type];

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '10px 16px',
        borderRadius: 8,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        width: '100%',
        boxSizing: 'border-box',
      }}>
      <span style={{fontSize: 13, color: colors.text, fontFamily: FONTS.body}}>
        {MESSAGES[type]}
      </span>
      {type === 'error' && onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: `1px solid ${colors.border}`,
            background: 'transparent',
            color: colors.text,
            fontSize: 13,
            fontFamily: FONTS.body,
            cursor: 'pointer',
            flexShrink: 0,
          }}>
          Retry
        </button>
      )}
    </div>
  );
}
