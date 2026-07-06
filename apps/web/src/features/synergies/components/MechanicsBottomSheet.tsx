import {useRef} from 'react';
import {COLORS, FONTS, FONT_SIZES, SPACING, Z_INDEX} from '../../../shared/constants';
import {useDialogFocus, useScrollLock, useTransitionPresence} from '../../../shared/hooks';
import {RoleTileRow, type RoleTile} from './RoleTileRow';

interface MechanicsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tiles: RoleTile[];
  activeRoles: ReadonlySet<string>;
  onToggle: (role: string) => void;
  onClearAll: () => void;
}

function SheetBackdrop({
  visible,
  onClose,
  onTransitionEnd,
}: {
  visible: boolean;
  onClose: () => void;
  onTransitionEnd: React.TransitionEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      data-testid="mechanics-sheet-backdrop"
      className={`overlay-transition overlay-enter ${visible ? 'overlay-visible' : ''}`}
      onTransitionEnd={onTransitionEnd}
      onClick={onClose}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        // Solid scrim only — no backdrop-filter (WebKit continuous-repaint trap; see #444).
        background: 'rgba(0, 0, 0, 0.72)',
        zIndex: Z_INDEX.modalBackdrop,
      }}
    />
  );
}

function DragHandle() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: `${SPACING.md}px 0 ${SPACING.sm}px`,
        flexShrink: 0,
      }}>
      <div style={{width: 36, height: 4, borderRadius: 2, background: '#444466'}} />
    </div>
  );
}

function SheetHeader({onClose, onClearAll, hasActive}: {onClose: () => void; onClearAll: () => void; hasActive: boolean}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${SPACING.lg}px ${SPACING.md}px`,
        flexShrink: 0,
      }}>
      <h2
        style={{
          margin: 0,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.lg}px`,
          fontWeight: 600,
          color: COLORS.text,
        }}>
        Mechanics
      </h2>
      <div style={{display: 'flex', alignItems: 'center', gap: SPACING.md}}>
        {hasActive && (
          <button
            type="button"
            onClick={onClearAll}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.primary,
              fontFamily: FONTS.body,
              fontSize: `${FONT_SIZES.sm}px`,
              cursor: 'pointer',
              padding: 0,
            }}>
            Clear all
          </button>
        )}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.textMuted,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.xl}px`,
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
          }}>
          ×
        </button>
      </div>
    </div>
  );
}

export function MechanicsBottomSheet({
  isOpen,
  onClose,
  tiles,
  activeRoles,
  onToggle,
  onClearAll,
}: MechanicsBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);

  useScrollLock(isOpen);

  const {handleKeyDown} = useDialogFocus({
    isOpen,
    containerRef: sheetRef,
    initialFocusRef: sheetRef,
    onClose,
  });

  if (!mounted) return null;

  const hasActive = activeRoles.size > 0;

  return (
    <>
      <SheetBackdrop visible={visible} onClose={onClose} onTransitionEnd={onTransitionEnd} />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog keyboard handling (Escape to close) */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mechanics filter"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`overlay-transition overlay-slide-up overlay-enter ${visible ? 'overlay-visible' : ''}`}
        onTransitionEnd={onTransitionEnd}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '85vh',
          background: COLORS.surface,
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.6)',
          zIndex: Z_INDEX.modal,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'transform 0.25s ease, opacity 0.25s ease',
        }}>
        <DragHandle />
        <SheetHeader onClose={onClose} onClearAll={onClearAll} hasActive={hasActive} />
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: `${SPACING.md}px ${SPACING.lg}px ${SPACING.lg}px`,
          }}>
          <RoleTileRow tiles={tiles} activeRoles={activeRoles} onToggle={onToggle} />
        </div>
      </div>
    </>
  );
}
