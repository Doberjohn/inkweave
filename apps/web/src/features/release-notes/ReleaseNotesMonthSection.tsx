import {Link} from 'react-router-dom';
import {GoldTag, legalLinkStyle} from '../../shared/components';
import {CAP_LABEL, COLORS, FONT_SIZES, SPACING} from '../../shared/constants';
import {
  RELEASE_NOTES_SECTIONS,
  SECTION_HEADINGS,
  type ReleaseNoteItem,
  type ReleaseNotesMonth,
} from './types';

export interface ReleaseNotesMonthSectionProps {
  notes: ReleaseNotesMonth;
}

const monthStyle: React.CSSProperties = {
  borderTop: `1px solid ${COLORS.surfaceBorder}`,
  marginTop: SPACING.xxl,
  paddingTop: SPACING.xxl,
};

const monthHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: FONT_SIZES.xxl,
  fontWeight: 700,
  color: COLORS.text,
};

const summaryStyle: React.CSSProperties = {margin: `${SPACING.xs}px 0 0`, color: COLORS.textMuted};

const sectionHeadingStyle: React.CSSProperties = {
  ...CAP_LABEL,
  margin: `${SPACING.xxl}px 0 ${SPACING.md}px`,
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.lg,
};

// Every item keeps the same left border width, so a highlight changes only its colour.
const itemStyle: React.CSSProperties = {
  paddingLeft: SPACING.md,
  borderLeft: '2px solid transparent',
};

const highlightStyle: React.CSSProperties = {...itemStyle, borderLeftColor: COLORS.primary};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: SPACING.sm,
  color: COLORS.text,
  fontWeight: 700,
};

const followStyle: React.CSSProperties = {margin: `${SPACING.xs}px 0 0`};

const closingStyle: React.CSSProperties = {
  margin: `${SPACING.xxl}px 0 0`,
  color: COLORS.textMuted,
  fontSize: FONT_SIZES.lg,
};

function NoteItem({item}: {item: ReleaseNoteItem}) {
  return (
    <li style={item.highlight ? highlightStyle : itemStyle}>
      <div style={titleRowStyle}>
        <span>{item.title}</span>
        {item.highlight && <GoldTag>Highlight</GoldTag>}
      </div>
      <p style={followStyle}>{item.body}</p>
      {item.link && (
        <p style={followStyle}>
          <Link to={item.link.to} style={legalLinkStyle}>
            {item.link.label} <span aria-hidden="true">&rarr;</span>
          </Link>
        </p>
      )}
    </li>
  );
}

function NoteGroup({heading, items}: {heading: string; items: ReleaseNoteItem[] | undefined}) {
  if (!items?.length) return null;
  return (
    <>
      <h3 style={sectionHeadingStyle}>{heading}</h3>
      <ul style={listStyle}>
        {/* A month's items never move, and two may share a title, so the index is the key. */}
        {items.map((item, index) => (
          <NoteItem key={index} item={item} />
        ))}
      </ul>
    </>
  );
}

/**
 * One month of release notes: its heading and summary, then New, Improved, Fixed and Synergy
 * engine in that order, leaving out any the month doesn't have. The section's id is the month,
 * so /release-notes#2026-09 lands on it.
 */
export function ReleaseNotesMonthSection({notes}: ReleaseNotesMonthSectionProps) {
  const headingId = `${notes.month}-heading`;
  return (
    <section id={notes.month} aria-labelledby={headingId} style={monthStyle}>
      <h2 id={headingId} style={monthHeadingStyle}>
        {notes.title}
      </h2>
      <p style={summaryStyle}>{notes.summary}</p>
      {RELEASE_NOTES_SECTIONS.map((key) => (
        <NoteGroup key={key} heading={SECTION_HEADINGS[key]} items={notes.sections[key]} />
      ))}
      {notes.behindTheScenes && <p style={closingStyle}>{notes.behindTheScenes}</p>}
    </section>
  );
}
