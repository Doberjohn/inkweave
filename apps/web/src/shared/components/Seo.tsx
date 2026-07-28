/**
 * Per-route document metadata via React 19 native metadata hoisting.
 *
 * React 19 automatically hoists <title>, <meta>, and <link> rendered anywhere in the
 * tree into <head>. This lets each route own its own title / description / canonical /
 * OG tags with zero dependency (no react-helmet) and zero bundle cost — the key enabler
 * for issue #486's per-route SEO. The prerender-crawl captures the hoisted tags via the
 * live document's outerHTML.
 *
 * Every tag below carries `data-seo` (#535). The prerender crawl captures React's hoisted
 * tags into the static HTML, so on a real visit those tags are already in <head> as plain
 * markup — React does not recognise them as its own and hoists a SECOND copy of all eight.
 * Measured before the fix: title/description/canonical each 1 -> 2, og 8 -> 11,
 * twitter 4 -> 6, on every route. Multiple <link rel="canonical"> makes Google ignore
 * canonicalisation entirely, which defeats the point of emitting one.
 *
 * `sweepPrerenderedSeoTags()` in main.tsx removes `head [data-seo]` before React renders,
 * so React's copy is the only one. The marker is what makes that sweep precise: it must
 * not touch index.html's site-level constants (og:type, og:image:width/height, og:locale,
 * twitter:card), which <Seo> does not emit and which have to survive.
 *
 * Keep the attribute on any tag added here — the sweep is driven by it, so an unmarked
 * tag would silently reintroduce the duplication this fixed.
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
      <title data-seo="">{title}</title>
      {description ? <meta data-seo="" name="description" content={description} /> : null}
      <link data-seo="" rel="canonical" href={url} />
      {noindex ? <meta data-seo="" name="robots" content="noindex" /> : null}
      <meta data-seo="" property="og:title" content={title} />
      {description ? <meta data-seo="" property="og:description" content={description} /> : null}
      <meta data-seo="" property="og:url" content={url} />
      {image ? <meta data-seo="" property="og:image" content={image} /> : null}
      <meta data-seo="" name="twitter:title" content={title} />
      {description ? <meta data-seo="" name="twitter:description" content={description} /> : null}
      {image ? <meta data-seo="" name="twitter:image" content={image} /> : null}
    </>
  );
}
