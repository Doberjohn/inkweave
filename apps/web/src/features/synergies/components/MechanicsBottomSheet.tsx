import {useRef} from 'react';
import {COLORS, EASING, FONTS, FONT_SIZES, SPACING} from '../../../shared/constants';
import {BottomSheet, IconButton, LinkButton} from '../../../shared/components';
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
          <LinkButton type="button" size="sm" onClick={onClearAll}>
            Clear all
          </LinkButton>
        )}
        <IconButton
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{fontSize: `${FONT_SIZES.xl}px`, lineHeight: 1}}>
          ×
        </IconButton>
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
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onTransitionEnd={onTransitionEnd}
      ariaLabel="Mechanics filter"
      backdropTestId="mechanics-sheet-backdrop"
      sheetRef={sheetRef}
      onKeyDown={handleKeyDown}
      sheetStyle={{
        maxHeight: '78vh',
        transition: `transform 0.25s ${EASING.smooth}, opacity 0.25s ${EASING.smooth}`,
      }}>
      <SheetHeader onClose={onClose} onClearAll={onClearAll} hasActive={hasActive} />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: `${SPACING.md}px ${SPACING.lg}px ${SPACING.lg}px`,
        }}>
        <RoleTileRow tiles={tiles} activeRoles={activeRoles} onToggle={onToggle} layout="grid" />
      </div>
    </BottomSheet>
  );
}
