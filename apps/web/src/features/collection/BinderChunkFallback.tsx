import type {CSSProperties} from 'react';
import Skeleton from 'react-loading-skeleton';
import {useSidePanelDocked} from '../cards/components/BrowseSidePanel';
import {useResponsive} from '../../shared/hooks/useResponsive';
import {RADIUS, SPACING} from '../../shared/constants';
import {sectionStyle} from './binderLayout';

/*
 * What collection mode draws while the binder's chunk downloads (#913), each in the box of what
 * replaces it: the binder section, the docked set panel's body and the toolbar's set picker. The
 * first switch to the mode otherwise left the area empty until the chunk arrived. They live
 * outside that chunk, in Browse's collection chunk, so they are kept to a few blocks of the
 * app's skeleton shimmer; the chunk's own loading binder takes over from them.
 */

/** The toolbar's set picker and Collection beside it are as tall (`TOOLBAR_TRIGGER` in SetPicker.tsx). */
const TOOLBAR_CONTROL_HEIGHT = 34;
/** The phone strip's set picker, the two-line button (`PANEL_TRIGGER` in SetPicker.tsx). */
const STRIP_PICKER_HEIGHT = 72;
/** What the binder shows, All, Owned or Missing (`Segments`), in the strip and the docked panel. */
const SHOWS_HEIGHT = 42;

/**
 * A spread is two facing pages, each about square: 792x390 at 1440x900, as wide as the section
 * lets it be, and on a wide, short window as tall (the section is a size container).
 */
const SPREAD_SHAPE: CSSProperties = {width: 'min(100%, 200cqh)', aspectRatio: '2'};
/** A phone's lone page with the spine beside it, measured at 390 wide: 374x346. */
const PAGE_SHAPE: CSSProperties = {width: '100%', aspectRatio: '374 / 346'};

const COLUMN: CSSProperties = {display: 'flex', flexDirection: 'column', gap: SPACING.sm};

/**
 * One placeholder, exactly its box: react-loading-skeleton's shimmer with no line box around
 * it (`inline`, then drawn as a block), so the block is as tall as the box it holds.
 */
function Block({height, style}: {height?: number; style?: CSSProperties}) {
  return <Skeleton inline height={height} borderRadius={RADIUS.lg} style={{display: 'block', ...style}} />;
}

/**
 * The binder section while its chunk downloads: the section's box (`sectionStyle`), holding one
 * placeholder in the shape of what arrives, a spread, or on a phone the set strip over a page.
 */
export function BinderChunkFallback() {
  const {isMobile} = useResponsive();
  const docked = useSidePanelDocked();
  return (
    <section
      aria-busy="true"
      aria-label="Loading your binder"
      style={{...sectionStyle(isMobile, docked), ...COLUMN, containerType: 'size'}}>
      {isMobile ? (
        <>
          {/* The set strip's two rows, in its padding. */}
          <div style={{...COLUMN, padding: `${SPACING.sm}px 0`}}>
            <Block height={STRIP_PICKER_HEIGHT} />
            <Block height={SHOWS_HEIGHT} />
          </div>
          <Block style={PAGE_SHAPE} />
        </>
      ) : (
        <Block style={SPREAD_SHAPE} />
      )}
    </section>
  );
}

/** The docked set panel's body while the chunk downloads: what the binder shows, at its top. */
export function DockedSetBodyFallback() {
  return <Block height={SHOWS_HEIGHT} />;
}

/** The toolbar's set picker while the chunk downloads, filling the picker's place beside Collection. */
export function ToolbarSetPickerFallback() {
  return <Block height={TOOLBAR_CONTROL_HEIGHT} />;
}
