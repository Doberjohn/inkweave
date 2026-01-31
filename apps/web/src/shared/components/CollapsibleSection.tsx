import type { ReactNode } from "react";
import { COLORS, FONT_SIZES, RADIUS, SPACING } from "../constants";

interface CollapsibleSectionProps {
  title: string;
  collapsed: boolean;
  onToggle?: () => void;
  children: ReactNode;
  /** Optional badge to show next to the title (e.g., count) */
  badge?: ReactNode;
}

/**
 * Reusable collapsible section with header toggle.
 * Used in DeckStats, DeckSuggestions, DeckSynergyAnalysis.
 */
export function CollapsibleSection({
  title,
  collapsed,
  onToggle,
  children,
  badge,
}: CollapsibleSectionProps) {
  return (
    <div
      style={{
        background: COLORS.gray50,
        borderRadius: `${RADIUS.lg}px`,
        padding: `${SPACING.lg}px`,
        border: `1px solid ${COLORS.gray200}`,
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        aria-expanded={!collapsed}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          cursor: onToggle ? "pointer" : "default",
          padding: 0,
          marginBottom: collapsed ? 0 : `${SPACING.lg}px`,
        }}
      >
        <span
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
            color: COLORS.gray700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            display: "flex",
            alignItems: "center",
            gap: `${SPACING.sm}px`,
          }}
        >
          {title}
          {badge}
        </span>
        {onToggle && (
          <span style={{ color: COLORS.gray500, fontSize: `${FONT_SIZES.base}px` }}>
            {collapsed ? "+" : "-"}
          </span>
        )}
      </button>

      {!collapsed && children}
    </div>
  );
}
