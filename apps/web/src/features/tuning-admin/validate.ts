export type Validated<T> = {ok: true; value: T} | {ok: false; error: string};

export function validateScore(raw: string): Validated<number> {
  const trimmed = raw.trim();
  if (trimmed === '') return {ok: false, error: 'Score is required'};
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 10) return {ok: false, error: 'Score must be an integer 1-10'};
  return {ok: true, value: n};
}

export function validateText(raw: string): Validated<string> {
  if (raw.trim() === '') return {ok: false, error: 'Text cannot be empty'};
  return {ok: true, value: raw};
}
