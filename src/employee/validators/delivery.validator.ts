import { DeliveryInput } from "../types";

export function validateDelivery(input: DeliveryInput) {
  const errors: Record<string, string> = {};

  if (!input.time) errors.time = "Time is required";
  if (!input.quantity || input.quantity <= 0)
    errors.quantity = "Quantity must be greater than 0";
  if (!input.location || !input.location.trim())
    errors.location = "Location is required";

  if (input.paymentStatus === "PARTIALLY_PAID") {
    if (!input.paidAmount || input.paidAmount <= 0) {
      errors.paidAmount = "Paid amount is required";
    }
  }

  if (!input.deliveryChallanNumber.trim()) {
    errors.deliveryChallanNumber = "Delivery challan number is required";
  }

  if (input.loadMen.length === 0) {
    errors.loadMen = "At least one load man must be selected";
  }

  return errors;
}
