import { memo } from "react";
import type { MobileView } from "../hooks/useMobileView";
import { COLORS, FONT_SIZES, LAYOUT_MOBILE, Z_INDEX, RADIUS } from "../constants/theme";

interface MobileNavProps {
  activeView: MobileView;
  onViewChange: (view: MobileView) => void;
  deckCardCount: number;
}

export function MobileNav({ activeView, onViewChange, deckCardCount }: MobileNavProps) {
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: `${LAYOUT_MOBILE.bottomNavHeight}px`,
        background: COLORS.white,
        borderTop: `1px solid ${COLORS.gray200}`,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        zIndex: Z_INDEX.mobileNav,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <NavButton
        label="Cards"
        icon={<CardsIcon />}
        isActive={activeView === "cards"}
        onClick={() => onViewChange("cards")}
      />
      <NavButton
        label="Synergies"
        icon={<SynergiesIcon />}
        isActive={activeView === "synergies"}
        onClick={() => onViewChange("synergies")}
      />
      <NavButton
        label="Deck"
        icon={<DeckIcon />}
        isActive={activeView === "deck"}
        onClick={() => onViewChange("deck")}
        badge={deckCardCount > 0 ? deckCardCount : undefined}
      />
    </nav>
  );
}

interface NavButtonProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}

function NavButton({ label, icon, isActive, onClick, badge }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
        padding: "8px 16px",
        background: "none",
        border: "none",
        cursor: "pointer",
        color: isActive ? COLORS.primary600 : COLORS.gray500,
        position: "relative",
        minWidth: "64px",
        minHeight: "44px",
      }}
    >
      <span style={{ position: "relative" }}>
        {icon}
        {badge !== undefined && (
          <span
            style={{
              position: "absolute",
              top: "-6px",
              right: "-10px",
              background: COLORS.primary600,
              color: COLORS.white,
              fontSize: `${FONT_SIZES.xs}px`,
              fontWeight: 600,
              padding: "1px 5px",
              borderRadius: `${RADIUS.lg}px`,
              minWidth: "18px",
              textAlign: "center",
            }}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span
        style={{
          fontSize: `${FONT_SIZES.xs}px`,
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {label}
      </span>
    </button>
  );
}

// Memoized icon components - static SVGs that never need to re-render
const CardsIcon = memo(function CardsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="9" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
});

const SynergiesIcon = memo(function SynergiesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="19" r="2" />
      <circle cx="5" cy="19" r="2" />
      <line x1="14.5" y1="9.5" x2="17" y2="7" />
      <line x1="9.5" y1="9.5" x2="7" y2="7" />
      <line x1="14.5" y1="14.5" x2="17" y2="17" />
      <line x1="9.5" y1="14.5" x2="7" y2="17" />
    </svg>
  );
});

const DeckIcon = memo(function DeckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="6" y="2" width="12" height="2" rx="1" />
      <line x="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
});
