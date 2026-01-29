import { useState, useCallback } from "react";
import type { LorcanaCard } from "../types";
import type { DeckSynergyAnalysis as DeckSynergyAnalysisType, DeckCardSynergy } from "../hooks/useDeckBuilder";
import { INK_COLORS, COLORS, FONT_SIZES, RADIUS, SPACING, STRENGTH_STYLES } from "../constants/theme";
import { useCardPreview } from "./CardPreviewContext";

interface DeckSynergyAnalysisProps {
  analysis: DeckSynergyAnalysisType;
  onRemoveCard?: (cardId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DeckSynergyAnalysis({
  analysis,
  onRemoveCard,
  collapsed = false,
  onToggleCollapse,
}: DeckSynergyAnalysisProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "key" | "weak" | "all">("overview");

  if (analysis.cardSynergies.length === 0) {
    return null;
  }

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
          Synergy Analysis
        </span>
        {onToggleCollapse && (
          <span style={{ color: COLORS.gray500, fontSize: `${FONT_SIZES.base}px` }}>
            {collapsed ? "+" : "-"}
          </span>
        )}
      </button>

      {!collapsed && (
        <>
          {/* Overview Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: `${SPACING.md}px`,
              marginBottom: `${SPACING.lg}px`,
            }}
          >
            <StatBox label="Score" value={analysis.overallScore} />
            <StatBox label="Connections" value={analysis.connectionCount} />
            <StatBox label="Avg/Card" value={analysis.averageScore} />
          </div>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: `${SPACING.xs}px`,
              marginBottom: `${SPACING.md}px`,
              borderBottom: `1px solid ${COLORS.gray200}`,
              paddingBottom: `${SPACING.sm}px`,
            }}
          >
            <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
              Overview
            </TabButton>
            <TabButton active={activeTab === "key"} onClick={() => setActiveTab("key")}>
              Key Cards ({analysis.keyCards.length})
            </TabButton>
            <TabButton active={activeTab === "weak"} onClick={() => setActiveTab("weak")}>
              Weak Links ({analysis.weakLinks.length})
            </TabButton>
            <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>
              All
            </TabButton>
          </div>

          {/* Tab Content */}
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {activeTab === "overview" && (
              <OverviewTab analysis={analysis} />
            )}
            {activeTab === "key" && (
              <CardList cards={analysis.keyCards} type="key" onRemoveCard={onRemoveCard} />
            )}
            {activeTab === "weak" && (
              <CardList cards={analysis.weakLinks} type="weak" onRemoveCard={onRemoveCard} />
            )}
            {activeTab === "all" && (
              <CardList cards={analysis.cardSynergies} type="all" onRemoveCard={onRemoveCard} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: COLORS.white,
        borderRadius: `${RADIUS.md}px`,
        padding: `${SPACING.sm}px`,
        textAlign: "center",
        border: `1px solid ${COLORS.gray200}`,
      }}
    >
      <div style={{ fontSize: `${FONT_SIZES.xxl}px`, fontWeight: 600, color: COLORS.primary600 }}>
        {value}
      </div>
      <div style={{ fontSize: `${FONT_SIZES.xs}px`, color: COLORS.gray500, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: `${SPACING.xs}px ${SPACING.sm}px`,
        background: active ? COLORS.primary100 : "transparent",
        color: active ? COLORS.primary700 : COLORS.gray600,
        border: "none",
        borderRadius: `${RADIUS.md}px`,
        cursor: "pointer",
        fontSize: `${FONT_SIZES.xs}px`,
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

function OverviewTab({ analysis }: { analysis: DeckSynergyAnalysisType }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${SPACING.md}px` }}>
      {/* Key Cards Summary */}
      {analysis.keyCards.length > 0 && (
        <div>
          <div
            style={{
              fontSize: `${FONT_SIZES.sm}px`,
              fontWeight: 600,
              color: COLORS.primary600,
              marginBottom: `${SPACING.sm}px`,
            }}
          >
            Key Synergy Cards
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: `${SPACING.xs}px` }}>
            {analysis.keyCards.map((cs) => (
              <span
                key={cs.card.id}
                style={{
                  fontSize: `${FONT_SIZES.sm}px`,
                  background: COLORS.primary100,
                  color: COLORS.primary700,
                  padding: `${SPACING.xs}px ${SPACING.sm}px`,
                  borderRadius: `${RADIUS.md}px`,
                }}
                title={`${cs.synergyCount} synergies, score: ${cs.totalStrength}`}
              >
                {cs.card.name} ({cs.synergyCount})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weak Links Summary */}
      {analysis.weakLinks.length > 0 && (
        <div>
          <div
            style={{
              fontSize: `${FONT_SIZES.sm}px`,
              fontWeight: 600,
              color: COLORS.error,
              marginBottom: `${SPACING.sm}px`,
            }}
          >
            Weak Links (Consider Replacing)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: `${SPACING.xs}px` }}>
            {analysis.weakLinks.map((cs) => (
              <span
                key={cs.card.id}
                style={{
                  fontSize: `${FONT_SIZES.sm}px`,
                  background: "#fef2f2",
                  color: COLORS.error,
                  padding: `${SPACING.xs}px ${SPACING.sm}px`,
                  borderRadius: `${RADIUS.md}px`,
                }}
                title={cs.synergyCount === 0 ? "No synergies" : `Only ${cs.synergyCount} synergy`}
              >
                {cs.card.name} ({cs.synergyCount})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* No issues */}
      {analysis.weakLinks.length === 0 && (
        <div
          style={{
            fontSize: `${FONT_SIZES.sm}px`,
            color: COLORS.gray600,
            background: "#dcfce7",
            padding: `${SPACING.md}px`,
            borderRadius: `${RADIUS.md}px`,
            textAlign: "center",
          }}
        >
          All cards have good synergy connections!
        </div>
      )}
    </div>
  );
}

function CardList({
  cards,
  type,
  onRemoveCard,
}: {
  cards: DeckCardSynergy[];
  type: "key" | "weak" | "all";
  onRemoveCard?: (cardId: string) => void;
}) {
  if (cards.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: `${SPACING.lg}px`, color: COLORS.gray500 }}>
        {type === "key" && "No standout synergy cards yet"}
        {type === "weak" && "No weak links - great deck cohesion!"}
        {type === "all" && "Add cards to see synergy analysis"}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${SPACING.sm}px` }}>
      {cards.map((cs) => (
        <SynergyCardRow key={cs.card.id} cardSynergy={cs} type={type} onRemove={onRemoveCard} />
      ))}
    </div>
  );
}

function SynergyCardRow({
  cardSynergy,
  type,
  onRemove,
}: {
  cardSynergy: DeckCardSynergy;
  type: "key" | "weak" | "all";
  onRemove?: (cardId: string) => void;
}) {
  const { card, quantity, synergyCount, totalStrength, synergizingWith } = cardSynergy;
  const colors = INK_COLORS[card.ink];
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { showPreview, updatePosition, hidePreview } = useCardPreview();

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      showPreview(card, e.clientX, e.clientY);
    },
    [card, showPreview]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      updatePosition(e.clientX, e.clientY);
    },
    [updatePosition]
  );

  const handleMouseLeave = useCallback(() => {
    hidePreview();
  }, [hidePreview]);

  const bgColor = type === "key" ? COLORS.primary50 : type === "weak" ? "#fef2f2" : COLORS.white;
  const borderColor = type === "key" ? COLORS.primary200 : type === "weak" ? "#fecaca" : COLORS.gray200;

  return (
    <div
      style={{
        background: bgColor,
        borderRadius: `${RADIUS.lg}px`,
        border: `1px solid ${borderColor}`,
        overflow: "hidden",
      }}
    >
      <div
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          display: "flex",
          alignItems: "center",
          gap: `${SPACING.md}px`,
          padding: `${SPACING.sm}px ${SPACING.md}px`,
          cursor: synergizingWith.length > 0 ? "pointer" : "default",
        }}
        onClick={() => synergizingWith.length > 0 && setExpanded(!expanded)}
      >
        {/* Thumbnail */}
        {card.imageUrl && !imgError ? (
          <img
            src={card.imageUrl}
            alt=""
            onError={() => setImgError(true)}
            style={{
              width: 32,
              height: 44,
              borderRadius: `${RADIUS.sm}px`,
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 44,
              borderRadius: `${RADIUS.sm}px`,
              background: colors.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: `${FONT_SIZES.sm}px`, fontWeight: 600, color: colors.text }}>
              {card.cost}
            </span>
          </div>
        )}

        {/* Card info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: `${FONT_SIZES.sm}px`,
              color: COLORS.gray800,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {card.name}
            {quantity > 1 && (
              <span style={{ color: COLORS.gray500, fontWeight: 400 }}> x{quantity}</span>
            )}
          </div>
          <div style={{ fontSize: `${FONT_SIZES.xs}px`, color: COLORS.gray500 }}>
            {synergyCount} {synergyCount === 1 ? "synergy" : "synergies"} (score: {totalStrength})
          </div>
        </div>

        {/* Expand indicator */}
        {synergizingWith.length > 0 && (
          <span
            style={{
              color: COLORS.gray400,
              fontSize: `${FONT_SIZES.sm}px`,
              transform: expanded ? "rotate(90deg)" : "rotate(0)",
              transition: "transform 0.2s",
            }}
          >
            ▶
          </span>
        )}

        {/* Remove button for weak cards */}
        {type === "weak" && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(card.id);
            }}
            style={{
              padding: `${SPACING.xs}px ${SPACING.sm}px`,
              background: COLORS.error,
              color: COLORS.white,
              border: "none",
              borderRadius: `${RADIUS.sm}px`,
              cursor: "pointer",
              fontSize: `${FONT_SIZES.xs}px`,
              fontWeight: 500,
            }}
            title="Remove from deck"
          >
            Cut
          </button>
        )}
      </div>

      {/* Expanded synergy details */}
      {expanded && synergizingWith.length > 0 && (
        <div
          style={{
            borderTop: `1px solid ${borderColor}`,
            padding: `${SPACING.sm}px ${SPACING.md}px`,
            background: COLORS.white,
          }}
        >
          <div
            style={{
              fontSize: `${FONT_SIZES.xs}px`,
              color: COLORS.gray500,
              marginBottom: `${SPACING.xs}px`,
            }}
          >
            Synergizes with:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: `${SPACING.xs}px` }}>
            {synergizingWith.map((syn) => (
              <div
                key={syn.card.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: `${SPACING.sm}px`,
                  fontSize: `${FONT_SIZES.xs}px`,
                }}
              >
                <span
                  style={{
                    background: STRENGTH_STYLES[syn.strength].bg,
                    color: STRENGTH_STYLES[syn.strength].text,
                    padding: `1px 6px`,
                    borderRadius: `${RADIUS.sm}px`,
                    fontSize: `${FONT_SIZES.xs}px`,
                    textTransform: "capitalize",
                    flexShrink: 0,
                  }}
                >
                  {syn.strength}
                </span>
                <span style={{ color: COLORS.gray700, fontWeight: 500 }}>{syn.card.name}</span>
                <span style={{ color: COLORS.gray500, flex: 1 }}>- {syn.explanation}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
