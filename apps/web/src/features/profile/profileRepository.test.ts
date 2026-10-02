import {describe, it, expect, vi, beforeEach} from 'vitest';
import {
  DISPLAY_NAME_RULE,
  claimIdentity,
  clampDisplayName,
  getAuthorNames,
  updateDisplayName,
  isValidDisplayName,
} from './profileRepository';

// A Supabase double. `mockState.client` swaps between "configured" and "not
// configured" (getSupabase() === null), matching deckRepository's tests.
//
// Stubbed rather than left to the real client on purpose: .env.local puts real
// Supabase credentials in scope under vitest, so an unmocked provider builds an
// actual client and the suite passes through the wrong code path.
const mockRpc = vi.hoisted(() => vi.fn());
const mockIn = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({client: null as unknown}));

vi.mock('../../shared/lib/supabase', () => ({getSupabase: () => mockState.client}));

beforeEach(() => {
  vi.clearAllMocks();
  mockState.client = {
    rpc: mockRpc,
    from: () => ({
      select: () => ({in: mockIn}),
      update: (payload: unknown) => {
        mockUpdate(payload);
        // Records the filter arguments. They used to be discarded, which made the
        // owner scoping untestable: a build that dropped .eq() looked identical here.
        return {
          eq: (column: string, value: unknown) => {
            mockEq(column, value);
            return {select: () => ({maybeSingle: mockMaybeSingle})};
          },
        };
      },
    }),
  };
});

describe('isValidDisplayName', () => {
  // Mirrors profiles_display_name_len plus the rule a length CHECK cannot express: a
  // name of pure whitespace passes `char_length <= 60` and renders as a blank author.
  it.each(['Doberjohn', 'Emerald Princess 330', 'Jo', 'x'.repeat(60)])('accepts %s', (name) => {
    expect(isValidDisplayName(name)).toBe(true);
  });

  it.each(['', ' ', 'a', '   ', 'x'.repeat(61)])('rejects %s', (name) => {
    expect(isValidDisplayName(name)).toBe(false);
  });

  it('measures the TRIMMED name, so padding neither smuggles one over nor under the cap', () => {
    expect(isValidDisplayName(`  ${'x'.repeat(60)}  `)).toBe(true);
    expect(isValidDisplayName('  a  ')).toBe(false);
  });
});

describe('claimIdentity', () => {
  it('returns both names from the RPC row', async () => {
    mockRpc.mockResolvedValue({
      data: [{handle: 'steel_prince_012', display_name: 'Steel Prince 012'}],
      error: null,
    });
    await expect(claimIdentity()).resolves.toEqual({
      data: {handle: 'steel_prince_012', displayName: 'Steel Prince 012'},
      error: null,
    });
    expect(mockRpc).toHaveBeenCalledWith('claim_handle');
  });

  it('degrades to a null identity when Supabase is not configured', async () => {
    mockState.client = null;
    const {data, error} = await claimIdentity();
    expect(data).toBeNull();
    expect(error).toBe('Supabase not configured');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  // `claim_handle` is `returns table (...)`, so PostgREST hands back an ARRAY. Anything
  // other than exactly one complete row is a shape no name should be read out of — a
  // bare `data[0]` would turn an empty result into `undefined` flowing on as an identity.
  it.each([
    ['a bare object', {handle: 'x', display_name: 'X'}],
    ['an empty array', []],
    ['two rows', [{handle: 'a', display_name: 'A'}, {handle: 'b', display_name: 'B'}]],
    ['a row missing the name', [{handle: 'a', display_name: null}]],
  ])('rejects %s rather than passing it through', async (_label, body) => {
    mockRpc.mockResolvedValue({data: body, error: null});
    await expect(claimIdentity()).resolves.toEqual({data: null, error: null});
  });
});

describe('getAuthorNames', () => {
  it('maps rows to id -> name and drops the ones with no name', async () => {
    mockIn.mockResolvedValue({
      data: [
        {id: 'a', display_name: 'Ruby Detective 891'},
        {id: 'b', display_name: null},
      ],
      error: null,
    });
    const {data} = await getAuthorNames(['a', 'b']);
    expect(data?.get('a')).toBe('Ruby Detective 891');
    // An account with no profile row yet has no name. Absent, not empty-string.
    expect(data?.has('b')).toBe(false);
  });

  it('deduplicates ids before querying', async () => {
    mockIn.mockResolvedValue({data: [], error: null});
    await getAuthorNames(['a', 'a', 'b']);
    expect(mockIn).toHaveBeenCalledWith('id', ['a', 'b']);
  });

  it('makes no request at all for an empty id list', async () => {
    const {data, error} = await getAuthorNames([]);
    expect(data?.size).toBe(0);
    expect(error).toBeNull();
    expect(mockIn).not.toHaveBeenCalled();
  });
});

describe('updateDisplayName', () => {
  it('returns the saved name', async () => {
    mockMaybeSingle.mockResolvedValue({data: {display_name: 'Doberjohn'}, error: null});
    await expect(updateDisplayName('u1', 'Doberjohn')).resolves.toEqual({data: 'Doberjohn', error: null});
  });

  it('trims before writing, so a padded name is not stored padded', async () => {
    mockMaybeSingle.mockResolvedValue({data: {display_name: 'Doberjohn'}, error: null});
    await updateDisplayName('u1', '  Doberjohn  ');
    expect(mockUpdate).toHaveBeenCalledWith({display_name: 'Doberjohn'});
  });

  // No row means RLS matched nothing, i.e. not the caller's id. Reporting it matters:
  // succeeding silently would show the new name while the database kept the old one.
  it('reports a write that matched no row', async () => {
    mockMaybeSingle.mockResolvedValue({data: null, error: null});
    const {data, error} = await updateDisplayName('someone-else', 'Doberjohn');
    expect(data).toBeNull();
    expect(error).toBe('Could not save that name. Try again.');
  });

  /*
    The two failure paths, both of which need a name the guard ACCEPTS so that a request
    is actually issued. Each asserts `mockUpdate` was called, which is the check the
    retired 23514 test lacked: it sent 61 characters, the guard answered first, and it
    passed while reaching nothing.
  */
  it('reports a server error with the generic message, and logs it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({data: null, error: {code: '42501', message: 'permission denied'}});

    const {data, error} = await updateDisplayName('u1', 'Doberjohn');

    expect(mockUpdate).toHaveBeenCalled();
    expect(data).toBeNull();
    expect(error).toBe('Could not save that name. Try again.');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  // The catch, so a rejected fetch degrades instead of propagating into the dialog.
  it('degrades to a network error when the request rejects', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMaybeSingle.mockRejectedValue(new TypeError('Failed to fetch'));

    const {data, error} = await updateDisplayName('u1', 'Doberjohn');

    expect(mockUpdate).toHaveBeenCalled();
    expect(data).toBeNull();
    expect(error).toBe('Network error');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

/*
  The column's CHECK is `char_length(display_name) <= 60`, which counts CHARACTERS. JS
  `.length` counts UTF-16 code units, so a non-BMP character scores 2. Measuring with
  `.length` therefore rejected names the database accepts. These pin the two counts to
  the same unit; a revert to `.length` fails both.
*/
describe('display-name length is counted in code points, as the column counts it', () => {
  // 60 characters, 120 UTF-16 code units. `char_length` reads 60, so it must be valid.
  const SIXTY_EMOJI = '\u{1F600}'.repeat(60);

  it('accepts a 60-character emoji name that .length would score as 120', () => {
    expect(SIXTY_EMOJI).toHaveLength(120);
    expect(isValidDisplayName(SIXTY_EMOJI)).toBe(true);
  });

  it('still rejects one character past the limit', () => {
    expect(isValidDisplayName('\u{1F600}'.repeat(61))).toBe(false);
  });

  it('clamps to 60 characters rather than 60 code units', () => {
    const clamped = clampDisplayName('\u{1F600}'.repeat(80));
    expect([...clamped]).toHaveLength(60);
    expect(isValidDisplayName(clamped)).toBe(true);
  });

  // The common path must not regress: ASCII has one unit per character either way.
  it('leaves an in-range ASCII name untouched', () => {
    expect(clampDisplayName('Doberjohn')).toBe('Doberjohn');
  });
});

describe('updateDisplayName guards the write', () => {
  beforeEach(() => {
    mockMaybeSingle.mockResolvedValue({data: {display_name: 'Doberjohn'}, error: null});
  });

  // RLS is the real boundary, but the filter is what keeps a bug from attempting a
  // cross-account write at all. Nothing asserted it until the mock recorded the args.
  it('scopes the update to the caller by id', async () => {
    await updateDisplayName('u1', 'Doberjohn');
    expect(mockEq).toHaveBeenCalledWith('id', 'u1');
  });

  /*
    The column CHECK is `char_length(display_name) <= 60` with NO minimum, so the
    database would store "" or "a" happily. The dialog gates on the same rule, but it is
    not the only caller, so the floor is enforced at the data boundary too.
  */
  it.each([
    ['an empty name', ''],
    ['whitespace only', '   '],
    ['one character', 'a'],
    // This row replaces a test that mapped a 23514 to the length rule. The guard now
    // rejects 61 characters before any request, so that test asserted the guard's
    // message while believing it exercised the error branch. The branch is gone.
    ['61 characters', 'x'.repeat(61)],
  ])('refuses %s without sending a request', async (_case, name) => {
    const result = await updateDisplayName('u1', name);
    expect(result.error).toBe(DISPLAY_NAME_RULE);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('still sends a name that satisfies the rule', async () => {
    const result = await updateDisplayName('u1', '  Doberjohn  ');
    expect(result.data).toBe('Doberjohn');
    expect(mockUpdate).toHaveBeenCalledWith({display_name: 'Doberjohn'});
  });
});
