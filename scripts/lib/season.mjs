/**
 * The reveal season, read from the web app's revealSet.ts.
 *
 * revealSet.ts is TypeScript, so this loads it through Vite's `runnerImport`, the transform
 * pipeline the app itself uses, resolved from apps/web so no new root dependency is needed.
 * Rotating the season in revealSet.ts is enough: the next run targets the new set.
 */
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/web');

/** The reveal season's set code ('14') and the base its preview ids count from (14000). */
export async function loadSeason() {
  const vite = createRequire(path.join(WEB, 'package.json')).resolve('vite');
  const {runnerImport} = await import(pathToFileURL(vite).href);
  const {module: reveal} = await runnerImport(path.join(WEB, 'src/shared/constants/revealSet.ts'), {
    root: WEB,
    configFile: false,
    logLevel: 'error',
  });
  return {setCode: reveal.REVEAL_SET_CODE, idBase: reveal.REVEAL_ID_BASE};
}
