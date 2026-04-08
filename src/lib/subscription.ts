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

    const { plan_id: planId } = data.order as { plan_id?: string }
    if (!planId) return
    const now = new Date()
    const days = PLAN_EXPIRY_DAYS[planId] ?? 30
    const expiresAt = new Date(now.getTime() + days * 86400000).toISOString()

    localStorage.setItem('toptalk_plan', planId)
    localStorage.setItem('toptalk_plan_purchased', now.toISOString())
    localStorage.setItem('toptalk_plan_expires', expiresAt)

    const stored = localStorage.getItem('toptalk_user')
    const user = stored ? JSON.parse(stored) : {}
    user.plan = planId
    user.planPurchasedAt = now.toISOString()
    user.planExpiresAt = expiresAt
    localStorage.setItem('toptalk_user', JSON.stringify(user))

    window.dispatchEvent(new Event('storage'))
    window.dispatchEvent(new Event('toptalk_login'))
  } catch {
    // ignore
  }
}

