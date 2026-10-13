import {RELEASE_NOTES, ReleaseNotesMonthSection} from '../features/release-notes';
import {LegalPage} from '../shared/components';

const DESCRIPTION =
  'What changed on Inkweave each month: new features, fixes and synergy engine updates.';

/**
 * Every month's release notes, newest first (#765). Each month is one file in
 * features/release-notes/notes.
 */
export function ReleaseNotesPage() {
  return (
    <LegalPage title="Release notes" description={DESCRIPTION}>
      <p style={{margin: 0}}>{DESCRIPTION}</p>
      {RELEASE_NOTES.map((notes) => (
        <ReleaseNotesMonthSection key={notes.month} notes={notes} />
      ))}
    </LegalPage>
  );
}
