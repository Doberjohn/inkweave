import type {Playstyle, PlaystyleId} from '../types';
import {
  MECHANIC_BY_ID,
  TRIBAL_SPECS,
  mechanicDescription,
  mechanicLabel,
  tribalMechanicDescription,
  type LocationRole,
} from '../utils';
import {getAllPlaystyles} from './playstyles';
import {LOCATION_ROLE_CHIP_LABELS} from './rules';

/** A mechanic tile's text. */
export interface MechanicText {
  label: string;
  description: string;
}

/**
 * The engine's display text as plain data. The engine's build writes it to `dist/catalog.json`
 * (`inkweave-synergy-engine/catalog.json`), so the web app ships these strings and none of the
 * engine's code.
 */
export interface DisplayCatalog {
  playstyles: Playstyle[];
  /** Every mechanic's text, by the canonical id a tile carries (`getPlaystyleMechanicIds`). */
  mechanics: Record<string, MechanicText>;
  /** A playstyle's own wording of a mechanic where it differs: a tribe's page names the tribe. */
  playstyleDescriptions: Partial<Record<PlaystyleId, Record<string, string>>>;
  /** Each location role's chip label, for the synergy window's location connections. */
  locationChipLabels: Record<LocationRole, string>;
}

/** Builds the display catalog from the engine's own tables (`mechanicLabel`, the tuning names). */
export function getDisplayCatalog(): DisplayCatalog {
  const ids = Object.keys(MECHANIC_BY_ID);
  const mechanics = Object.fromEntries(
    ids.map((id) => [id, {label: mechanicLabel(id), description: mechanicDescription(id)}]),
  );
  const playstyleDescriptions = Object.fromEntries(
    Object.values(TRIBAL_SPECS).map((spec) => [
      spec.playstyleId,
      Object.fromEntries(
        ids
          .map((id) => [id, tribalMechanicDescription(id, spec)])
          .filter(([id, text]) => text !== mechanicDescription(id)),
      ),
    ]),
  );
  return {
    playstyles: getAllPlaystyles(),
    mechanics,
    playstyleDescriptions,
    locationChipLabels: {...LOCATION_ROLE_CHIP_LABELS},
  };
}
