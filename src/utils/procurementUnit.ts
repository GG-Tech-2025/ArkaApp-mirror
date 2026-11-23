/**
 * The unit a procurement quantity is entered, shown and approved in.
 * Cement is counted in bags, crusher powder in units, everything else
 * (wet ash, marble powder, fly ash) in tons. The employee entry screen and
 * the admin approval screens must both use this so the number means the same
 * thing on each.
 */
export function getProcurementUnit(materialName: string | null | undefined): 'Bags' | 'Units' | 'Tons' {
  const name = (materialName ?? '').toLowerCase();
  if (name.includes('cement')) return 'Bags';
  if (name.includes('crusher')) return 'Units';
  return 'Tons';
}
