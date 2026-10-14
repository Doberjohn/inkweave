/**
 * The roles a role helper can return, in display order. Specs that share a helper share its list;
 * groupByRole fails on a role missing here, so a new role can't go uncounted.
 */
export const TOY_ROLES = [
  'member',
  'search',
  'draw',
  'banish-trigger',
  'self-discount',
  'burn',
  'steal',
  'targeted',
  'random',
  'standard',
  'inkwell-ramp',
  'inkwell-trigger',
  'cost-reduction',
];
