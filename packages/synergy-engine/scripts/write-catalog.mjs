// Writes the engine's display text to dist/catalog.json after every build (tsup's onSuccess). The
// web app imports it as `inkweave-synergy-engine/catalog.json`, so it ships the strings without
// the engine's code.
import fs from 'node:fs';
import {getDisplayCatalog} from '../dist/index.js';

fs.writeFileSync(new URL('../dist/catalog.json', import.meta.url), JSON.stringify(getDisplayCatalog()));
