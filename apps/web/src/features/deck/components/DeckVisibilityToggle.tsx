import {Chip} from '../../../shared/components';
import {SPACING} from '../../../shared/constants';

interface DeckVisibilityToggleProps {
  isPublic: boolean;
  onChange: (isPublic: boolean) => void;
}

/**
 * Who can see this deck, chosen while you build it (owner ruling 2026-08-05).
 *
 * Visibility used to be asked once when the deck was created and then never shown
 * again, so you could build a whole deck with no way to tell whether it was
 * public, and a second control on the deck's own page wrote it straight to the
 * database behind the builder's back. There is now ONE value, living in the
 * draft, and Save is the only thing that persists it.
 *
 * Two chips rather than one toggle button: a single button showing "Private" has
 * to mean either the current state or the action, and readers reasonably disagree
 * about which. Two options with one pressed says both at once.
 */
export function DeckVisibilityToggle({isPublic, onChange}: DeckVisibilityToggleProps) {
  return (
    <div
      role="group"
      aria-label="Deck visibility"
      style={{display: 'flex', alignItems: 'center', gap: SPACING.xxs}}>
      <Chip
        label="Private"
        active={!isPublic}
        onClick={() => onChange(false)}
        title="Only you can see this deck"
      />
      <Chip
        label="Public"
        active={isPublic}
        onClick={() => onChange(true)}
        title="Anyone can see this deck, and it appears in community decks"
      />
    </div>
  );
}
