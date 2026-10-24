import {describe, it, expect} from 'vitest';
import {getAllPlaystyles, getDisplayCatalog, getPlaystyleMechanicIds, LOCATION_ROLE_CHIP_LABELS} from '../index';
import {createCard} from './fixtures.js';

describe('getPlaystyleMechanicIds', () => {
  it('shows a structural role as its catalog twin, once', () => {
    const card = createCard({text: 'When you play this character, each opponent loses 1 lore.'});
    expect(getPlaystyleMechanicIds('lore-denial', card)).toEqual(['lore-burn']);
  });

  it("adds the generic mechanics a card has to its playstyle's roles", () => {
    const card = createCard({text: 'Each opponent chooses and discards a card. Draw a card.'});
    expect(getPlaystyleMechanicIds('discard', card)).toEqual(['discard-forced', 'draw']);
  });

  it("leaves out a tribe's membership", () => {
    const card = createCard({classifications: ['Princess'], text: 'Quests for 2 lore.'});
    expect(getPlaystyleMechanicIds('princess', card)).toEqual([]);
  });
});

describe('getDisplayCatalog', () => {
  const catalog = getDisplayCatalog();

  it('holds every playstyle and location chip label as the engine names them', () => {
    expect(catalog.playstyles).toEqual(getAllPlaystyles());
    expect(catalog.locationChipLabels).toEqual(LOCATION_ROLE_CHIP_LABELS);
  });

  it("words a tribe's mechanics with the tribe, and only where they differ", () => {
    expect(catalog.playstyleDescriptions.madrigal).toEqual({
      'in-play-check': 'Get benefits tied to a Madrigal character, such as having one in play',
      trigger: 'Get a repeating benefit when you play a Madrigal character or one quests or challenges',
    });
    expect(catalog.playstyleDescriptions['location-control']).toBeUndefined();
  });

  it('has text for every mechanic id a tile can carry', () => {
    const card = createCard({text: 'Each opponent chooses and discards a card. Draw a card.'});
    for (const id of getPlaystyleMechanicIds('discard', card)) {
      expect(catalog.mechanics[id]?.label).toBeTruthy();
    }
    expect(catalog.mechanics['lore-burn']).toEqual({label: 'Lore Burn', description: 'Make your opponents lose lore'});
  });
});
