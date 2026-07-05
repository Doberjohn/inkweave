import type {Playstyle, PlaystyleId} from '../types';

const playstyles: Playstyle[] = [
  {
    id: 'lore-denial',
    name: 'Lore Denial',
    tagline: 'Cards that make your opponent lose lore.',
  },
  {
    id: 'location-control',
    name: 'Locations',
    tagline: 'Cards that build their value around locations.',
  },
  {
    id: 'discard',
    name: 'Discard',
    tagline: 'Force opponents to discard cards while you keep yours.',
  },
  {
    id: 'toy',
    name: 'Toys',
    tagline: 'Toy characters and the cards that reward running them.',
  },
  {
    id: 'ramp',
    name: 'Ramp',
    tagline: 'Speed up your ink so you can play powerful cards earlier than your opponent.',
  },
  {
    id: 'sacrifice',
    name: 'Sacrifice',
    tagline: 'Banish your own characters on demand to cash in banish payoffs.',
  },
  {
    id: 'self-discard',
    name: 'Self-Discard',
    tagline: 'Discard your own cards, then replay them from the bin or cash in discard payoffs.',
  },
  {
    id: 'dwarfs',
    name: 'Seven Dwarfs',
    tagline: 'Seven Dwarfs characters and the cards that reward running them.',
  },
  {
    id: 'floodborn',
    name: 'Floodborns',
    tagline: 'Flood the board with Floodborn characters and cash in the Vine payoffs.',
  },
  {
    id: 'hunny',
    name: 'Hunny',
    tagline: 'A Hundred Acre Wood adventuring party that rewards going wide on the Hunny tribe.',
  },
  {
    id: 'red-panda',
    name: 'Red Panda',
    tagline: 'A small Turning Red tribe built around the Lee family.',
  },
];

const playstyleMap = new Map(playstyles.map((p) => [p.id, p]));

export const getAllPlaystyles = (): Playstyle[] => [...playstyles];

export const getPlaystyleById = (id: PlaystyleId): Playstyle | undefined => playstyleMap.get(id);
