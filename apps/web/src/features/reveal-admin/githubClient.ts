import type {LorcanaJSONCard} from 'inkweave-synergy-engine';
import {insertCardIntoPreviewJson} from './insertCardIntoPreviewJson';
import {
  commitFiles,
  readRepoFile,
  stripDataUrl,
  utf8ToBase64,
  type CommitResult,
} from '../../shared/lib/githubCommit';

// Re-export shared helpers so existing importers keep their import site.
export {
  validateToken,
  utf8ToBase64,
  base64ToUtf8,
  type TokenInfo,
  type CommitResult,
} from '../../shared/lib/githubCommit';

const PREVIEW_PATH = 'apps/web/public/data/previewCards.json';
const RAW_DIR = 'apps/web/public/card-images-raw';

/**
 * One atomic commit on master adding the card to previewCards.json and its raw
 * image to card-images-raw/. Re-reads the live file for an authoritative
 * duplicate-id check before committing.
 *
 * The committed raw is a transient CI input, not a permanent artifact: the
 * convert-reveal-images GitHub Action converts it to AVIFs under
 * card-images-preview/ and removes the raw. See issue #420.
 */
export async function commitNewCard(opts: {
  token: string;
  card: LorcanaJSONCard;
  imageBase64: string; // data URL or raw base64
  imageExt: string; // jpg | jpeg | png | webp
}): Promise<CommitResult> {
  const {token, card, imageExt} = opts;
  const imageContent = stripDataUrl(opts.imageBase64);

  const currentText = await readRepoFile(token, PREVIEW_PATH);
  const parsed = JSON.parse(currentText) as {cards: {id: number}[]};
  if (parsed.cards.some((c) => c.id === card.id)) {
    throw new Error(`Card id ${card.id} already exists in previewCards.json`);
  }
  const newText = insertCardIntoPreviewJson(currentText, card);

  return commitFiles({
    token,
    message: `feat(reveals): add ${card.fullName} (${card.setCode}${card.number})`,
    files: [
      {path: PREVIEW_PATH, contentBase64: utf8ToBase64(newText)},
      {path: `${RAW_DIR}/${card.id}.${imageExt}`, contentBase64: imageContent},
    ],
  });
}
