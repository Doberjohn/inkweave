import {describe, expect, it} from 'vitest';
import {formatFriendCode, normalizeFriendCode} from './friendCode';

describe('normalizeFriendCode', () => {
  // Read the way send_friend_request reads it, so the Send button agrees with the database.
  it.each([
    ['abcd-2345', 'ABCD2345'],
    [' ABCD 2345 ', 'ABCD2345'],
    ['oi23abcd', '0123ABCD'],
    ['l0l0-l0l0', '10101010'],
  ])('reads %s as %s', (typed, code) => {
    expect(normalizeFriendCode(typed)).toBe(code);
  });

  it.each(['ABC', 'ABCD234', 'ABCD23456', 'ABCD234U', ''])('rejects %s', (typed) => {
    expect(normalizeFriendCode(typed)).toBeNull();
  });
});

describe('formatFriendCode', () => {
  it('shows a stored code with its hyphen', () => {
    expect(formatFriendCode('ABCD2345')).toBe('ABCD-2345');
  });
});
