import {useEffect, useState} from 'react';

/**
 * `value` once it has held for `delayMs`: the first value at once, and each later one only when
 * no other followed it within `delayMs`, so a burst of changes settles into one. Values compare
 * with `Object.is`, so pass a string or a number, not an object built each render.
 */
export function useSettledValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
