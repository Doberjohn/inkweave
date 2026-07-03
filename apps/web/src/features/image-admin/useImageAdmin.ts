import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../shared/contexts/CardDataContext';
import {useGithubToken} from '../../shared/hooks/useGithubToken';
import {commitCardImage, type ImageAdminCard} from './githubClient';
import type {CommitResult} from '../../shared/lib/githubCommit';

const VALID_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);

/** Read an uploaded image File as a base64 data URL (preview + GitHub blob). */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function extOf(name: string): string {
  return (name.split('.').pop() ?? '').toLowerCase();
}

interface PublishPayload {
  token: string;
  card: ImageAdminCard;
  imageBase64: string;
  imageExt: string;
}

/**
 * Collapse the publish preconditions into a ready-to-commit payload, or null if
 * anything is missing. Single-condition guards keep this out of "complex
 * conditional" territory and give the caller clean type-narrowing.
 */
function toPublishPayload(inputs: {
  token: string | null;
  selectedCard: LorcanaCard | null;
  imageFile: File | null;
  newImageUrl: string | null;
}): PublishPayload | null {
  const {token, selectedCard, imageFile, newImageUrl} = inputs;
  if (!token || !selectedCard) return null;
  if (!imageFile || !newImageUrl) return null;
  const imageExt = extOf(imageFile.name);
  if (!VALID_EXT.has(imageExt)) return null;
  return {token, card: selectedCard, imageBase64: newImageUrl, imageExt};
}

export interface ImageAdminController {
  token: string | null;
  setToken: (t: string) => void;
  clearToken: () => void;
  cards: LorcanaCard[];
  selectedCard: LorcanaCard | null;
  selectCard: (card: LorcanaCard) => void;
  imageName: string | null;
  newImageUrl: string | null;
  onImageChange: (file: File | null) => void;
  canPublish: boolean;
  publishing: boolean;
  result: CommitResult | null;
  publishError: string | null;
  publish: () => void;
}

export function useImageAdmin(): ImageAdminController {
  const {token, setToken, clearToken} = useGithubToken();
  const {cards} = useCardDataContext();
  const [selectedCard, setSelectedCard] = useState<LorcanaCard | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const imageName = imageFile?.name ?? null;
  const publishPayload = toPublishPayload({token, selectedCard, imageFile, newImageUrl});
  const canPublish = publishPayload !== null;

  function selectCard(card: LorcanaCard) {
    setSelectedCard(card);
    setResult(null);
    setPublishError(null);
  }

  async function onImageChange(file: File | null) {
    setImageFile(file);
    setNewImageUrl(file ? await readAsDataUrl(file) : null);
  }

  async function publish() {
    if (!publishPayload) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await commitCardImage(publishPayload);
      setResult(res);
      setSelectedCard(null);
      setImageFile(null);
      setNewImageUrl(null);
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
    cards,
    selectedCard,
    selectCard,
    imageName,
    newImageUrl,
    onImageChange,
    canPublish,
    publishing,
    result,
    publishError,
    publish,
  };
}
