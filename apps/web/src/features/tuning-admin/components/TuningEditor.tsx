import {useState} from 'react';
import {TUNING} from 'inkweave-synergy-engine';
import {COLORS, SPACING, FONT_SIZES} from '../../../shared/constants';
import {useTuningAdmin} from '../useTuningAdmin';
import {RuleSelector} from './RuleSelector';
import {PendingTray} from './PendingTray';
import {TierRow} from './TierRow';

interface TuningEditorProps {
  token: string;
}

interface RowSpec {
  label: string;
  textPath?: (string | number)[];
  textValue?: string;
  scorePath?: (string | number)[];
  scoreValue?: number;
}

/** Rows for the Shift Targets tier list — text plus an optional score per tier. */
function shiftTierRows(): RowSpec[] {
  return Object.entries(TUNING.ruleTexts['shift-targets']).map(([tierKey, entry]) => ({
    label: tierKey,
    textPath: ['ruleTexts', 'shift-targets', tierKey, 'text'],
    textValue: entry.text,
    scorePath: entry.score !== undefined ? ['ruleTexts', 'shift-targets', tierKey, 'score'] : undefined,
    scoreValue: entry.score,
  }));
}

/** Rows for the Ramp rule — score-only rows plus template-text rows. */
function rampRows(): RowSpec[] {
  const scores = Object.entries(TUNING.ruleTexts.ramp.scores).map(([k, v]) => ({
    label: `score · ${k}`,
    scorePath: ['ruleTexts', 'ramp', 'scores', k],
    scoreValue: v,
  }));
  const templates = Object.entries(TUNING.ruleTexts.ramp.templates).map(([k, t]) => ({
    label: `template · ${k}`,
    textPath: ['ruleTexts', 'ramp', 'templates', k],
    textValue: t,
  }));
  return [...scores, ...templates];
}

/** Build the editable rows for a selected rule id. */
function rowsForSelection(selectedId: string): RowSpec[] {
  const rows: RowSpec[] = [];
  const playstyle = TUNING.playstyles[selectedId];
  if (playstyle) {
    rows.push({label: 'Title', textPath: ['playstyles', selectedId, 'name'], textValue: playstyle.name});
    rows.push({label: 'Tagline', textPath: ['playstyles', selectedId, 'tagline'], textValue: playstyle.tagline});
  }
  const direct = TUNING.directRules[selectedId];
  if (direct) {
    rows.push({label: 'Label', textPath: ['directRules', selectedId, 'name'], textValue: direct.name});
    rows.push({label: 'Description', textPath: ['directRules', selectedId, 'description'], textValue: direct.description});
  }
  if (selectedId === 'shift-targets') rows.push(...shiftTierRows());
  if (selectedId === 'ramp') rows.push(...rampRows());
  return rows;
}

export function TuningEditor({token}: TuningEditorProps) {
  const {pending, stageEdit, revertEdit, clear, publish, publishDisabled, publishing, result, error} =
    useTuningAdmin(token);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const errorFor = (path: (string | number)[] | undefined) =>
    path ? pending.find((p) => p.pathKey === JSON.stringify(path))?.error : undefined;

  const rows = selectedId ? rowsForSelection(selectedId) : [];

  return (
    <div>
      <div style={{display: 'flex', gap: SPACING.xl, alignItems: 'flex-start', marginTop: SPACING.md}}>
        <aside style={{flex: '0 0 220px'}}>
          <RuleSelector selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
        <div style={{flex: '1 1 auto', minWidth: 0}}>
          {selectedId ? (
            rows.map((row) => (
              <TierRow
                key={row.label}
                label={row.label}
                text={row.textValue}
                score={row.scoreValue}
                showText={row.textPath !== undefined}
                showScore={row.scorePath !== undefined}
                textError={errorFor(row.textPath)}
                scoreError={errorFor(row.scorePath)}
                onTextChange={(raw) =>
                  row.textPath &&
                  stageEdit({
                    path: row.textPath,
                    rawValue: raw,
                    kind: 'text',
                    oldValue: row.textValue ?? '',
                    label: `${row.label} · text`,
                  })
                }
                onScoreChange={(raw) =>
                  row.scorePath &&
                  stageEdit({
                    path: row.scorePath,
                    rawValue: raw,
                    kind: 'score',
                    oldValue: row.scoreValue ?? 0,
                    label: `${row.label} · score`,
                  })
                }
              />
            ))
          ) : (
            <p style={{color: COLORS.gray600, fontSize: FONT_SIZES.sm}}>
              Pick a playstyle or direct synergy to edit its copy and scores.
            </p>
          )}
        </div>
      </div>

      <PendingTray
        pending={pending}
        publishDisabled={publishDisabled}
        publishing={publishing}
        result={result}
        error={error}
        onRevert={revertEdit}
        onClear={clear}
        onPublish={publish}
      />
    </div>
  );
}
