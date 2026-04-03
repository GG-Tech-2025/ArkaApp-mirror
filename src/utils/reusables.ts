import {DbPaymentMode} from "../services/types";
export const PAGE_SIZE = 20;
const PRODUCTION_STATISTICS_FIRST_PAGE_SIZE = 30;

export function getRange(page: number) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  return { from, to };
}

export function getRangeForProductionStatistics(page: number) {
  if (page === 0) {
    return {
      from: 0,
      to: PRODUCTION_STATISTICS_FIRST_PAGE_SIZE - 1,
      limit: PRODUCTION_STATISTICS_FIRST_PAGE_SIZE,
    };
  }

  const from = PRODUCTION_STATISTICS_FIRST_PAGE_SIZE + (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  return {
    from,
    to,
    limit: PAGE_SIZE,
  };
}


export function mapPaymentModeToDb(
  mode: "Cash" | "UPI" | "Bank Transfer" | "Cheque"
): DbPaymentMode {
  switch (mode) {
    case "Cash":
      return "CASH";
    case "UPI":
      return "UPI";
    case "Bank Transfer":
      return "BANK";
    case "Cheque":
      return "CHEQUE";
    default:
      throw new Error(`Unsupported payment mode: ${mode}`);
  }
}
