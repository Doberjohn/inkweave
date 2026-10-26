import {useRef, type CSSProperties} from 'react';
import Skeleton from 'react-loading-skeleton';
import {useSidePanelDocked} from '../cards/components/BrowseSidePanel';
import {
  LONE_INSET,
  LONE_TOP_OVER_MAP,
  loneBoardHeight,
  loneBoxStyle,
  mapBandHeight,
  type LoneFit,
} from '../cards/components/binderGeometry';
import {useResponsive} from 'inkweave-ui/hooks/useResponsive';
import {FONT_SIZES, RADIUS, SPACING} from '../../shared/constants';
import {BAR, NUMBERS_STYLE, ROW_CONTROL_HEIGHT, SHEET_NUMBERS_STYLE, sectionStyle} from './binderLayout';
import {useLoneFit} from './useLoneFit';

/*
 * What collection mode draws while the binder's chunk downloads (#913), each in the box of what
 * replaces it: the binder section, the docked set panel's body, and the set picker in the
 * toolbar or a phone's row (#969). The first switch to the mode otherwise left the area empty
 * until the chunk arrived. They live outside that chunk, in Browse's collection chunk, so they
 * are kept to a few blocks of the app's skeleton shimmer; the chunk's own loading binder takes
 * over from them.
 */

/** The toolbar's set picker and Collection beside it are as tall (`TOOLBAR_TRIGGER` in SetPicker.tsx). */
const TOOLBAR_CONTROL_HEIGHT = 34;
/** What the binder shows, All, Owned or Missing (`Segments`), in the docked panel. */
const SHOWS_HEIGHT = 42;

/**
 * A spread is two facing pages, each about square: 792x390 at 1440x900, as wide as the section
 * lets it be, and on a wide, short window as tall (the section is a size container).
 */
const SPREAD_SHAPE: CSSProperties = {width: 'min(100%, 200cqh)', aspectRatio: '2'};
/**
 * A phone's lone board, as tall as the binder draws its `rows` at the section's width, or at
 * `maxWidth` where the page's height caps it: the section is a size container, so `100cqw`
 * is that width, and the board comes in from both its sides.
 */
function loneBoard({rows, maxWidth}: LoneFit): CSSProperties {
  const box = maxWidth === undefined ? '100cqw' : `min(100cqw, ${maxWidth}px)`;
  return {height: loneBoardHeight(`${box} - ${2 * LONE_INSET}px`, rows)};
}

const COLUMN: CSSProperties = {display: 'flex', flexDirection: 'column', gap: SPACING.sm};

/**
 * One placeholder, exactly its box: react-loading-skeleton's shimmer with no line box around
 * it (`inline`, then drawn as a block), so the block is as tall as the box it holds.
 */
function Block({height, style}: {height?: number; style?: CSSProperties}) {
  return <Skeleton inline height={height} borderRadius={RADIUS.lg} style={{display: 'block', ...style}} />;
}

/**
 * A phone's page while the chunk downloads (#969): the board in its place over the map, and the
 * map's band under it, empty, so the binder that replaces them draws its page and map in their
 * boxes, with the rows it will draw. One box, so the section's column gap never comes
 * between the two.
 */
function LonePageFallback({fit}: {fit: LoneFit}) {
  return (
    <div>
      <div style={loneBoxStyle(LONE_TOP_OVER_MAP, fit.maxWidth)}>
        <Block style={loneBoard(fit)} />
      </div>
      <div data-testid="binder-map-band" style={{height: mapBandHeight(fit.rows)}} />
    </div>
  );
}

/**
 * The binder section while its chunk downloads: the section's box (`sectionStyle`), holding the
 * shape of what arrives, a spread, or on a phone a page over its map.
 */
export function BinderChunkFallback() {
  const {isMobile} = useResponsive();
  const docked = useSidePanelDocked();
  const section = useRef<HTMLElement>(null);
  const fit = useLoneFit(section, isMobile);
  return (
    <section
      ref={section}
      aria-busy="true"
      aria-label="Loading your binder"
      style={{...sectionStyle(isMobile, docked), ...COLUMN, containerType: 'size'}}>
      {isMobile ? <LonePageFallback fit={fit} /> : <Block style={SPREAD_SHAPE} />}
    </section>
  );
}

/**
 * The set panel's numbers while the pool loads: the headlines' shape, so the numbers land
 * without the panel jumping. A promo set's numbers have the first headline alone. Here, outside
 * the binder's chunk, so the docked panel's fallback draws them too; the panel's own numbers
 * (`CollectionSetPanel`) import them from here.
 */
export function NumbersLoading({promo}: {promo: boolean}) {
  const sizes = promo ? [FONT_SIZES.displaySm] : [FONT_SIZES.displaySm, FONT_SIZES.xl];
  return (
    <>
      {sizes.map((size) => (
        <div key={size} style={COLUMN}>
          <Skeleton height={size} width="70%" />
          <Skeleton height={size === FONT_SIZES.displaySm ? BAR.headline : BAR.second} borderRadius={RADIUS.pill} />
        </div>
      ))}
    </>
  );
}

/**
 * The docked set panel's body while the chunk downloads, as the body lays it out: what the
 * binder shows at its top, then the numbers filling the rest, in their loading shape. `promo`:
 * the panel shows a promo scope, whose numbers have one headline.
 */
export function DockedSetBodyFallback({promo = false}: {promo?: boolean}) {
  return (
    <>
      <Block height={SHOWS_HEIGHT} />
      <div style={NUMBERS_STYLE}>
        <NumbersLoading promo={promo} />
      </div>
    </>
  );
}

/**
 * A phone's Binder sheet's numbers while the chunk downloads (#969), in the column they draw in.
 * `promo`: the sheet counts a promo scope, whose numbers have one headline.
 */
export function SheetNumbersFallback({promo}: {promo: boolean}) {
  return (
    <div style={SHEET_NUMBERS_STYLE}>
      <NumbersLoading promo={promo} />
    </div>
  );
}

/** The toolbar's set picker while the chunk downloads, filling the picker's place beside Collection. */
export function ToolbarSetPickerFallback() {
  return <Block height={TOOLBAR_CONTROL_HEIGHT} />;
}

/**
 * A phone row's set picker while the chunk downloads, filling its place between Filters and
 * Collection.
 */
export function RowSetPickerFallback() {
  return <Block height={ROW_CONTROL_HEIGHT} />;
}
