import {RELEASE_NOTES, ReleaseNotesWeekSection} from '../features/release-notes';
import {LegalPage} from '../shared/components';

const DESCRIPTION =
  'What changed on Inkweave each week: new features, fixes and synergy engine updates.';

/**
 * Every week's release notes, newest first (#765). Each week is one file in
 * features/release-notes/notes.
 */
export function ReleaseNotesPage() {
  return (
    <LegalPage title="Release notes" description={DESCRIPTION}>
      <p style={{margin: 0}}>{DESCRIPTION}</p>
      {RELEASE_NOTES.map((notes) => (
        <ReleaseNotesWeekSection key={notes.week} notes={notes} />
      ))}
    </LegalPage>
  );
}
