const MIN_BALANCE_PENCE = 500
const THRESHOLD_RATIO   = 0.15

/** True when a spend is large enough, relative to the child's available
 * balance, to warrant the Impulse Speed Bump cooldown interstitial. */
export function shouldTriggerImpulseSpeedBump(
  amountPence: number,
  availableBalancePence: number,
): boolean {
  if (availableBalancePence < MIN_BALANCE_PENCE) return false
  return amountPence > THRESHOLD_RATIO * availableBalancePence
}
