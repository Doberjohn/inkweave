import type {Playstyle, PlaystyleId} from '../types';
import {TUNING} from '../data/tuning';

const playstyles: Playstyle[] = (Object.keys(TUNING.playstyles) as PlaystyleId[]).map((id) => ({
  id,
  name: TUNING.playstyles[id].name,
  tagline: TUNING.playstyles[id].tagline,
}));

const playstyleMap = new Map(playstyles.map((p) => [p.id, p]));

export const getAllPlaystyles = (): Playstyle[] => [...playstyles];

export const getPlaystyleById = (id: PlaystyleId): Playstyle | undefined => playstyleMap.get(id);
