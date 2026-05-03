/**
 * DemoBanner — persistent banner shown on every screen during a demo session.
 * Reads mc_demo_user_type from localStorage set at demo login time.
 * Returns null if not in a demo session.
 */

export function DemoBanner() {
  const isDemoFamily = localStorage.getItem('mc_family_id') === 'demo-family-thomson'
  if (!isDemoFamily) return null

  return (
    <div
      role="status"
      className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs font-medium text-amber-800"
    >
      You're viewing the Thomson demo account. Resets nightly at midnight.
    </div>
  )
}
