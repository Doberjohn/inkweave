import type {LorcanaCard, SynergyGroup} from 'inkweave-synergy-engine';
import {COLORS, FONTS, RADIUS} from '../../../shared/constants';

/**
 * Marketing banner (1200x1240 per page): bigger Set 13 logo up top, big hero + an "Explore
 * every synergy" CTA on the left, one synergy per row on the right — a Lorcana ability-box
 * header (dark tag flush to the left border, cream description) plus 3 top partner cards and
 * a "+N" tile. Split across pages of 3 synergies (hero locked) by BannerPage via
 * /banner/:cardId?page=N.
 *
 * `fullImage(id)` yields full-res art (images.full); card.imageUrl is only a ~367px thumbnail.
 */

const STAGE_W = 1200;
const STAGE_H = 1240;
const CARD_ASPECT = 0.716;
const CARDS_PER_ROW = 3;
const CARD_W = 166;
const CARD_H = Math.round(CARD_W / CARD_ASPECT);
const CARD_GAP = 16;
const ROW_GAP = 40;

const HERO_LEFT = 52;
const HERO_TOP = 200;
const HERO_W = 352;
const RIGHT_LEFT = 438;
const RIGHT_RIGHT = 46;
const ROWS_TOP = 190;
const ROWS_BOTTOM = 56;

const SET_LOGO = '/art/sets/attack-of-the-vine.png';
const INKWEAVE_LOGO = '/brand/logo.svg';
const CARD_BACK = '/art/banner/card-back.png';
const QR_IMAGE = '/art/banner/qr.png';
const ABILITY_BOX_SHADOW =
  '0 3px 10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(0, 0, 0, 0.18)';

/** Banner-only hero art overrides (transparent "pop-out" renders), keyed by card id. */
const HERO_OVERRIDES: Record<string, string> = {
  '2983': '/art/banner/poca-pop-out.png',
};

/**
 * Card-specific banner blurbs, keyed by card id then groupKey. Bespoke marketing copy for a
 * featured card. Falls back to the generic BANNER_BLURBS, then to the data's tagline.
 */
const CARD_BLURBS: Record<string, Record<string, string>> = {
  '2983': {
    'free-play': "1-cost characters can be played for free with Pocahontas' STAY CLOSE ability.",
    bounce: 'Cards that bounce back your characters can be used with Pocahontas to retrigger her ability.',
    hero: 'Pocahontas is a Hero so she synergizes with all cards that give bonuses to Heroes.',
    princess: 'Pocahontas is a Princess so she synergizes with all cards that give bonuses to Princesses.',
    'shift-targets': 'Pocahontas - Guiding the Tribe is a low Shift target for more expensive Pocahontas cards.',
  },
};

/**
 * Curated card picks, keyed by card id then groupKey: the exact partner cards to feature in a
 * row (by card id). When absent, the row falls back to the group's top 3 by score.
 */
const CARD_PICKS: Record<string, Record<string, string[]>> = {
  '2983': {
    'free-play': ['1942', '2762', '3058'], // Aurora - Holding Court, Will o' the Wisp, Minnie Mouse - Curious Adventurer
    bounce: ['2246', '2500', '2036'], // Olaf - Helping Hand, Tigger - Bouncing All the Way, Family Fishing Pole
    hero: ['2307', '2008', '3147'], // Hercules - Mighty Leader, Prince Phillip - Warden of the Woods, Violet Parr - Super Resilient
    princess: ['2344', '2078', '1940'], // Cinderella - Dream Come True, Mulan - Considerate Diplomat, Beast - Gracious Prince
  },
};

/**
 * Phrases to bold within a card's blurb, keyed by card id then groupKey. Whole-word,
 * case-insensitive; longest match wins so "Heroes" beats "Hero" where both apply.
 */
const CARD_BLURB_HIGHLIGHTS: Record<string, Record<string, string[]>> = {
  '2983': {
    'free-play': ['1-cost characters'],
    bounce: ['bounce back'],
    hero: ['Hero', 'Heroes'],
    princess: ['Princess', 'Princesses'],
    'shift-targets': ['Shift target'],
  },
};

/** Generic banner blurbs (banner-only), keyed by synergy groupKey. Engine descriptions untouched. */
const BANNER_BLURBS: Record<string, string> = {
  'free-play': 'Play a 1-cost character for free.',
  'shift-targets': 'Cheap Shift targets to upgrade into.',
  bounce: 'Bounce bodies to reuse their triggers.',
  hero: 'Payoffs that reward the Hero tribe.',
  princess: 'Reward going wide on Princesses.',
  'singer-songs': 'Singers belt out songs for free.',
  'named-companions': 'Calls in its named companions.',
  'spike-suit': 'Willpower becomes combat damage.',
  'merida-archer': 'Adds damage to your action spells.',
  'merida-wisp': 'Draws when a character enters exerted.',
  'lore-denial': 'Strip lore and stall the game.',
  'location-control': 'Locations that grind and hold ground.',
  discard: 'Force opponents to empty their hand.',
  'self-discard': 'Pitch your cards, then cash them in.',
  ramp: 'Accelerate ink for early threats.',
  toy: 'Flood the board with cheap Toys.',
  sacrifice: 'Banish your own for big payoffs.',
  dwarfs: 'Go wide with the Seven Dwarfs.',
  floodborn: 'Shift in Floodborns, stack triggers.',
  hunny: 'Pile up Hunny for tribe payoffs.',
  'red-panda': 'Sing together and swarm Red Pandas.',
  items: 'Item engines and their payoffs.',
  healing: 'Heal to fuel heal-matters payoffs.',
  exert: 'Rewards a fully exerted board.',
  monster: 'Payoffs that reward the Monster tribe.',
  super: 'Payoffs that reward the Super tribe.',
  royalty: 'Queens, Kings, and Princes payoffs.',
  detective: 'Payoffs that reward the Detective tribe.',
};

interface SynergyBannerProps {
  card: LorcanaCard;
  groups: SynergyGroup[];
  fullImage: (id: string) => string | undefined;
}

export function SynergyBanner({card, groups, fullImage}: SynergyBannerProps) {
  const heroOverride = HERO_OVERRIDES[String(card.id)];
  const heroSrc = heroOverride ?? fullImage(String(card.id)) ?? card.imageUrl;
  const isPopOut = Boolean(heroOverride);

  return (
    <div
      className="banner-stage"
      style={{
        position: 'relative', width: STAGE_W, height: STAGE_H, overflow: 'hidden',
        background: `radial-gradient(ellipse at top left, rgba(43,127,255,0.16), transparent 52%),
          radial-gradient(ellipse at bottom left, rgba(173,70,255,0.20), transparent 50%),
          radial-gradient(circle at 26% 46%, rgba(212,175,55,0.06), transparent 44%),
          ${COLORS.background}`,
      }}>
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 240px rgba(0,0,0,0.55)'}} />
      <Orb color="rgba(43,127,255,0.22)" size={540} pos={{left: -190, top: -170}} />
      <Orb color="rgba(173,70,255,0.20)" size={560} pos={{left: -120, bottom: -210}} />

      <img src={SET_LOGO} alt="Attack of the Vine!" style={{position: 'absolute', top: 36, left: '50%', transform: 'translateX(-50%)', height: 132, filter: 'drop-shadow(0 5px 16px rgba(0,0,0,0.55))'}} />
      {/* Landing-page CtaButton (filled variant) colors — orange gradient + dark text — in a pill shape. */}
      <div style={{position: 'absolute', top: 60, right: 46, display: 'inline-flex', alignItems: 'center', gap: 8, background: COLORS.filterGradient, color: COLORS.filterText, fontFamily: FONTS.body, fontSize: 18, fontWeight: 700, letterSpacing: '0.01em', padding: '13px 34px', borderRadius: 999, boxShadow: `${COLORS.filterShadow}, 0 0 32px rgba(255,185,0,0.55), 0 0 66px rgba(255,185,0,0.3)`}}>
        Synergy Spotlight
      </div>

      {/* Hero + CTA, left column */}
      <div style={{position: 'absolute', left: HERO_LEFT, top: HERO_TOP, width: HERO_W, display: 'flex', flexDirection: 'column', alignItems: 'center', perspective: 1600}}>
        <img
          src={heroSrc}
          alt={card.fullName}
          style={{
            width: HERO_W, display: 'block', transformOrigin: 'center center',
            transform: 'rotateY(20deg) rotateX(6deg) rotateZ(-1deg)',
            borderRadius: isPopOut ? 0 : 16,
            filter: isPopOut
              ? 'drop-shadow(-16px 26px 36px rgba(0,0,0,0.6)) drop-shadow(0 0 26px rgba(212,175,55,0.18))'
              : 'drop-shadow(-22px 32px 48px rgba(0,0,0,0.6)) drop-shadow(0 0 28px rgba(212,175,55,0.16))',
          }}
        />
        <div style={{width: '100%', textAlign: 'center', marginTop: 96}}>
          <div style={{height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)', marginBottom: 20}} />
          <div style={{fontSize: 14, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#ffffff', marginBottom: 16}}>
            Explore every Set 13 synergy at
          </div>
          <img src={INKWEAVE_LOGO} alt="Inkweave" style={{height: 58, filter: 'drop-shadow(0 0 20px rgba(212,175,55,0.42))'}} />
          <div style={{marginTop: 42, display: 'flex', justifyContent: 'center'}}>
            <img src={QR_IMAGE} alt="Scan for Inkweave" style={{width: 184, height: 184, display: 'block', borderRadius: 14}} />
          </div>
        </div>
      </div>

      {/* Synergy rows, right. Full pages (3 rows) top-align; a short final page (≤2 rows) centers. */}
      <div style={{position: 'absolute', left: RIGHT_LEFT, right: RIGHT_RIGHT, top: ROWS_TOP, bottom: ROWS_BOTTOM, display: 'flex', flexDirection: 'column', justifyContent: groups.length <= 2 ? 'center' : 'flex-start', gap: ROW_GAP}}>
        {groups.map((group) => (
          <BannerRow key={group.groupKey} group={group} cardId={String(card.id)} fullImage={fullImage} />
        ))}
      </div>
    </div>
  );
}

function BannerRow({group, cardId, fullImage}: {group: SynergyGroup; cardId: string; fullImage: (id: string) => string | undefined}) {
  const picks = CARD_PICKS[cardId]?.[group.groupKey];
  const cardIds = picks ?? [...group.synergies].sort((a, b) => b.score - a.score).slice(0, CARDS_PER_ROW).map((s) => String(s.card.id));
  const remaining = group.synergies.length - cardIds.length;
  const blurb = CARD_BLURBS[cardId]?.[group.groupKey] ?? BANNER_BLURBS[group.groupKey] ?? group.tagline;
  const highlight = CARD_BLURB_HIGHLIGHTS[cardId]?.[group.groupKey];

  return (
    <div style={{display: 'flex', flexDirection: 'column'}}>
      <SynergyHeader label={group.label} blurb={blurb} highlight={highlight} />
      <div style={{display: 'flex', gap: CARD_GAP}}>
        {cardIds.map((id) => (
          <img
            key={id}
            src={fullImage(id)}
            alt=""
            style={{width: CARD_W, height: CARD_H, objectFit: 'cover', objectPosition: 'top', borderRadius: 9, flexShrink: 0, boxShadow: '0 8px 22px rgba(0,0,0,0.55), 0 0 12px rgba(212,175,55,0.1), 0 0 0 1px rgba(0,0,0,0.35)'}}
          />
        ))}
        {remaining > 0 && <MoreTile count={remaining} />}
      </div>
    </div>
  );
}

/** Lorcana ability-box header: dark tag flush to the left border, cream description beside it. */
function SynergyHeader({label, blurb, highlight}: {label: string; blurb: string; highlight?: string[]}) {
  return (
    <div style={{display: 'flex', alignItems: 'stretch', marginBottom: 10, background: COLORS.lorcanaCream, borderRadius: `${RADIUS.sm}px`, overflow: 'hidden', boxShadow: ABILITY_BOX_SHADOW}}>
      <div style={{background: COLORS.lorcanaTagBg, color: COLORS.lorcanaTagText, display: 'flex', alignItems: 'center', padding: '0 15px', flexShrink: 0, fontFamily: FONTS.body, fontWeight: 700, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap'}}>
        {label}
      </div>
      <div style={{color: COLORS.lorcanaTextDark, padding: '9px 15px', flex: 1, fontFamily: FONTS.body, fontWeight: 600, fontSize: '15px', lineHeight: 1.35}}>
        {renderBlurb(blurb, highlight)}
      </div>
    </div>
  );
}

/** Renders blurb text with the given phrases bolded (whole-word, case-insensitive). */
function renderBlurb(text: string, highlight?: string[]): React.ReactNode {
  if (!highlight?.length) return text;
  const escaped = [...highlight]
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const wanted = new Set(highlight.map((t) => t.toLowerCase()));
  return text.split(new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')).map((part, i) =>
    wanted.has(part.toLowerCase()) ? (
      <strong key={i} style={{fontWeight: 800}}>
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

/** "+N" overflow tile: official Lorcana card back, dark scrim, big "+N" over it. */
function MoreTile({count}: {count: number}) {
  return (
    <div
      style={{
        width: CARD_W, height: CARD_H, flexShrink: 0, borderRadius: 9, position: 'relative', overflow: 'hidden',
        backgroundImage: `url('${CARD_BACK}')`, backgroundSize: 'cover', backgroundPosition: 'center',
        border: '1px solid rgba(212,175,55,0.35)', boxShadow: '0 8px 22px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 42%, rgba(8,8,13,0.82) 0%, rgba(8,8,13,0.95) 92%)'}} />
      <span style={{position: 'relative', fontFamily: FONTS.hero, fontSize: 68, fontWeight: 700, color: COLORS.primary, textShadow: '0 2px 12px rgba(0,0,0,0.9)'}}>
        +{count}
      </span>
    </div>
  );
}

function Orb({color, size, pos}: {color: string; size: number; pos: React.CSSProperties}) {
  return <div style={{position: 'absolute', borderRadius: '50%', filter: 'blur(90px)', background: color, width: size, height: size, ...pos}} />;
}
