import { Env } from '../types.js'
import { json, error } from '../lib/response.js'
import { JwtPayload } from '../lib/jwt.js'
import { getStreakState, getConsistencyScore } from '../lib/streaks.js'
import { getBadgeStats } from '../lib/badges.js'

type AuthedRequest = Request & { auth: JwtPayload }

// GET /api/streaks/:child_id
// Returns streak state + consistency score + earned badge keys for the child.
// Accessible by the child themselves or a parent in the same family.
export async function handleGetStreaks(
  request: Request,
  env: Env,
  childId: string,
): Promise<Response> {
  const auth = (request as AuthedRequest).auth

  // Child can only see their own data
  if (auth.role === 'child' && auth.sub !== childId) return error('Forbidden', 403)

  // Verify child belongs to the same family
  const member = await env.DB.prepare(
    `SELECT user_id FROM family_roles WHERE user_id = ? AND family_id = ? AND role = 'child'`
  ).bind(childId, auth.family_id).first()
  if (!member) return error('Child not found in family', 404)

  const [state, score, stats] = await Promise.all([
    getStreakState(env.DB, childId),
    getConsistencyScore(env.DB, childId),
    getBadgeStats(env.DB, childId),
  ])

  return json({
    current_streak:       state.current_streak,
    longest_streak:       state.longest_streak,
    grace_days_remaining: state.grace_days_remaining,
    last_kept_date:       state.last_kept_date,
    consistency_score:    score,
    earned_badge_keys:    stats.earnedBadgeKeys,
  })
}
