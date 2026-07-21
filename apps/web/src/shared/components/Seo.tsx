/**
 * Per-route document metadata via React 19 native metadata hoisting.
 *
 * React 19 automatically hoists <title>, <meta>, and <link> rendered anywhere in the
 * tree into <head>. This lets each route own its own title / description / canonical /
 * OG tags with zero dependency (no react-helmet) and zero bundle cost — the key enabler
 * for issue #486's per-route SEO. The prerender-crawl captures the hoisted tags via the
 * live document's outerHTML.
 *
 * NOTE: apps/web/index.html still ships static homepage title/description/canonical/OG.
 * Until those are removed (per-route-meta cleanup step), a route rendering <Seo> can
 * produce duplicate <title>/<meta> in <head>. That is a follow-up within this issue; it
 * does not affect the rendered page content.
 */
const SITE_ORIGIN = 'https://inkweave.ink';

export interface SeoProps {
  /** Full <title> text, e.g. "Elsa - Snow Queen | Lorcana Synergies | Inkweave". */
  title: string;
  /** Meta description + og:description. Omit to skip. */
  description?: string;
  /** Absolute path of this route, e.g. "/card/1936". Becomes the self-referential canonical + og:url. */
  canonicalPath: string;
  /** Absolute image URL for og:image / twitter:image. Omit to skip. */
  image?: string;
  /** When true, emits <meta name="robots" content="noindex"> (e.g. unknown card ids). */
  noindex?: boolean;
}

export function Seo({title, description, canonicalPath, image, noindex = false}: SeoProps) {
  const url = `${SITE_ORIGIN}${canonicalPath}`;
  return (
    <>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      <link rel="canonical" href={url} />
      {noindex ? <meta name="robots" content="noindex" /> : null}
      <meta property="og:title" content={title} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:url" content={url} />
      {image ? <meta property="og:image" content={image} /> : null}
      <meta name="twitter:title" content={title} />
      {description ? <meta name="twitter:description" content={description} /> : null}
      {image ? <meta name="twitter:image" content={image} /> : null}
    </>
  );
}
