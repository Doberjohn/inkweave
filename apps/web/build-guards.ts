// Build-time checks for what the app's Vite config assumes about its module graph. Each runs as
// the bundle is generated and fails the build, so a broken assumption never ships quietly.
import fs from 'node:fs';
import path from 'node:path';
import type {Plugin} from 'vite';

const posix = (id: string) => id.replaceAll('\\', '/');

/** A STARTUP_VENDOR entry: a package name, matched inside any node_modules. */
export const isVendorModule = (name: string) => (id: string) =>
  posix(id).includes(`/node_modules/${name}/`);
/** A STARTUP_SHARED entry: one repo-relative file, matched at the end of the module id. */
export const isSharedModule = (file: string) => (id: string) => posix(id).endsWith(`/${file}`);

export interface StartupGroups {
  vendor: readonly string[];
  shared: readonly string[];
}

/** The entries no module in the build matches: each one moved or went away. */
export function staleStartupEntries(
  {vendor, shared}: StartupGroups,
  moduleIds: readonly string[],
): string[] {
  return [
    ...vendor.filter((name) => !moduleIds.some(isVendorModule(name))),
    ...shared.filter((file) => !moduleIds.some(isSharedModule(file))),
  ];
}

/**
 * Fails the build when a startup group (#789) lists a module the build doesn't have. A module that
 * moves, into inkweave-ui for one, would otherwise leave its group without a word and split out
 * into a startup file of its own.
 */
export function startupGroupsGuard(groups: StartupGroups): Plugin {
  return {
    name: 'inkweave:startup-groups-guard',
    apply: 'build',
    generateBundle() {
      const stale = staleStartupEntries(groups, [...this.getModuleIds()]);
      if (stale.length > 0) {
        this.error(
          `STARTUP_VENDOR/STARTUP_SHARED list modules this build doesn't have: ${stale.join(', ')}. ` +
            'Point each at its new path, or drop it (apps/web/vite.config.ts).',
        );
      }
    },
  };
}

const UI_COMPONENT = /\/(packages\/ui|node_modules\/inkweave-ui)\/src\/.+\.tsx$/;
const NOT_SHIPPED = /\.(stories|test)\.tsx$/;
const COMPILER_RUNTIME = /\/react\/compiler-runtime\.js$/;

export interface ModuleImports {
  id: string;
  importedIds: readonly string[];
}

/** True for a module id that is one of inkweave-ui's shipped components. */
const isUiComponent = (id: string) => UI_COMPONENT.test(posix(id)) && !NOT_SHIPPED.test(id);

/** inkweave-ui's components in a build, split by whether React Compiler compiled them. */
export function uiCompilerReport(modules: readonly ModuleImports[]) {
  const ui = modules.filter(({id}) => isUiComponent(id));
  const isCompiled = ({importedIds}: ModuleImports) =>
    importedIds.some((dep) => COMPILER_RUNTIME.test(posix(dep)));
  return {
    compiled: ui.filter(isCompiled).map(({id}) => id),
    skipped: ui.filter((module) => !isCompiled(module)).map(({id}) => id),
  };
}

/**
 * Fails the build when React Compiler compiled none of inkweave-ui's components. The babel plugin
 * skips node_modules, so the package compiles only while pnpm's link resolves to packages/ui.
 */
export function uiCompilerGuard(): Plugin {
  return {
    name: 'inkweave:ui-compiler-guard',
    apply: 'build',
    generateBundle() {
      // Only the package's components need their imports, so only theirs cross into Rolldown.
      const modules = [...this.getModuleIds()].filter(isUiComponent).map((id) => ({
        id,
        importedIds: this.getModuleInfo(id)?.importedIds ?? [],
      }));
      const {compiled, skipped} = uiCompilerReport(modules);
      if (compiled.length === 0 && skipped.length > 0) {
        this.error(
          `React Compiler compiled none of inkweave-ui's ${skipped.length} components (${skipped.join(', ')}). ` +
            'Is packages/ui reached through node_modules (preserveSymlinks), or excluded from the babel plugin?',
        );
      }
      if (skipped.length > 0) {
        this.warn(`React Compiler skipped these inkweave-ui components: ${skipped.join(', ')}`);
      }
    },
  };
}

/** A stylesheet url(), quoted or not; its second group is the url. */
const CSS_URL = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
/** Urls no file of the build backs: inline data, other origins and fragment references. */
const NOT_A_FILE = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;
const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
/** The page inline-css writes styles into. Another, such as Storybook's iframe.html, holds its tool's. */
const INLINED_PAGE = 'index.html';

/** The part of a bundle the url guard reads: Rolldown's OutputBundle fits it. */
export type BuiltFiles = Readonly<
  Record<string, {type: 'asset'; fileName: string; source: string | Uint8Array} | {type: 'chunk'}>
>;

interface Stylesheet {
  fileName: string;
  text: string;
}

/** The stylesheets a bundle writes: each `.css` file, and index.html's `<style>` blocks. */
function stylesheets(bundle: BuiltFiles): Stylesheet[] {
  return Object.values(bundle).flatMap((output) => {
    if (output.type !== 'asset') return [];
    const {fileName, source} = output;
    if (!fileName.endsWith('.css') && fileName !== INLINED_PAGE) return [];
    const text = typeof source === 'string' ? source : new TextDecoder().decode(source);
    if (fileName.endsWith('.css')) return [{fileName, text}];
    return [...text.matchAll(STYLE_BLOCK)].map(([, block]) => ({fileName, text: block}));
  });
}

/** A url's path with its percent escapes decoded, or as written when one is malformed. */
function decodedPath(file: string): string {
  try {
    return decodeURIComponent(file);
  } catch {
    return file;
  }
}

/** The file a stylesheet's url names, as a path from the build's root, or null if no file backs it. */
function urlTarget(url: string, stylesheet: string): string | null {
  if (url === '' || NOT_A_FILE.test(url)) return null;
  const file = decodedPath(url.replace(/[?#].*$/, ''));
  if (file.startsWith('/')) return file.slice(1);
  return path.posix.join(path.posix.dirname(stylesheet), file);
}

/**
 * Each stylesheet url() that names neither a file the bundle writes nor one in publicDir, as
 * "<url> in <stylesheet>".
 */
export function unresolvedCssUrls(bundle: BuiltFiles, publicDir: string): string[] {
  const exists = (file: string) =>
    !file.startsWith('../') &&
    (file in bundle || (publicDir !== '' && fs.existsSync(path.join(publicDir, file))));
  const unresolved = stylesheets(bundle).flatMap(({fileName, text}) =>
    [...text.matchAll(CSS_URL)]
      .map(([, , url]) => ({url, file: urlTarget(url, fileName)}))
      .filter(({file}) => file !== null && !exists(file))
      .map(({url}) => `${url} in ${fileName}`),
  );
  return [...new Set(unresolved)];
}

/**
 * Fails the build on a stylesheet url() that names no file (#979). Vite fails a JS import of a
 * missing file, but only warns on a CSS url() it can't resolve and ships it as written, so moving a
 * symbol its stylesheet names would leave the url pointing at nothing. It reads the `.css` files
 * and index.html's inlined `<style>`, against the bundle and the public folder, in the app's build
 * and Storybook's.
 */
export function cssUrlGuard(): Plugin {
  let publicDir = '';
  return {
    name: 'inkweave:css-url-guard',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      ({publicDir} = config);
    },
    // `post`, so it reads index.html once vite:build-html has emitted it with inline-css's styles.
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const unresolved = unresolvedCssUrls(bundle, publicDir);
        if (unresolved.length > 0) {
          this.error(`Stylesheets name files this build doesn't have: ${unresolved.join(', ')}`);
        }
      },
    },
  };
}
