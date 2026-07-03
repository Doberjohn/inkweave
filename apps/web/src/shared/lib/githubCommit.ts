const OWNER = 'Doberjohn';
const REPO = 'inkweave';
const BRANCH = 'master';
const API = 'https://api.github.com';

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

/** Strip a `data:...;base64,` prefix, leaving raw base64. */
export function stripDataUrl(b64: string): string {
  const comma = b64.indexOf(',');
  return comma >= 0 ? b64.slice(comma + 1) : b64;
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

/** Read a repo file's decoded UTF-8 text from the master branch. */
export async function readRepoFile(token: string, path: string): Promise<string> {
  const meta = await ghJson<{content: string}>(
    token,
    `/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
  );
  return base64ToUtf8(meta.content);
}

export interface CommitFile {
  /** Repo-relative path. */
  path: string;
  /** Blob content as base64 (data-url prefix already stripped). */
  contentBase64: string;
}

export interface CommitResult {
  commitUrl: string;
}

/**
 * One atomic commit on master writing an arbitrary set of files. Reads the
 * current master tip, creates a blob per file, builds a tree on the base
 * commit's tree, commits, and fast-forwards the ref. Callers prepare the file
 * list (including any read-modify-write of existing files) beforehand.
 */
export async function commitFiles(opts: {
  token: string;
  message: string;
  files: CommitFile[];
}): Promise<CommitResult> {
  const {token, message, files} = opts;

  const ref = await ghJson<{object: {sha: string}}>(
    token,
    `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`,
  );
  const baseCommitSha = ref.object.sha;
  const baseCommit = await ghJson<{tree: {sha: string}}>(
    token,
    `/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`,
  );

  const treeEntries: {path: string; mode: '100644'; type: 'blob'; sha: string}[] = [];
  for (const file of files) {
    const blob = await ghJson<{sha: string}>(token, `/repos/${OWNER}/${REPO}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({content: file.contentBase64, encoding: 'base64'}),
    });
    treeEntries.push({path: file.path, mode: '100644', type: 'blob', sha: blob.sha});
  }

  const tree = await ghJson<{sha: string}>(token, `/repos/${OWNER}/${REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({base_tree: baseCommit.tree.sha, tree: treeEntries}),
  });

  const commit = await ghJson<{sha: string; html_url: string}>(
    token,
    `/repos/${OWNER}/${REPO}/git/commits`,
    {method: 'POST', body: JSON.stringify({message, tree: tree.sha, parents: [baseCommitSha]})},
  );

  await ghJson(token, `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({sha: commit.sha}),
  });

  return {commitUrl: commit.html_url};
}
