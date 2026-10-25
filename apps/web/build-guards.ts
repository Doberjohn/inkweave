// Build-time checks for what the app's Vite config assumes about its module graph. Each runs as
// the bundle is generated and fails the build, so a broken assumption never ships quietly.
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

/** inkweave-ui's components in a build, split by whether React Compiler compiled them. */
export function uiCompilerReport(modules: readonly ModuleImports[]) {
  const ui = modules.filter(({id}) => UI_COMPONENT.test(posix(id)) && !NOT_SHIPPED.test(id));
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
      const modules = [...this.getModuleIds()].map((id) => ({
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
