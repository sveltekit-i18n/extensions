/** A seeded generator (mulberry32), so a failure names an input that fails again. */
export const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;

  let value = Math.imul(seed ^ (seed >>> 15), seed | 1);

  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

  return ((value ^ (value >>> 14)) >>> 0) / 2 ** 32;
};
