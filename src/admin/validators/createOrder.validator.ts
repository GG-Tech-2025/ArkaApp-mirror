import { CreateOrderInput } from '../pages/orders/pages/CreateOrderScreen';

export function validateCreateOrder(input: CreateOrderInput): Record<string, string> {
  const errors: Record<string, string> = {};

  // Customer validation
  if (!input.customerId) {
    errors.customer = 'Customer is required';
  }

  // Brick Quantity validation
  if (!input.brickQuantity || input.brickQuantity <= 0) {
    errors.brickQuantity = 'Brick quantity must be greater than 0';
  }

  // Delivery Date validation
  if (!input.deliveryDate) {
    errors.deliveryDate = 'Delivery date is required';
  }

  // Price Per Brick validation
  if (!input.pricePerBrick || input.pricePerBrick <= 0) {
    errors.pricePerBrick = 'Price per brick must be greater than 0';
  }

  // Location validation
  if (!input.location) {
    errors.location = 'Delivery location is required';
  }

  // Final Price validation
  if (!input.finalPrice || input.finalPrice <= 0) {
    errors.finalPrice = 'Final price must be greater than 0';
  }

  // Payment Status and Amount Paid validation
  if (input.paymentStatus === 'PARTIALLY_PAID') {
    if (!input.amountPaid || input.amountPaid <= 0) {
      errors.amountPaid = 'Amount paid is required';
    } else if (input.amountPaid >= input.finalPrice) {
      errors.amountPaid = 'Amount paid must be less than final price';
    }
  }

  // GST Number validation
  if (input.gstNumber && input.gstNumber.length !== 15) {
    errors.gstNumber = 'GST Number must be exactly 15 characters';
  }

  // NEW: Loadmen validation conditional on loading type
  if (input.loadingType !== 'CUSTOMER_SELF') {
    if (!input.loadMen || input.loadMen.length === 0) {
      errors.loadMen = 'Please select at least one employee for loading work';
    }
  }

  return errors;
}
