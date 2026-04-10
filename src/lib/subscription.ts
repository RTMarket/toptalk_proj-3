import { normalizeClientAnonKey } from './anonKey'
import { computePlanExpiresAtIso } from './planExpiry'
import { clearSinglePlanConsumption } from './singlePlanConsumption'
import { replaceLatestSubscriptionPurchasedAt } from './subscriptionAnchor'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
const ANON_KEY = normalizeClientAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

function toMs(iso?: string | null): number | null {
  if (!iso) return null
  const t = new Date(String(iso)).getTime()
  return Number.isFinite(t) ? t : null
}

export type LivePremiumSubscription = { planId: string; expireAt: string }

/**
 * 高级房列表页等：以 localStorage `toptalk_plan` 为套餐身份权威，避免 `toptalk_subscription` 与 React state 滞后导致仍显示「单次已消耗」等误判。
 */
export function readLivePremiumSubscription(): LivePremiumSubscription | null {
  try {
    const plan = (localStorage.getItem('toptalk_plan') || '').trim() || 'free'
    if (plan === 'free') return null
    let exp = (localStorage.getItem('toptalk_plan_expires') || '').trim()
    if (!exp) {
      try {
        const raw = localStorage.getItem('toptalk_subscription')
        if (raw) {
          const s = JSON.parse(raw) as { expireAt?: string }
          exp = String(s?.expireAt || '').trim()
        }
      } catch {
        /* ignore */
      }
    }
    if (!exp) return null
    const t = new Date(exp).getTime()
    if (!Number.isFinite(t) || t <= Date.now()) return null
    return { planId: plan, expireAt: exp }
  } catch {
    return null
  }
}

export async function syncSubscriptionFromApprovedOrder(email: string): Promise<void> {
  if (!SUPABASE_URL || !ANON_KEY) return
  const e = (email || '').trim()
  if (!e) return

  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/bank-transfer-order/check-order?email=${encodeURIComponent(e)}`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          'x-api-key': ANON_KEY,
        },
      }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.success || !data?.order) return

    const { plan_id: planId, approved_at: approvedAt, created_at: createdAt } = data.order as {
      plan_id?: string
      approved_at?: string | null
      created_at?: string | null
    }
    if (!planId) return

    // 以订单通过时间（或创建时间）为开通时刻；到期规则见 planExpiry.ts（单次 2h30m；其余 N×24h−1 分钟）
    const orderBaseMs = toMs(approvedAt) ?? toMs(createdAt) ?? Date.now()
    const localExpiresMs = toMs(localStorage.getItem('toptalk_plan_expires'))

    const purchasedAtIso = new Date(orderBaseMs).toISOString()
    const expiresAt = computePlanExpiresAtIso(planId, orderBaseMs)
    if (!expiresAt) return

    // 如果本地已有更新/更晚的套餐（例如邀请码兑换），不要被旧订单覆盖
    const localPurchasedMs = toMs(localStorage.getItem('toptalk_plan_purchased'))
    const localPlan = localStorage.getItem('toptalk_plan') || 'free'
    const isLocalActive = !!localExpiresMs && localExpiresMs > Date.now()
    const isOrderNewer = !localPurchasedMs || orderBaseMs > localPurchasedMs
    if (isLocalActive && localPlan !== 'free' && !isOrderNewer) return

    localStorage.setItem('toptalk_plan', planId)
    localStorage.setItem('toptalk_plan_purchased', purchasedAtIso)
    localStorage.setItem('toptalk_plan_expires', expiresAt)
    localStorage.setItem('toptalk_subscription', JSON.stringify({ planId, expireAt: expiresAt }))
    replaceLatestSubscriptionPurchasedAt(purchasedAtIso)
    clearSinglePlanConsumption()

    const stored = localStorage.getItem('toptalk_user')
    const user = stored ? JSON.parse(stored) : {}
    user.plan = planId
    user.planPurchasedAt = purchasedAtIso
    user.planExpiresAt = expiresAt
    localStorage.setItem('toptalk_user', JSON.stringify(user))

    window.dispatchEvent(new Event('storage'))
    window.dispatchEvent(new Event('toptalk_login'))
  } catch {
    // ignore
  }
}

