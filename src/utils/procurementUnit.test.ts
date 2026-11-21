import { describe, expect, it } from 'vitest';
import { getProcurementUnit } from './procurementUnit';

describe('getProcurementUnit', () => {
  it.each([
    ['Cement', 'Bags'],
    ['cement', 'Bags'],
    ['Crusher Powder', 'Units'],
    ['Wet Ash', 'Tons'],
    ['Marble Powder', 'Tons'],
    ['Fly Ash', 'Tons'],
    ['Fly Ash Powder', 'Tons'],
  ])('uses %s -> %s', (name, unit) => {
    expect(getProcurementUnit(name)).toBe(unit);
  });

  it('falls back to tons when the material is missing', () => {
    expect(getProcurementUnit(undefined)).toBe('Tons');
    expect(getProcurementUnit(null)).toBe('Tons');
    expect(getProcurementUnit('')).toBe('Tons');
  });
});
