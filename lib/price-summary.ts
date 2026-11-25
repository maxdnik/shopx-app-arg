export type PriceRow = {
  key?: string;
  label: string;
  amount: number;
  amountUSD?: number;
  amountARS?: number;
  fxGroup?: string;
};
export type SummaryRow = PriceRow & { details: PriceRow[] };
const normalized = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Group only display rows. The server's total and every charge remain intact. */
export function summarizePrices(rows: PriceRow[]): SummaryRow[] {
  const groups: SummaryRow[] = [];
  for (const row of rows) {
    const amount = Number(row.amount ?? row.amountUSD);
    if (!Number.isFinite(amount)) continue;
    const normalizedRow = { ...row, amount };
    const label = normalized(row.label);
    const usa =
      label.startsWith("precio producto") ||
      label.startsWith("precio usa") ||
      label.startsWith("impuesto de venta usa");
    const tax =
      ["customs_duty", "statistics_tax", "import_vat"].includes(
        row.key || "",
      ) || /^(iva|derecho de importacion|tasa estadistica)/.test(label);
    const key = usa ? "usa" : tax ? "taxes" : row.key || row.label;
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.amount += amount;
      existing.amountARS = typeof existing.amountARS === "number" && Number.isFinite(row.amountARS)
        ? existing.amountARS + Number(row.amountARS)
        : undefined;
      existing.details.push(normalizedRow);
    } else
      groups.push({
        ...normalizedRow,
        amountARS: Number.isFinite(row.amountARS) ? row.amountARS : undefined,
        key,
        label: usa
          ? "Precio USA"
          : tax
            ? "Impuestos"
            : row.label
                .replace(/\s*\((?:8|3)%\)/g, "")
                .replace(/\s*\(Peso logístico[^)]*\)/i, ""),
        details: [normalizedRow],
      });
  }
  return groups;
}
