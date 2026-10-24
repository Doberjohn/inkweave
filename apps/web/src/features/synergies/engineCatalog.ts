import type {DisplayCatalog, LocationRole, Playstyle, PlaystyleId} from 'inkweave-synergy-engine';
import catalogData from 'inkweave-synergy-engine/catalog.json';

/**
 * The engine's display text: playstyle names, mechanic tile text and location chip labels. The
 * engine's build writes it as data (#930), so the app ships these strings without the
 * engine's rules and detectors. The app imports only types from the engine's root.
 */
const catalog = catalogData as DisplayCatalog;
const playstylesById = new Map(catalog.playstyles.map((playstyle) => [playstyle.id, playstyle]));

export const getAllPlaystyles = (): Playstyle[] => [...catalog.playstyles];

export const getPlaystyleById = (id: PlaystyleId): Playstyle | undefined => playstylesById.get(id);

export const LOCATION_ROLE_CHIP_LABELS: Record<LocationRole, string> = catalog.locationChipLabels;

/** A mechanic tile's label, by the id precompute writes (`getPlaystyleMechanicIds`). */
export const mechanicLabel = (id: string): string => catalog.mechanics[id]?.label ?? id;

/** A mechanic tile's description on a playstyle's page: a tribe's page names the tribe. */
export const mechanicDescription = (id: string, playstyleId: PlaystyleId): string =>
  catalog.playstyleDescriptions[playstyleId]?.[id] ?? catalog.mechanics[id]?.description ?? '';
