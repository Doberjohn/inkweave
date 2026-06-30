import type {RevealCardForm} from './buildPreviewCard';
import {ALL_INKS} from '../../shared/constants';
import {CARD_TYPES, REVEAL_ID_BASE} from './constants';

const VALID_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

/**
 * Validate the reveal-card form before publish. Returns a map of field name ->
 * error message; `ok` is true only when there are no errors.
 */
export function validateRevealCardForm(
  form: RevealCardForm,
  existingIds: ReadonlySet<number>,
  imageName: string | null,
): ValidationResult {
  const errors: Record<string, string> = {};

  const collector = Number.parseInt(form.collectorNumber.trim(), 10);
  if (form.collectorNumber.trim() === '' || Number.isNaN(collector) || collector <= 0) {
    errors.collectorNumber = 'Enter a positive collector number';
  } else if (existingIds.has(REVEAL_ID_BASE + collector)) {
    errors.collectorNumber = `Card id ${REVEAL_ID_BASE + collector} already exists`;
  }

  if (form.name.trim() === '') errors.name = 'Name is required';

  const cost = Number.parseInt(form.cost.trim(), 10);
  if (form.cost.trim() === '' || Number.isNaN(cost) || cost < 0) {
    errors.cost = 'Enter a cost (0 or more)';
  }

  if (!ALL_INKS.includes(form.ink)) errors.ink = 'Choose an ink';
  if (form.ink2 && form.ink2 === form.ink) errors.ink2 = 'Second ink must differ from the first';
  if (!CARD_TYPES.includes(form.type)) errors.type = 'Choose a card type';

  // Character cards carry strength / willpower / lore; other types do not, so
  // only require these for Characters. Each must be a non-negative integer.
  if (form.type === 'Character') {
    for (const field of ['strength', 'willpower', 'lore'] as const) {
      const value = Number.parseInt(form[field].trim(), 10);
      if (form[field].trim() === '' || Number.isNaN(value) || value < 0) {
        errors[field] = `Enter ${field} for a character`;
      }
    }
  }

  if (!imageName) {
    errors.image = 'Upload a card image';
  } else {
    const ext = imageName.split('.').pop()?.toLowerCase() ?? '';
    if (!VALID_EXT.has(ext)) errors.image = 'Image must be jpg, png, or webp';
  }

  return {ok: Object.keys(errors).length === 0, errors};
}
