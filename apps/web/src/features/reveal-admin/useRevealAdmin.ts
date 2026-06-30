import {useState} from 'react';
import {
  synergyEngine,
  transformCard,
  type LorcanaCard,
  type SynergyGroup,
} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../shared/contexts/CardDataContext';
import {buildPreviewCard, type RevealCardForm} from './buildPreviewCard';
import {validateRevealCardForm, type ValidationResult} from './validateForm';
import {commitNewCard} from './githubClient';
import {useGithubToken} from './useGithubToken';

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

/** True only when the card is valid, has a token, and an image is fully read. */
function readyToPublish(p: {
  valid: boolean;
  token: string | null;
  imageFile: File | null;
  imageDataUrl: string | null;
}): boolean {
  if (!p.valid) return false;
  if (!p.token) return false;
  if (!p.imageFile) return false;
  if (!p.imageDataUrl) return false;
  return true;
}

export interface RevealAdminController {
  token: string | null;
  setToken: (t: string) => void;
  clearToken: () => void;
  form: RevealCardForm;
  patchForm: (patch: Partial<RevealCardForm>) => void;
  imageName: string | null;
  previewCard: LorcanaCard | null;
  synergyGroups: SynergyGroup[];
  validation: ValidationResult;
  canPublish: boolean;
  publishing: boolean;
  result: {commitUrl: string} | null;
  publishError: string | null;
  onImageChange: (file: File | null) => void;
  publish: () => void;
}

/**
 * Owns all reveal-admin page state and side effects. Keeping it here leaves the
 * page component as mostly-presentational JSX (and well under the complexity gate).
 */
export function useRevealAdmin(): RevealAdminController {
  const {token, setToken, clearToken} = useGithubToken();
  const {cards} = useCardDataContext();
  const [form, setForm] = useState<RevealCardForm>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{commitUrl: string} | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const imageName = imageFile?.name ?? null;
  const existingIds = new Set(cards.map((c) => Number(c.id)));
  const previewCard = buildPreview(form, imageDataUrl);
  const synergyGroups = computeSynergies(previewCard, cards);
  const validation = validateRevealCardForm(form, existingIds, imageName);
  const canPublish = readyToPublish({valid: validation.ok, token, imageFile, imageDataUrl});

  function patchForm(patch: Partial<RevealCardForm>) {
    setForm((f) => ({...f, ...patch}));
  }

  async function onImageChange(file: File | null) {
    setImageFile(file);
    setImageDataUrl(file ? await readAsDataUrl(file) : null);
  }

  async function publish() {
    if (!token) return;
    if (!imageFile) return;
    if (!imageDataUrl) return;
    if (!validation.ok) return;
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

  return {
    token,
    setToken,
    clearToken,
    form,
    patchForm,
    imageName,
    previewCard,
    synergyGroups,
    validation,
    canPublish,
    publishing,
    result,
    publishError,
    onImageChange,
    publish,
  };
}
