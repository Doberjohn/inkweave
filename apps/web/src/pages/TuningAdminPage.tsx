import {COLORS, SPACING, FONT_SIZES} from '../shared/constants';
import {GithubTokenGate} from '../shared/components/GithubTokenGate';
import {CtaButton} from '../shared/components';
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
        <CtaButton
          variant="neutral"
          onClick={clearToken}
          style={{minHeight: 0, padding: '6px 10px', fontSize: FONT_SIZES.sm}}>
          Forget token
        </CtaButton>
      </div>

      <TuningEditor token={token} />
    </main>
  );
}
