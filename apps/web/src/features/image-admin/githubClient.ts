import type {LorcanaCard} from 'inkweave-synergy-engine';
import {commitFiles, stripDataUrl, type CommitResult} from '../../shared/lib/githubCommit';

const RAW_DIR = 'apps/web/public/card-images-raw';

/** The card identity fields the commit needs (a subset of LorcanaCard). */
export type ImageAdminCard = Pick<LorcanaCard, 'id' | 'fullName'>;

/**
 * Commit a replacement raw scan for an existing card to
 * card-images-raw/{id}.{ext}. The convert-reveal-images workflow turns it into
 * the preview AVIFs the build already prefers, overriding the card's previous
 * image on the next deploy. No card data changes.
 */
export async function commitCardImage(opts: {
  token: string;
  card: ImageAdminCard;
  imageBase64: string; // data URL or raw base64
  imageExt: string; // jpg | jpeg | png | webp
}): Promise<CommitResult> {
  const {token, card, imageExt} = opts;
  const imageContent = stripDataUrl(opts.imageBase64);
  return commitFiles({
    token,
    message: `fix(card-images): update image for ${card.fullName} [${card.id}]`,
    files: [{path: `${RAW_DIR}/${card.id}.${imageExt}`, contentBase64: imageContent}],
  });
}
