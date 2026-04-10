import { Navigate } from 'react-router-dom'
import { readLivePremiumSubscription } from '../lib/subscription'
import { premiumEntryPath, resolvePremiumEntryPathForPlanId } from '../lib/premiumEntryRoutes'

/** `/rooms-premium` → 按当前有效套餐进入对应分档路由；未订阅 → 免费档 */
export default function PremiumRoomEntryRedirect() {
  const live = readLivePremiumSubscription()
  const to = live ? resolvePremiumEntryPathForPlanId(live.planId) : premiumEntryPath('free')
  return <Navigate to={to} replace />
}
