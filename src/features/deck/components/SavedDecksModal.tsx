import type { Deck } from "../types";
import { COLORS, FONT_SIZES, RADIUS, SPACING, Z_INDEX } from "../../../shared/constants";
import { useResponsive } from "../../../shared/hooks";

interface SavedDecksModalProps {
  decks: Deck[];
  isOpen: boolean;
  onClose: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SavedDecksModal({ decks, isOpen, onClose, onLoad, onDelete }: SavedDecksModalProps) {
  const { isMobile } = useResponsive();

  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDeckSummary = (deck: Deck) => {
    const totalCards = deck.cards.reduce((sum, dc) => sum + dc.quantity, 0);
    const inks = [...new Set(deck.cards.map((dc) => dc.card.ink))];
    return { totalCards, inks };
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        zIndex: Z_INDEX.modal,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-decks-title"
        style={{
          background: COLORS.white,
          borderRadius: isMobile ? `${RADIUS.xl}px ${RADIUS.xl}px 0 0` : `${RADIUS.xl}px`,
          width: "100%",
          maxWidth: isMobile ? "100%" : 400,
          maxHeight: isMobile ? "90vh" : "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          paddingBottom: isMobile ? "env(safe-area-inset-bottom)" : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: `${SPACING.lg}px ${SPACING.xl}px`,
            borderBottom: `1px solid ${COLORS.gray200}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            id="saved-decks-title"
            style={{
              margin: 0,
              fontSize: `${FONT_SIZES.xl}px`,
              fontWeight: 600,
              color: COLORS.gray800,
            }}
          >
            Saved Decks
          </h2>
          <button
            onClick={onClose}
            style={{
              width: isMobile ? 44 : 28,
              height: isMobile ? 44 : 28,
              borderRadius: "50%",
              border: "none",
              background: COLORS.gray100,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: isMobile ? `${FONT_SIZES.xxl}px` : `${FONT_SIZES.lg}px`,
              color: COLORS.gray600,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: `${SPACING.md}px`,
          }}
        >
          {decks.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: `${SPACING.xxl}px`,
                color: COLORS.gray500,
              }}
            >
              <div style={{ fontSize: `${FONT_SIZES.lg}px`, marginBottom: `${SPACING.sm}px` }}>
                No saved decks
              </div>
              <div style={{ fontSize: `${FONT_SIZES.sm}px` }}>
                Save your current deck to see it here
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: `${SPACING.sm}px` }}>
              {decks.map((deck) => {
                const { totalCards, inks } = getDeckSummary(deck);
                return (
                  <div
                    key={deck.id}
                    style={{
                      background: COLORS.gray50,
                      borderRadius: `${RADIUS.lg}px`,
                      padding: `${SPACING.md}px`,
                      border: `1px solid ${COLORS.gray200}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: `${SPACING.sm}px`,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: `${FONT_SIZES.base}px`,
                            color: COLORS.gray800,
                          }}
                        >
                          {deck.name}
                        </div>
                        <div
                          style={{
                            fontSize: `${FONT_SIZES.xs}px`,
                            color: COLORS.gray500,
                            marginTop: 2,
                          }}
                        >
                          {formatDate(deck.updatedAt)}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: `${FONT_SIZES.sm}px`,
                          color: totalCards === 60 ? COLORS.primary600 : COLORS.gray600,
                          fontWeight: 500,
                        }}
                      >
                        {totalCards}/60
                      </div>
                    </div>

                    {/* Ink badges */}
                    <div
                      style={{
                        display: "flex",
                        gap: `${SPACING.xs}px`,
                        marginBottom: `${SPACING.md}px`,
                      }}
                    >
                      {inks.map((ink) => (
                        <span
                          key={ink}
                          style={{
                            fontSize: `${FONT_SIZES.xs}px`,
                            background: COLORS.gray100,
                            color: COLORS.gray700,
                            padding: `2px ${SPACING.sm}px`,
                            borderRadius: `${RADIUS.sm}px`,
                          }}
                        >
                          {ink}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: `${SPACING.sm}px` }}>
                      <button
                        onClick={() => onLoad(deck.id)}
                        style={{
                          flex: 1,
                          padding: isMobile ? `${SPACING.md}px` : `${SPACING.sm}px`,
                          background: COLORS.primary600,
                          color: COLORS.white,
                          border: "none",
                          borderRadius: `${RADIUS.md}px`,
                          cursor: "pointer",
                          fontSize: isMobile ? `${FONT_SIZES.base}px` : `${FONT_SIZES.sm}px`,
                          fontWeight: 500,
                          minHeight: isMobile ? 44 : "auto",
                        }}
                      >
                        Load
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${deck.name}"?`)) {
                            onDelete(deck.id);
                          }
                        }}
                        style={{
                          padding: isMobile ? `${SPACING.md}px ${SPACING.lg}px` : `${SPACING.sm}px ${SPACING.md}px`,
                          background: COLORS.white,
                          color: COLORS.error,
                          border: `1px solid ${COLORS.gray300}`,
                          borderRadius: `${RADIUS.md}px`,
                          cursor: "pointer",
                          fontSize: isMobile ? `${FONT_SIZES.base}px` : `${FONT_SIZES.sm}px`,
                          fontWeight: 500,
                          minHeight: isMobile ? 44 : "auto",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
