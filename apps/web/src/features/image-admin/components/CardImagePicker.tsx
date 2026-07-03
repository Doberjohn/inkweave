import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {smallImageUrl} from '../../cards';
import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../../../shared/constants';
import {filterCards} from '../filterCards';

interface CardImagePickerProps {
  cards: LorcanaCard[];
  selectedId: string | null;
  onSelect: (card: LorcanaCard) => void;
}

const searchStyle = {
  width: '100%',
  padding: '8px 10px',
  background: COLORS.surfaceAlt,
  color: COLORS.text,
  border: `1px solid ${COLORS.surfaceHover}`,
  borderRadius: RADIUS.sm,
  fontSize: FONT_SIZES.md,
};

export function CardImagePicker({cards, selectedId, onSelect}: CardImagePickerProps) {
  const [query, setQuery] = useState('');
  const results = filterCards(cards, query);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search cards..."
        aria-label="Search cards"
        style={searchStyle}
      />
      <ul
        style={{
          listStyle: 'none',
          margin: `${SPACING.sm}px 0 0`,
          padding: 0,
          maxHeight: 340,
          overflowY: 'auto',
        }}>
        {results.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => onSelect(card)}
              aria-pressed={card.id === selectedId}
              style={{
                display: 'flex',
                gap: SPACING.sm,
                alignItems: 'center',
                width: '100%',
                padding: SPACING.xs,
                background: card.id === selectedId ? COLORS.surfaceHover : 'transparent',
                border: 'none',
                borderRadius: RADIUS.sm,
                color: COLORS.text,
                cursor: 'pointer',
                textAlign: 'left',
              }}>
              <img
                src={smallImageUrl(card)}
                alt=""
                width={32}
                height={45}
                style={{borderRadius: 3, flexShrink: 0, objectFit: 'cover'}}
              />
              <span style={{fontSize: FONT_SIZES.sm}}>{card.fullName}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
