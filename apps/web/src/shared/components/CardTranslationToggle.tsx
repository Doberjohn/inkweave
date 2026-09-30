import {CtaButton} from './CtaButton';

// Its own module, apart from CardTranslationPanel, so importing the toggle doesn't bring
// CardTextBlock with it: the card modal's loading shell renders it invisibly, from the entry
// chunk, to hold its place (#640).

interface CardTranslationToggleProps {
  shown: boolean;
  onToggle: () => void;
}

/** The "See translation" / "See card" switch that shows and hides the panel. */
export function CardTranslationToggle({shown, onToggle}: CardTranslationToggleProps) {
  return (
    <CtaButton variant="ghost" onClick={onToggle}>
      {shown ? 'See card' : 'See translation'}
    </CtaButton>
  );
}
