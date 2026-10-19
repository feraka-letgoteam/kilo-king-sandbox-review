/** Fixed sizes: content length must never silently reduce numeric type. */
export function controlReadoutTextStyle(
  _value: string,
  _width: number,
  size: number,
  lineHeight = size,
) {
  return { fontSize: size, lineHeight: `${lineHeight}px`, fontWeight: 700 };
}

/** Advances from the shipped Source Sans 3 Bold face (1000 units per em).
 * Selects overflow UI, never a smaller size or a different amount. */
export function controlNumberAdvance(value: string, size: number) {
  const em = [...value].reduce(
    (sum, ch) =>
      sum +
      (/\d/.test(ch)
        ? 0.528
        : ch === "," || ch === "."
          ? 0.3
          : ch === " "
            ? 0.25
            : 0.7),
    0,
  );
  return em * size;
}

export function controlReadoutOverflows(
  value: string,
  width: number,
  size: number,
) {
  return controlNumberAdvance(value, size) > width;
}

/** Spend spare width on a left gutter; never reduce the numeric size. */
export function controlBetInset(value: string, width: number, size: number) {
  return Math.min(10, Math.max(0, width - controlNumberAdvance(value, size)));
}
