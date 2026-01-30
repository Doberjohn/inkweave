import type { CardType } from "../../cards/types";
import type { DeckStats as DeckStatsType } from "../types";
import { INK_COLORS, COLORS, FONT_SIZES, RADIUS, SPACING, ALL_INKS } from "../../../shared/constants/theme";

interface DeckStatsProps {
  stats: DeckStatsType;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const CARD_TYPES: CardType[] = ["Character", "Action", "Item", "Location"];

export function DeckStats({ stats, collapsed = false, onToggleCollapse }: DeckStatsProps) {
  const maxCostCount = Math.max(...Object.values(stats.costCurve), 1);
  const usedInks = ALL_INKS.filter((ink) => stats.inkDistribution[ink] > 0);

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
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          cursor: onToggleCollapse ? "pointer" : "default",
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
          }}
        >
          Statistics
        </span>
        {onToggleCollapse && (
          <span style={{ color: COLORS.gray500, fontSize: `${FONT_SIZES.base}px` }}>
            {collapsed ? "+" : "-"}
          </span>
        )}
      </button>

      {!collapsed && (
        <>
          {/* Card counts */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: `${SPACING.md}px`,
              marginBottom: `${SPACING.lg}px`,
            }}
          >
            <div>
              <div style={{ fontSize: `${FONT_SIZES.sm}px`, color: COLORS.gray500, marginBottom: 2 }}>
                Total Cards
              </div>
              <div
                style={{
                  fontSize: `${FONT_SIZES.xxl}px`,
                  fontWeight: 600,
                  color: stats.totalCards === 60 ? COLORS.primary600 : COLORS.gray800,
                }}
              >
                {stats.totalCards}/60
              </div>
            </div>
            <div>
              <div style={{ fontSize: `${FONT_SIZES.sm}px`, color: COLORS.gray500, marginBottom: 2 }}>
                Unique Cards
              </div>
              <div style={{ fontSize: `${FONT_SIZES.xxl}px`, fontWeight: 600, color: COLORS.gray800 }}>
                {stats.uniqueCards}
              </div>
            </div>
          </div>

          {/* Cost Curve */}
          <div style={{ marginBottom: `${SPACING.lg}px` }}>
            <div
              style={{
                fontSize: `${FONT_SIZES.sm}px`,
                color: COLORS.gray500,
                marginBottom: `${SPACING.sm}px`,
              }}
            >
              Cost Curve
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 50 }}>
              {Array.from({ length: 11 }, (_, i) => {
                const count = stats.costCurve[i] || 0;
                const height = count > 0 ? Math.max(6, (count / maxCostCount) * 44) : 3;
                const label = i === 10 ? "10+" : String(i);
                return (
                  <div
                    key={i}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height,
                        background: count > 0 ? COLORS.primary500 : COLORS.gray200,
                        borderRadius: `${RADIUS.sm}px ${RADIUS.sm}px 0 0`,
                        transition: "height 0.2s ease",
                      }}
                      title={`Cost ${label}: ${count} cards`}
                    />
                    <span
                      style={{
                        fontSize: `${FONT_SIZES.xs}px`,
                        color: COLORS.gray400,
                        marginTop: 3,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ink Distribution */}
          <div style={{ marginBottom: `${SPACING.lg}px` }}>
            <div
              style={{
                fontSize: `${FONT_SIZES.sm}px`,
                color: COLORS.gray500,
                marginBottom: `${SPACING.sm}px`,
              }}
            >
              Ink Distribution {stats.inkCount > 2 && (
                <span style={{ color: COLORS.error, fontWeight: 500 }}>
                  ({stats.inkCount} inks!)
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: `${SPACING.sm}px` }}>
              {usedInks.map((ink) => {
                const count = stats.inkDistribution[ink];
                const percentage = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
                const inkColors = INK_COLORS[ink];
                return (
                  <div key={ink} style={{ display: "flex", alignItems: "center", gap: `${SPACING.md}px` }}>
                    <span
                      style={{
                        fontSize: `${FONT_SIZES.sm}px`,
                        color: inkColors.text,
                        width: 60,
                        flexShrink: 0,
                        fontWeight: 500,
                      }}
                    >
                      {ink}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 10,
                        background: COLORS.gray200,
                        borderRadius: `${RADIUS.sm}px`,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: "100%",
                          background: inkColors.border,
                          transition: "width 0.2s ease",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: `${FONT_SIZES.sm}px`,
                        color: COLORS.gray500,
                        width: 28,
                        textAlign: "right",
                        flexShrink: 0,
                        fontWeight: 500,
                      }}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Type Distribution */}
          <div style={{ marginBottom: stats.validationErrors.length > 0 ? `${SPACING.lg}px` : 0 }}>
            <div
              style={{
                fontSize: `${FONT_SIZES.sm}px`,
                color: COLORS.gray500,
                marginBottom: `${SPACING.sm}px`,
              }}
            >
              Card Types
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: `${SPACING.sm}px` }}>
              {CARD_TYPES.filter((type) => stats.typeDistribution[type] > 0).map((type) => (
                <span
                  key={type}
                  style={{
                    fontSize: `${FONT_SIZES.sm}px`,
                    background: COLORS.gray100,
                    color: COLORS.gray700,
                    padding: `${SPACING.xs}px ${SPACING.md}px`,
                    borderRadius: `${RADIUS.md}px`,
                    fontWeight: 500,
                  }}
                >
                  {type}: {stats.typeDistribution[type]}
                </span>
              ))}
            </div>
          </div>

          {/* Validation Errors */}
          {stats.validationErrors.length > 0 && (
            <div
              role="alert"
              style={{
                background: COLORS.errorBg,
                border: `1px solid ${COLORS.errorBorder}`,
                borderRadius: `${RADIUS.lg}px`,
                padding: `${SPACING.md}px`,
              }}
            >
              {stats.validationErrors.map((error, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: `${FONT_SIZES.sm}px`,
                    color: COLORS.error,
                  }}
                >
                  {error}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
