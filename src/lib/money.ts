/** Round to currency minor units (2 decimal places) without binary drift. */
export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatMoney(amount: number, symbol: string): string {
  const formatted = roundMoney(amount).toLocaleString("en-PK", {
    minimumFractionDigits: Number.isInteger(roundMoney(amount)) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}
