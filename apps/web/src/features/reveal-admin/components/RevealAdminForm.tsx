import type {ChangeEvent, FocusEvent} from 'react';
import {canonicalizeCardFullText, type Ink} from 'inkweave-synergy-engine';
import type {RevealCardForm} from '../buildPreviewCard';
import {ALL_INKS, COLORS, SPACING, FONT_SIZES, RADIUS} from '../../../shared/constants';
import {CARD_TYPES, RARITIES, FEATURED_FRANCHISE_HINT} from '../constants';

interface RevealAdminFormProps {
  form: RevealCardForm;
  errors: Record<string, string>;
  onChange: (patch: Partial<RevealCardForm>) => void;
}

const labelStyle = {fontSize: FONT_SIZES.xs, color: COLORS.gray600, display: 'block', marginBottom: 4};
const fieldStyle = {
  width: '100%',
  padding: '8px 10px',
  background: COLORS.surfaceAlt,
  color: COLORS.text,
  border: `1px solid ${COLORS.surfaceHover}`,
  borderRadius: RADIUS.sm,
  fontSize: FONT_SIZES.sm,
};

function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string;
  name: string;
  errors: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <div style={{marginBottom: SPACING.sm}}>
      <label style={labelStyle} htmlFor={`field-${name}`}>
        {label}
      </label>
      {children}
      {errors[name] && (
        <div style={{color: COLORS.error, fontSize: FONT_SIZES.xs, marginTop: 4}}>{errors[name]}</div>
      )}
    </div>
  );
}

export function RevealAdminForm({form, errors, onChange}: RevealAdminFormProps) {
  const text = (name: keyof RevealCardForm) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({[name]: e.target.value} as Partial<RevealCardForm>);

  // Show the house-style rewrite (#635) when the owner moves on within the page. Not when the
  // window or tab loses focus (alt-tab to copy the next ability): the field is still the active
  // element then, and trimming its trailing newline would glue the next paste onto this line.
  const canonicalizeOnLeave = (e: FocusEvent<HTMLTextAreaElement>) => {
    const field = e.currentTarget;
    if (field.ownerDocument.activeElement === field) return;
    onChange({fullText: canonicalizeCardFullText(field.value)});
  };

  return (
    <div>
      <Field label="Collector number" name="collectorNumber" errors={errors}>
        <input id="field-collectorNumber" style={fieldStyle} value={form.collectorNumber} onChange={text('collectorNumber')} inputMode="numeric" />
      </Field>
      <Field label="Name" name="name" errors={errors}>
        <input id="field-name" style={fieldStyle} value={form.name} onChange={text('name')} />
      </Field>
      <Field label="Version (subtitle)" name="version" errors={errors}>
        <input id="field-version" style={fieldStyle} value={form.version} onChange={text('version')} />
      </Field>
      <Field label="Cost" name="cost" errors={errors}>
        <input id="field-cost" style={fieldStyle} value={form.cost} onChange={text('cost')} inputMode="numeric" />
      </Field>
      <Field label="Ink" name="ink" errors={errors}>
        <select id="field-ink" style={fieldStyle} value={form.ink} onChange={(e) => onChange({ink: e.target.value as Ink})}>
          {ALL_INKS.map((ink) => (
            <option key={ink} value={ink}>{ink}</option>
          ))}
        </select>
      </Field>
      <Field label="Second ink (dual-ink only)" name="ink2" errors={errors}>
        <select id="field-ink2" style={fieldStyle} value={form.ink2} onChange={(e) => onChange({ink2: e.target.value as '' | Ink})}>
          <option value="">— none —</option>
          {ALL_INKS.map((ink) => (
            <option key={ink} value={ink}>{ink}</option>
          ))}
        </select>
      </Field>
      <Field label="Type" name="type" errors={errors}>
        <select id="field-type" style={fieldStyle} value={form.type} onChange={(e) => onChange({type: e.target.value as RevealCardForm['type']})}>
          {CARD_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>
      <div style={{marginBottom: SPACING.sm}}>
        <label style={{...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer'}}>
          <input type="checkbox" checked={form.inkwell} onChange={(e) => onChange({inkwell: e.target.checked})} />
          Inkable (can go in inkwell)
        </label>
      </div>
      {form.type === 'Character' && (
        <div style={{display: 'flex', gap: SPACING.sm}}>
          <Field label="Strength" name="strength" errors={errors}>
            <input id="field-strength" style={fieldStyle} value={form.strength} onChange={text('strength')} inputMode="numeric" />
          </Field>
          <Field label="Willpower" name="willpower" errors={errors}>
            <input id="field-willpower" style={fieldStyle} value={form.willpower} onChange={text('willpower')} inputMode="numeric" />
          </Field>
          <Field label="Lore" name="lore" errors={errors}>
            <input id="field-lore" style={fieldStyle} value={form.lore} onChange={text('lore')} inputMode="numeric" />
          </Field>
        </div>
      )}
      {form.type === 'Location' && (
        <Field label="Move cost" name="moveCost" errors={errors}>
          <input id="field-moveCost" style={fieldStyle} value={form.moveCost} onChange={text('moveCost')} inputMode="numeric" />
        </Field>
      )}
      <Field label="Rarity" name="rarity" errors={errors}>
        <select id="field-rarity" style={fieldStyle} value={form.rarity} onChange={(e) => onChange({rarity: e.target.value})}>
          <option value="">— choose —</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </Field>
      <Field label={`Franchise (${FEATURED_FRANCHISE_HINT})`} name="franchise" errors={errors}>
        <input id="field-franchise" style={fieldStyle} value={form.franchise} onChange={text('franchise')} />
      </Field>
      <Field label="Subtypes / classifications (comma separated)" name="subtypes" errors={errors}>
        <input id="field-subtypes" style={fieldStyle} value={form.subtypes} onChange={text('subtypes')} placeholder="Hero, Red Panda" />
      </Field>
      <Field label="Keywords (one per line, e.g. Singer 5)" name="keywords" errors={errors}>
        <textarea id="field-keywords" style={{...fieldStyle, minHeight: 60}} value={form.keywords} onChange={text('keywords')} />
      </Field>
      <Field label="Full card text (one ability per line)" name="fullText" errors={errors}>
        <textarea
          id="field-fullText"
          style={{...fieldStyle, minHeight: 100}}
          value={form.fullText}
          onChange={text('fullText')}
          onBlur={canonicalizeOnLeave}
        />
      </Field>
    </div>
  );
}
