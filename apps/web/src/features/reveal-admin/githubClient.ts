import type {LorcanaJSONCard} from 'inkweave-synergy-engine';
import {insertCardIntoPreviewJson} from './insertCardIntoPreviewJson';

const OWNER = 'Doberjohn';
const REPO = 'inkweave';
const BRANCH = 'master';
const API = 'https://api.github.com';
const PREVIEW_PATH = 'apps/web/public/data/previewCards.json';
const RAW_DIR = 'apps/web/public/card-images-raw';

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// btoa/atob operate on Latin-1, so card text (e.g. the ⬡ glyph) must round-trip
// through a UTF-8 byte encoder or it corrupts. Exported for direct testing.
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export interface TokenInfo {
  ok: boolean;
  canPush: boolean;
  error?: string;
}

export async function validateToken(token: string): Promise<TokenInfo> {
  try {
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}`, {headers: authHeaders(token)});
    if (res.status === 401) return {ok: false, canPush: false, error: 'Invalid or expired token'};
    if (!res.ok) return {ok: false, canPush: false, error: `GitHub error ${res.status}`};
    const data = (await res.json()) as {permissions?: {push?: boolean}};
    const canPush = Boolean(data.permissions?.push);
    return {ok: true, canPush, error: canPush ? undefined : 'Token lacks write (push) access'};
  } catch (e) {
    return {ok: false, canPush: false, error: e instanceof Error ? e.message : 'Network error'};
  }
}

async function ghJson<T = Record<string, unknown>>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {...authHeaders(token), ...(init?.headers ?? {})},
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

function stripDataUrl(b64: string): string {
  const comma = b64.indexOf(',');
  return comma >= 0 ? b64.slice(comma + 1) : b64;
}

export interface CommitResult {
  commitUrl: string;
}

/**
 * One atomic commit on master adding the card to previewCards.json and its raw
 * image to card-images-raw/. Re-reads the live file for an authoritative
 * duplicate-id check before committing.
 *
 * The committed raw is a transient CI input, not a permanent artifact: the
 * `convert-reveal-images` GitHub Action converts it to AVIFs under
 * card-images-preview/ and removes the raw, so card-images-raw/ stays untracked
 * at HEAD (see issue #420). card-images-raw/ is gitignored; this API write is
 * what puts the raw in the tree until the Action prunes it.
 */
export async function commitNewCard(opts: {
  token: string;
  card: LorcanaJSONCard;
  imageBase64: string; // data URL or raw base64
  imageExt: string; // jpg | jpeg | png | webp
}): Promise<CommitResult> {
  const {token, card, imageExt} = opts;
  const imageContent = stripDataUrl(opts.imageBase64);

  const ref = await ghJson<{object: {sha: string}}>(
    token,
    `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`,
  );
  const baseCommitSha = ref.object.sha;
  const baseCommit = await ghJson<{tree: {sha: string}}>(
    token,
    `/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`,
  );

  const fileMeta = await ghJson<{content: string}>(
    token,
    `/repos/${OWNER}/${REPO}/contents/${PREVIEW_PATH}?ref=${BRANCH}`,
  );
  const currentText = base64ToUtf8(fileMeta.content);
  const parsed = JSON.parse(currentText) as {cards: {id: number}[]};
  if (parsed.cards.some((c) => c.id === card.id)) {
    throw new Error(`Card id ${card.id} already exists in previewCards.json`);
  }
  const newText = insertCardIntoPreviewJson(currentText, card);

  const jsonBlob = await ghJson<{sha: string}>(token, `/repos/${OWNER}/${REPO}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({content: utf8ToBase64(newText), encoding: 'base64'}),
  });
  const imageBlob = await ghJson<{sha: string}>(token, `/repos/${OWNER}/${REPO}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({content: imageContent, encoding: 'base64'}),
  });

  const tree = await ghJson<{sha: string}>(token, `/repos/${OWNER}/${REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: [
        {path: PREVIEW_PATH, mode: '100644', type: 'blob', sha: jsonBlob.sha},
        {path: `${RAW_DIR}/${card.id}.${imageExt}`, mode: '100644', type: 'blob', sha: imageBlob.sha},
      ],
    }),
  });

  const commit = await ghJson<{sha: string; html_url: string}>(
    token,
    `/repos/${OWNER}/${REPO}/git/commits`,
    {
      method: 'POST',
      body: JSON.stringify({
        message: `feat(reveals): add ${card.fullName} (${card.setCode}${card.number})`,
        tree: tree.sha,
        parents: [baseCommitSha],
      }),
    },
  );

  await ghJson(token, `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({sha: commit.sha}),
  });

  return {commitUrl: commit.html_url};
}
