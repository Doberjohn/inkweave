import type { GameMode } from "../../features/cards";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../constants";

interface HeaderProps {
  totalCards: number;
  isLoading: boolean;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
}

export function Header({ totalCards, isLoading, gameMode, onGameModeChange }: HeaderProps) {
  return (
    <header
      style={{
        background: `linear-gradient(135deg, ${COLORS.headerGradientStart} 0%, ${COLORS.headerGradientEnd} 100%)`,
        padding: `${SPACING.xl}px ${SPACING.xxl}px`,
        color: COLORS.white,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <h1 style={{ fontSize: `${FONT_SIZES.xxxl}px`, fontWeight: 700, margin: 0 }}>
          Lorcana Synergy Finder
        </h1>
        <p style={{ fontSize: `${FONT_SIZES.base}px`, color: COLORS.primary200, marginTop: "4px" }}>
          {isLoading ? "Loading..." : `${totalCards} cards loaded`}
        </p>
      </div>
      <div style={{ display: "flex", gap: "4px" }} role="group" aria-label="Game mode">
        <button
          onClick={() => onGameModeChange("infinity")}
          aria-pressed={gameMode === "infinity"}
          style={{
            padding: "8px 16px",
            borderRadius: `${RADIUS.md}px`,
            border: "none",
            background: gameMode === "infinity" ? COLORS.white : "rgba(255,255,255,0.2)",
            color: gameMode === "infinity" ? COLORS.primary700 : COLORS.white,
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Infinity
        </button>
        <button
          onClick={() => onGameModeChange("core")}
          aria-pressed={gameMode === "core"}
          style={{
            padding: "8px 16px",
            borderRadius: `${RADIUS.md}px`,
            border: "none",
            background: gameMode === "core" ? COLORS.white : "rgba(255,255,255,0.2)",
            color: gameMode === "core" ? COLORS.primary700 : COLORS.white,
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Core
        </button>
      </div>
    </header>
  );
}
