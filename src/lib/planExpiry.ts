/**
 * 套餐到期时间（与产品规则一致）：
 * - 开通时刻起算（非按自然日 0:00）
 * - 单次：开通后 2 小时 30 分钟
 * - 日/周/月/企业：N×24 小时 − 1 分钟（开通瞬间显示为 23:59 / 6d23:59 / 29d23:59 …）
 */

export const SINGLE_PLAN_DURATION_MS = 2.5 * 60 * 60 * 1000

const NOMINAL_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  enterprise: 30,
  enterprise_pro: 30,
}

/** 1 分钟，用于「整段 −1 分钟」的展示口径 */
const MINUTE_MS = 60 * 1000

export function computePlanExpiresAtMs(planId: string, purchasedAtMs: number): number | null {
  if (!Number.isFinite(purchasedAtMs)) return null
  if (planId === 'single') return purchasedAtMs + SINGLE_PLAN_DURATION_MS
  const days = NOMINAL_DAYS[planId]
  if (!days) return null
  return purchasedAtMs + days * 86400000 - MINUTE_MS
}

export function computePlanExpiresAtIso(planId: string, purchasedAtMs: number): string | null {
  const ms = computePlanExpiresAtMs(planId, purchasedAtMs)
  if (ms == null) return null
  return new Date(ms).toISOString()
}
