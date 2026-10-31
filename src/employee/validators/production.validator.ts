import { ProductionInput } from "../types";

type QuantityField = "bricks" | "wetAsh" | "marblePowder" | "crusherPowder" | "flyAsh" | "cement";

const QUANTITY_LABELS: Record<QuantityField, string> = {
  bricks: "Bricks",
  wetAsh: "Wet Ash",
  marblePowder: "Marble Powder",
  crusherPowder: "Crusher Powder",
  flyAsh: "Fly Ash",
  cement: "Cement",
};

export function validateProduction(input: ProductionInput) {
  const errors: Record<string, string> = {};

  if (!input.date) errors.date = "Date is required";

  // The database requires a round of at least 1, so reject 0 here rather than let it fail there.
  if (Number.isNaN(input.round)) errors.round = "Round is required";
  else if (input.round < 1) errors.round = "Round must be at least 1";
  else if (input.round > 99) errors.round = "Round cannot exceed 99";

  // Zero is treated as "not filled in"; a negative amount is refused by the database too.
  for (const field of Object.keys(QUANTITY_LABELS) as QuantityField[]) {
    const value = input[field];
    if (!value) errors[field] = `${QUANTITY_LABELS[field]} is required`;
    else if (value < 0) errors[field] = `${QUANTITY_LABELS[field]} cannot be negative`;
  }

  return errors;
}
