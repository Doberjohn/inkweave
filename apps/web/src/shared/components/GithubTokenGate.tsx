import {useState} from 'react';
import {validateToken} from '../lib/githubCommit';
import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../constants';

interface GithubTokenGateProps {
  title: string;
  onSave: (token: string) => void;
}

export function GithubTokenGate({title, onSave}: GithubTokenGateProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setError(null);
    const info = await validateToken(value.trim());
    setBusy(false);
    if (info.ok && info.canPush) onSave(value.trim());
    else setError(info.error ?? 'Token validation failed');
  }

  return (
    <div style={{maxWidth: 460, margin: '0 auto', padding: SPACING.lg, color: COLORS.text}}>
      <h1 style={{fontSize: FONT_SIZES.xxl}}>{title}</h1>
      <p style={{color: COLORS.gray600, fontSize: FONT_SIZES.sm}}>
        Paste a GitHub fine-grained token scoped to <code>Doberjohn/inkweave</code> with Contents:
        read and write.
      </p>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="github_pat_..."
        aria-label="GitHub token"
        style={{
          width: '100%',
          padding: '10px',
          background: COLORS.surfaceAlt,
          color: COLORS.text,
          border: `1px solid ${COLORS.surfaceHover}`,
          borderRadius: RADIUS.sm,
        }}
      />
      {error && (
        <div style={{color: COLORS.error, fontSize: FONT_SIZES.sm, marginTop: SPACING.xs}}>{error}</div>
      )}
      <button
        onClick={check}
        disabled={busy || !value.trim()}
        style={{
          marginTop: SPACING.sm,
          padding: '10px 16px',
          background: COLORS.primary500,
          color: COLORS.white,
          border: 'none',
          borderRadius: RADIUS.sm,
          cursor: 'pointer',
        }}>
        {busy ? 'Checking…' : 'Save token'}
      </button>
    </div>
  );
}
