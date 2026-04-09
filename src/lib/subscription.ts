import { normalizeClientAnonKey } from './anonKey'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
const ANON_KEY = normalizeClientAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

const PLAN_EXPIRY_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  // 单次高级：不按时间过期，而是“创建次数=1”消耗（创建一次高级聊天室后即视为用完）。
  // 这里给一个很长的有效期，避免用户“买了但还没用”却因为时间到了而失效。
  // 真正的限制在 PremiumRoomSelection.tsx 的单次消耗逻辑里。
  single: 3650,
  enterprise: 30,
  enterprise_pro: 30,
}

function toMs(iso?: string | null): number | null {
  if (!iso) return null
  const t = new Date(String(iso)).getTime()
  return Number.isFinite(t) ? t : null
}

/** 以中国时区（UTC+8）的“当天 00:00”作为计时起点 */
function startOfDayCstMs(epochMs: number): number {
  const offset = 8 * 3600 * 1000
  return Math.floor((epochMs + offset) / 86400000) * 86400000 - offset
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
    const days = PLAN_EXPIRY_DAYS[planId] ?? 30

    // 以订单通过时间（或创建时间）为准计算有效期。
    // 注意：对公转账渠道关闭后，这里主要用于兼容历史订单同步；不做“剩余时间叠加”，避免出现 58 天等超出套餐周期的展示。
    const orderBaseMs = startOfDayCstMs(toMs(approvedAt) ?? toMs(createdAt) ?? Date.now())
    const localExpiresMs = toMs(localStorage.getItem('toptalk_plan_expires'))

    const purchasedAtIso = new Date(orderBaseMs).toISOString()
    const expiresAt = new Date(orderBaseMs + days * 86400000).toISOString()

    // 如果本地已有更新/更晚的套餐（例如邀请码兑换），不要被旧订单覆盖
    const localPurchasedMs = toMs(localStorage.getItem('toptalk_plan_purchased'))
    const localPlan = localStorage.getItem('toptalk_plan') || 'free'
    const isLocalActive = !!localExpiresMs && localExpiresMs > Date.now()
    const isOrderNewer = !localPurchasedMs || orderBaseMs > localPurchasedMs
    if (isLocalActive && localPlan !== 'free' && !isOrderNewer) return

    localStorage.setItem('toptalk_plan', planId)
    localStorage.setItem('toptalk_plan_purchased', purchasedAtIso)
    localStorage.setItem('toptalk_plan_expires', expiresAt)

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

