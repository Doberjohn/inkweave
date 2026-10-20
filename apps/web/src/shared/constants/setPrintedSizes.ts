/**
 * The number each set prints its cards out of: "52/204" on a Wilds Unknown card. Every set
 * prints 204 but Set 13, whose scans read "12/207". Chase printings number past it, as printed:
 * "223/204". A set without one here shows its cards' numbers nowhere (`printedCardNumber`).
 */
export const SET_PRINTED_SIZES: Partial<Record<string, number>> = {
  '1': 204,
  '2': 204,
  '3': 204,
  '4': 204,
  '5': 204,
  '6': 204,
  '7': 204,
  '8': 204,
  '9': 204,
  '10': 204,
  '11': 204,
  '12': 204,
  '13': 207,
  '14': 204,
};
