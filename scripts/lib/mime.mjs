/**
 * Content types for the files a build's output holds, by extension, for the two local servers
 * over apps/web/dist: the prerender crawl's (prerender.mjs) and serve-dist.mjs.
 */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

/** The Content-Type of a file with extension `ext` ('.js'); an unknown one is served as bytes. */
export function contentType(ext) {
  return MIME[ext] || 'application/octet-stream';
}
