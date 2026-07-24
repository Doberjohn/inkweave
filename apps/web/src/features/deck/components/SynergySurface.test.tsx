import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {createCard} from '../../../shared/test-utils';
import type {DeckSynergyResult} from '../analysis/deckSynergy';
import {SynergySurface} from './SynergySurface';

const cards = [
  createCard({id: 'a', fullName: 'Elsa'}),
  createCard({id: 'w', fullName: 'Filler'}),
];
const getCardById = (id: string) => cards.find((c) => c.id === id);

describe('SynergySurface', () => {
  it('lists key cards and weak links with connection counts (singular/plural)', () => {
    const synergy: DeckSynergyResult = {overallScore: 70, keyCards: ['a'], weakLinks: ['w'], connectionCounts: {a: 8, w: 1}};
    render(<SynergySurface synergy={synergy} getCardById={getCardById} />);
    expect(screen.getByText('Key cards')).toBeInTheDocument();
    expect(screen.getByText('Elsa')).toBeInTheDocument();
    expect(screen.getByText('8 links')).toBeInTheDocument();
    expect(screen.getByText('Weak links')).toBeInTheDocument();
    expect(screen.getByText('1 link')).toBeInTheDocument();
  });

  it('shows a guiding note when the deck has no synergy hubs', () => {
    const synergy: DeckSynergyResult = {overallScore: 0, keyCards: [], weakLinks: [], connectionCounts: {}};
    render(<SynergySurface synergy={synergy} getCardById={getCardById} />);
    expect(screen.getByText(/No standout synergy hubs/)).toBeInTheDocument();
  });

  it('skips ids that no longer resolve (rotated out of Core)', () => {
    const synergy: DeckSynergyResult = {overallScore: 50, keyCards: ['a', 'gone'], weakLinks: [], connectionCounts: {a: 4, gone: 3}};
    render(<SynergySurface synergy={synergy} getCardById={getCardById} />);
    expect(screen.getByText('Elsa')).toBeInTheDocument();
    expect(screen.queryByText('3 links')).not.toBeInTheDocument();
  });
});
