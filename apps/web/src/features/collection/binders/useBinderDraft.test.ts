import {describe, expect, it} from 'vitest';
import {act, renderHook} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {CollectionEntries} from '../collectionParser';
import {binderFace} from './binderCovers';
import type {Binder} from './binderRules';
import {coverDesign} from './coverDesigns';
import {startOf, useBinderDraft} from './useBinderDraft';

/** A card named by its id: a 1-cost Amber Common in Set 12 unless told otherwise. */
const cardOf = (facts: Partial<LorcanaCard> & Pick<LorcanaCard, 'id'>) =>
  ({name: facts.id, fullName: facts.id, cost: 1, ink: 'Amber', inkwell: true, type: 'Character', rarity: 'Common', setCode: '12', setNumber: 1, ...facts}) as LorcanaCard;

const POOL = [
  cardOf({id: 'amber-common', setNumber: 3}),
  cardOf({id: 'amber-epic', rarity: 'Epic', setNumber: 210, imageUrl: 'https://art.test/amber-epic.avif'}),
  cardOf({id: 'steel-rare', ink: 'Steel', rarity: 'Rare', setCode: '11', setNumber: 8}),
  cardOf({id: 'steel-stitch', name: 'Stitch', fullName: 'Stitch - Rock Star', ink: 'Steel', setCode: '11', setNumber: 20}),
  cardOf({id: 'promo-p1', ink: 'Steel', rarity: 'Special', setCode: 'P1', setNumber: 5}),
];
const ENTRIES: CollectionEntries = {'amber-epic': {normal: 1, foil: 0}, 'steel-rare': {normal: 0, foil: 1}};

const EPICS: Binder = {id: 'b1', name: 'Epics', scope: 'all', rules: 'rarity=Epic', pages: 4, cover: null, place: 0};

function renderDraft(binder: Binder | null = null) {
  return renderHook(() => useBinderDraft({start: startOf(binder), pool: POOL, entries: ENTRIES}));
}

describe('useBinderDraft', () => {
  it('starts a new binder with no name, every set and no rule: every card, and nothing to create yet', () => {
    const {result} = renderDraft();
    expect(result.current.name).toBe('');
    expect(result.current.preview.figures).toMatchObject({complete: 2, cards: 5});
    expect(result.current.preview.chips).toEqual([]);
    expect(result.current.canSave).toBe(false);
  });

  it('counts, covers and pages the binder each pick makes, as the shelf will count it', () => {
    const {result} = renderDraft();
    act(() => {
      result.current.setName('Amber');
      result.current.filters.toggleInk('Amber');
    });
    const {input, preview} = result.current;
    expect(input).toEqual({name: 'Amber', scope: 'all', rules: 'ink=Amber', cover: null});
    expect(preview.chips).toEqual(['Amber ink']);
    // The shelf's own face for the binder these rules make.
    const shelf = binderFace(POOL, ENTRIES, {...EPICS, ...input});
    expect({cover: result.current.cover, figures: preview.figures}).toEqual(shelf);
    expect(preview.figures).toMatchObject({complete: 1, cards: 2});
    expect(preview.firstPage).toEqual([
      {card: POOL[0], held: false},
      {card: POOL[1], held: true},
    ]);
    expect(result.current.canSave).toBe(true);
  });

  it('writes Name has into the rules, trimmed, and follows it', () => {
    const {result} = renderDraft();
    act(() => result.current.setQuery('  stitch '));
    expect(result.current.input.rules).toBe('q=stitch');
    expect(result.current.preview.figures.cards).toBe(1);
    expect(result.current.preview.chips).toEqual(['Name has "stitch"']);
  });

  it("can't make a binder whose rules hold no card", () => {
    const {result} = renderDraft();
    act(() => {
      result.current.setName('Ruby');
      result.current.filters.toggleInk('Ruby');
    });
    expect(result.current.holdsCards).toBe(false);
    expect(result.current.canSave).toBe(false);
  });

  it('keeps the name to 30 letters, trims it, and makes nothing of a blank one', () => {
    const {result} = renderDraft();
    act(() => result.current.setName(`${'🃏'.repeat(29)}ab`));
    expect([...result.current.name]).toHaveLength(30);
    act(() => result.current.setName('  Amber  '));
    expect(result.current.input.name).toBe('Amber');
    act(() => result.current.setName('   '));
    expect(result.current.canSave).toBe(false);
  });

  it("can't save a long search the table would refuse, even one that holds a card", () => {
    const long = 'a'.repeat(1001);
    const pool = [...POOL, cardOf({id: 'long', name: long, fullName: long})];
    const {result} = renderHook(() => useBinderDraft({start: startOf(null), pool, entries: ENTRIES}));
    act(() => {
      result.current.setName('Long');
      result.current.setQuery('a'.repeat(1001));
    });
    expect(result.current.input.rules.length).toBeGreaterThan(1000);
    expect(result.current.holdsCards).toBe(true);
    expect(result.current.canSave).toBe(false);
  });

  it('starts Edit rules from the binder, and saves only a change: its rules, else its name', () => {
    const {result} = renderDraft(EPICS);
    expect(result.current.name).toBe('Epics');
    expect(result.current.filters.draftFilters.rarities).toEqual(['Epic']);
    expect(result.current.change).toBeNull();
    expect(result.current.canSave).toBe(false);
    act(() => result.current.setName('My epics'));
    expect(result.current.change).toBe('name');
    act(() => result.current.filters.toggleInk('Amber'));
    expect(result.current.change).toBe('rules');
    expect(result.current.canSave).toBe(true);
  });

  it('starts a new binder on the first design, and sends the one picked', () => {
    const {result} = renderDraft();
    expect(result.current.cover.id).toBe('starry-night');
    act(() => result.current.pickCover(coverDesign('tartan')));
    expect(result.current.cover.id).toBe('tartan');
    expect(result.current.input.cover).toBe('tartan');
  });

  it("counts a new design as a change of cover, and the design a binder with none already shows as none", () => {
    const {result} = renderDraft(EPICS);
    act(() => result.current.pickCover(coverDesign('starry-night')));
    expect(result.current.change).toBeNull();
    act(() => result.current.pickCover(coverDesign('argyle')));
    expect(result.current.change).toBe('cover');
    expect(result.current.canSave).toBe(true);
  });

  // It draws as the first design, but a build that knows it would keep showing it.
  it('counts the first design as a change for a binder whose design this build does not know', () => {
    const {result} = renderDraft({...EPICS, cover: 'paisley'});
    expect(result.current.cover.id).toBe('starry-night');
    act(() => result.current.pickCover(coverDesign('starry-night')));
    expect(result.current.change).toBe('cover');
  });

  it('counts a change of Sets alone as a change of rules', () => {
    const {result} = renderDraft(EPICS);
    act(() => result.current.setScope('12'));
    expect(result.current.change).toBe('rules');
    expect(result.current.preview.chips).toEqual(['Epic', 'The Wilds Unknown']);
  });

  it('keeps a picked rarity offered at Sets that hold none of it, so it can be taken off', () => {
    const {result} = renderDraft(EPICS);
    act(() => result.current.setScope('11'));
    expect(result.current.preview.figures.cards).toBe(0);
    expect(result.current.options.rarities).toEqual(['Common', 'Rare', 'Epic']);
    act(() => result.current.filters.updateFilters({rarities: undefined}));
    expect(result.current.options.rarities).toEqual(['Common', 'Rare']);
    expect(result.current.preview.figures.cards).toBe(2);
  });

  it('drops a rarity rule at a promo Sets, which offers none', () => {
    const {result} = renderDraft(EPICS);
    act(() => result.current.setScope('P1'));
    expect(result.current.input.rules).toBe('');
    expect(result.current.options.rarities).toEqual([]);
    expect(result.current.preview.figures.cards).toBe(1);
  });
});
