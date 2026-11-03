/**
 * vercel.json's rewrites to the app's shell, as regular expressions, so scripts/serve-dist.mjs
 * answers a path as Vercel does and scripts/vercel-routes.test.mjs can check that every route in
 * the app's router has one.
 *
 * It reads the part of Vercel's source syntax the app's rewrites use: literal segments, `:name`
 * for one segment, and `:name(a|b)` for a segment from a list. Vercel matches a source with or
 * without a trailing slash.
 */

/** A `:name`, its optional `(pattern)` (one level of nested parentheses), and an optional `*`. */
const PARAM = /^:(\w+)(\((?:[^()]|\([^()]*\))*\))?(\*)?/;

function paramPattern([, , pattern, star]) {
  if (pattern) return pattern;
  return star ? '(.*)' : '([^/]+)';
}

/** One vercel.json source as an anchored RegExp. */
export function sourceToRegExp(source) {
  let pattern = '';
  for (let i = 0; i < source.length;) {
    const param = PARAM.exec(source.slice(i));
    if (param) {
      pattern += paramPattern(param);
      i += param[0].length;
    } else {
      pattern += source[i].replace(/[.+?^${}()|[\]\\*]/g, '\\$&');
      i += 1;
    }
  }
  return new RegExp(`^${pattern.replace(/\/$/, '')}/?$`);
}

/** The sources of `config`'s rewrites to /index.html, the app's shell, as RegExps. */
export function appRewrites(config) {
  return (config.rewrites ?? [])
    .filter((rewrite) => rewrite.destination === '/index.html')
    .map((rewrite) => sourceToRegExp(rewrite.source));
}
