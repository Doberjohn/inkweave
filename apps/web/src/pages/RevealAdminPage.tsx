import {useState} from 'react';
import {
  synergyEngine,
  transformCard,
  type LorcanaCard,
  type SynergyGroup,
} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../shared/constants';
import {
  buildPreviewCard,
  validateRevealCardForm,
  commitNewCard,
  validateToken,
  useGithubToken,
  RevealAdminForm,
  CardPreviewPanel,
  SynergyPreviewPanel,
  type RevealCardForm,
} from '../features/reveal-admin';

const EMPTY_FORM: RevealCardForm = {
  collectorNumber: '',
  name: '',
  version: '',
  rarity: '',
  franchise: '',
  cost: '',
  ink: 'Amber',
  ink2: '',
  inkwell: true,
  type: 'Character',
  strength: '',
  willpower: '',
  lore: '',
  moveCost: '',
  subtypes: '',
  keywords: '',
  fullText: '',
};

/** Read an uploaded image File as a base64 data URL (for preview + GitHub blob). */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Build the live preview card from form values; null until ink/type are valid. */
function buildPreview(form: RevealCardForm, imageDataUrl: string | null): LorcanaCard | null {
  const transformed = transformCard(buildPreviewCard(form));
  if (!transformed) return null;
  if (imageDataUrl) transformed.imageUrl = imageDataUrl;
  return transformed;
}

/** Run the engine against the in-progress card; empty on no card or engine error. */
function computeSynergies(card: LorcanaCard | null, allCards: LorcanaCard[]): SynergyGroup[] {
  if (!card) return [];
  try {
    return synergyEngine.findSynergies(card, allCards);
  } catch {
    return [];
  }
}

function TokenGate({onSave}: {onSave: (token: string) => void}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setError(null);
    const info = await validateToken(value.trim());
    setBusy(false);
    if (info.ok && info.canPush) {
      onSave(value.trim());
    } else {
      setError(info.error ?? 'Token validation failed');
    }
  }

  return (
    <div style={{maxWidth: 460, margin: '0 auto', padding: SPACING.lg, color: COLORS.text}}>
      <h1 style={{fontSize: FONT_SIZES.xl}}>Reveal admin</h1>
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

export function RevealAdminPage() {
  const {token, setToken, clearToken} = useGithubToken();
  const {cards} = useCardDataContext();
  const [form, setForm] = useState<RevealCardForm>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{commitUrl: string} | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  if (!token) {
    return <TokenGate onSave={setToken} />;
  }

  const existingIds = new Set(cards.map((c) => Number(c.id)));
  const previewCard = buildPreview(form, imageDataUrl);
  const synergyGroups = computeSynergies(previewCard, cards);
  const validation = validateRevealCardForm(form, existingIds, imageFile?.name ?? null);

  async function onImageChange(file: File | null) {
    setImageFile(file);
    setImageDataUrl(file ? await readAsDataUrl(file) : null);
  }

  async function publish() {
    if (!validation.ok || !imageDataUrl || !imageFile || !token) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const card = buildPreviewCard(form);
      const ext = (imageFile.name.split('.').pop() ?? 'png').toLowerCase();
      const res = await commitNewCard({token, card, imageBase64: imageDataUrl, imageExt: ext});
      setResult(res);
      setForm(EMPTY_FORM);
      setImageFile(null);
      setImageDataUrl(null);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main style={{maxWidth: 1000, margin: '0 auto', padding: SPACING.lg, color: COLORS.text}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1 style={{fontSize: FONT_SIZES.xl}}>Add a reveal card</h1>
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

      {result && (
        <div
          role="status"
          style={{
            margin: `${SPACING.md}px 0`,
            padding: SPACING.md,
            background: COLORS.surfaceAlt,
            borderRadius: RADIUS.sm,
          }}>
          Committed. Vercel is deploying (~2-3 min).{' '}
          <a href={result.commitUrl} target="_blank" rel="noreferrer" style={{color: COLORS.primary500}}>
            View commit
          </a>
        </div>
      )}

      <div style={{display: 'flex', gap: SPACING.xl, flexWrap: 'wrap'}}>
        <section style={{flex: '1 1 380px', minWidth: 320}}>
          <RevealAdminForm
            form={form}
            errors={validation.errors}
            imageName={imageFile?.name ?? null}
            onChange={(patch) => setForm((f) => ({...f, ...patch}))}
            onImageChange={onImageChange}
          />
          {publishError && (
            <div style={{color: COLORS.error, fontSize: FONT_SIZES.sm}}>{publishError}</div>
          )}
          <button
            onClick={publish}
            disabled={!validation.ok || publishing}
            style={{
              marginTop: SPACING.md,
              padding: '12px 20px',
              background: validation.ok ? COLORS.primary500 : COLORS.surfaceHover,
              color: COLORS.white,
              border: 'none',
              borderRadius: RADIUS.sm,
              cursor: validation.ok ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}>
            {publishing ? 'Publishing…' : 'Publish to master'}
          </button>
        </section>

        <aside
          style={{
            flex: '1 1 280px',
            minWidth: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.lg,
          }}>
          <div>
            <h2 style={{fontSize: FONT_SIZES.md}}>Preview</h2>
            <CardPreviewPanel card={previewCard} />
          </div>
          <div>
            <h2 style={{fontSize: FONT_SIZES.md}}>Synergies</h2>
            <SynergyPreviewPanel groups={synergyGroups} />
          </div>
        </aside>
      </div>
    </main>
  );
}
