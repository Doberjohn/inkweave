/**
 * Load the web app's TypeScript from Node.
 *
 * The season (set code, name, size, ink blocks) and the write chain all live in apps/web as
 * TypeScript. Rather than duplicate them, this loads them through Vite's `runnerImport`,
 * the same transform pipeline the app itself uses, resolved from apps/web so no new root
 * dependency is needed. The skill therefore follows a season rotation automatically: change
 * revealSet.ts and every run after that targets the new set.
 */
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WEB = path.join(ROOT, 'apps/web');

let runnerImport;

async function importWeb(relative) {
  if (!runnerImport) {
    const vite = createRequire(path.join(WEB, 'package.json')).resolve('vite');
    ({runnerImport} = await import(pathToFileURL(vite).href));
  }
  const {module} = await runnerImport(path.join(WEB, relative), {
    root: WEB,
    configFile: false,
    logLevel: 'error',
  });
  return module;
}

/** "Hyperia City" -> "hyperia-city", the slug lorcanaplayer's cardset filter uses. */
export function siteSetSlug(setName) {
  return setName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The season this run targets, read from revealSet.ts and theme.ts. */
export async function loadSeason() {
  const reveal = await importWeb('src/shared/constants/revealSet.ts');
  const theme = await importWeb('src/shared/constants/theme.ts');
  const setName = theme.SET_NAMES[reveal.REVEAL_SET_CODE];
  if (!setName) throw new Error(`SET_NAMES has no entry for set ${reveal.REVEAL_SET_CODE}`);
  return {
    setCode: reveal.REVEAL_SET_CODE,
    setNumber: reveal.REVEAL_SET_NUMBER,
    setName,
    setSlug: siteSetSlug(setName),
    setTotal: reveal.SET_TOTAL,
    idBase: reveal.REVEAL_ID_BASE,
    inkBlocks: Object.fromEntries(theme.ALL_INKS.map((ink) => [ink, reveal.inkBlock(ink)])),
  };
}

/** validateRevealCardForm, buildPreviewCard and insertCardIntoPreviewJson, as /admin/reveal uses them. */
export async function loadWriteChain() {
  const dir = 'src/features/reveal-admin';
  const [validate, build, insert] = await Promise.all([
    importWeb(`${dir}/validateForm.ts`),
    importWeb(`${dir}/buildPreviewCard.ts`),
    importWeb(`${dir}/insertCardIntoPreviewJson.ts`),
  ]);
  return {
    validateRevealCardForm: validate.validateRevealCardForm,
    buildPreviewCard: build.buildPreviewCard,
    insertCardIntoPreviewJson: insert.insertCardIntoPreviewJson,
  };
}
