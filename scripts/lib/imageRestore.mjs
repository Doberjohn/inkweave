/**
 * Restore already-converted card images from our own CDN instead of
 * re-downloading and re-encoding them from Ravensburger (#554).
 *
 * `download-card-images.mjs` could not tell "unchanged" from "unknown", so any
 * cache miss re-fetched every image and re-ran `sharp` over it. Two facts make
 * that avoidable, and both were already published:
 *
 *   1. RAVENSBURGER CONTENT-ADDRESSES ITS OWN IMAGES. Every URL ends in a 40-hex
 *      tail — `…/set9/1_93b7a779…f9d.jpg` — distinct per card, 1024 of 1024
 *      measured. A source URL that has not changed is art that has not changed.
 *   2. OUR DEPLOYED `allCards.json` IS ALREADY THE RECORD OF WHAT WE BUILT. The
 *      build injects `imageHash`/`imageHashSm` into it, and it ships. So the live
 *      site publishes both the hashes it is serving AND the source URLs they came
 *      from.
 *
 * WHY THERE IS NO COMMITTED MANIFEST. The first design recorded our output hashes
 * in a committed file. That cannot work: AVIF encoding is not reproducible across
 * machines — different `sharp`/libvips versions and platforms produce different
 * bytes from the same JPEG. Measured 2026-08-10: **0 of 1024** hashes from a local
 * Windows run matched production's Linux build. A manifest committed from a
 * developer's machine describes bytes CI will never produce, so every restore
 * would 404 and fall through, making the feature inert while adding ~2,000 futile
 * requests. Reading the hashes from the deployment that actually serves them side-
 * steps the problem entirely.
 *
 * A SECOND BENEFIT, not designed for. Restoring prod's bytes means our emitted
 * hash equals prod's hash, so an unchanged card deploys under a byte-identical
 * filename. The CDN's `immutable` entries stay warm across releases instead of
 * being invalidated by a re-encode that changed nothing visible.
 *
 * This module is the PURE half: hashing, extraction and the per-card decision.
 * Network, filesystem and `sharp` work stay in the script, which is what makes
 * any of it testable.
 */
import crypto from 'node:crypto';

/**
 * Ravensburger's content hash: exactly 40 lowercase hex before `.jpg`.
 *
 * Anchored and length-exact on purpose. A loose match would accept any filename
 * containing hex and hand back a "source hash" that tracks nothing, which would
 * mark changed art as unchanged — the one failure this mechanism must not have.
 */
const SOURCE_HASH_RE = /_([0-9a-f]{40})\.jpg$/;

/**
 * Content-addressed hash for an AVIF buffer. Lives here rather than in the script
 * so verification and emission cannot drift apart — two copies of a hash function
 * would mean the restore path checking something the emit path never produced.
 *
 * sha256, 16 hex chars (64 bits), per issue #323's constraints.
 */
export function deriveHash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}

/** `{id}.{hash}.avif`, with `-sm` preserved for the web loader's `smallImageUrl`. */
export function hashedFilename(cardId, hash, suffix) {
  return suffix === '-sm' ? `${cardId}.${hash}-sm.avif` : `${cardId}.${hash}.avif`;
}

/** The upstream content hash for a card, or null when its URL is not addressed that way. */
export function sourceHash(card) {
  return card?.images?.full?.match(SOURCE_HASH_RE)?.[1] ?? null;
}

/** Index deployed cards by id as strings, so a numeric/string id mismatch cannot miss. */
export function indexById(cards) {
  return new Map((cards ?? []).map((card) => [String(card.id), card]));
}

/**
 * What to do about one card, given what production is currently serving.
 *
 * `restore` only when the source art is provably the same AND the deployment
 * publishes both output hashes. Every other case downloads — including a card
 * with only one hash, because restoring one size and encoding the other would
 * leave a card whose two variants came from different builds.
 */
export function planFor(localCard, prodCard) {
  const src = sourceHash(localCard);
  if (!src || !prodCard) return {action: 'download'};
  if (sourceHash(prodCard) !== src) return {action: 'download'};
  if (!prodCard.imageHash || !prodCard.imageHashSm) return {action: 'download'};
  return {action: 'restore', full: prodCard.imageHash, sm: prodCard.imageHashSm};
}

/**
 * Do these bytes hash to what we asked for?
 *
 * THE PROPERTY THAT MAKES RESTORE SAFE. Fetching a build input over the network
 * from a build-time-resolved origin is normally a supply-chain smell; it is
 * acceptable here only because the expected hash is known BEFORE the request, so
 * a stale, truncated or substituted response is arithmetically detectable. Never
 * relax this into a length or truthiness check.
 *
 * KNOWN LIMIT, accepted: this proves the bytes match the hash we asked for, not
 * that the hash belongs to the right card. That binding comes from the deployed
 * `allCards.json`, so a compromised production deployment could swap one card's
 * art for another's — at which point serving the wrong image is the least of the
 * problems, and the Ravensburger fallback is always available.
 *
 * Empty bytes are rejected outright: a zero-length body hashes consistently and
 * would otherwise "verify" against its own hash and write an empty file.
 */
export function verifyRestored(bytes, expectedHash) {
  if (!bytes || bytes.length === 0 || !expectedHash) return false;
  return deriveHash(bytes) === expectedHash;
}
