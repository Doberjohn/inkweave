import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../shared/constants';
import {GithubTokenGate} from '../shared/components/GithubTokenGate';
import {useGithubToken} from '../shared/hooks/useGithubToken';
import {TuningEditor} from '../features/tuning-admin';

export function TuningAdminPage() {
  const {token, setToken, clearToken} = useGithubToken();

  if (!token) {
    return <GithubTokenGate title="Tuning admin" onSave={setToken} />;
  }

  return (
    <main style={{maxWidth: 1000, margin: '0 auto', padding: SPACING.lg, color: COLORS.text}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1 style={{fontSize: FONT_SIZES.xxl}}>Tuning editor</h1>
        <button
          onClick={clearToken}
          style={{
            background: 'none',
            border: `1px solid ${COLORS.surfaceHover}`,
            color: COLORS.gray600,
            borderRadius: RADIUS.sm,
            padding: '6px 10px',
            cursor: 'pointer',
          }}>
          Forget token
        </button>
      </div>

      <TuningEditor token={token} />
    </main>
  );
}
