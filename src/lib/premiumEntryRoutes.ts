import { readLivePremiumSubscription } from './subscription'

/** 高级房列表入口分档：与产品「免费 / 单次 / 个人订阅 / 企业」四条线对齐，便于分路由框定规则 */
export type PremiumEntryTier = 'free' | 'single' | 'personal' | 'enterprise'

const PATH: Record<PremiumEntryTier, string> = {
  free: '/rooms-premium/free',
  single: '/rooms-premium/single',
  personal: '/rooms-premium/personal',
  enterprise: '/rooms-premium/enterprise',
}

export function premiumEntryPath(tier: PremiumEntryTier): string {
  return PATH[tier]
}

export function planIdToPremiumEntryTier(planId: string | null | undefined): PremiumEntryTier {
  const p = String(planId || '').trim().toLowerCase()
  if (!p || p === 'free') return 'free'
  if (p === 'single') return 'single'
  if (p === 'daily' || p === 'weekly' || p === 'monthly') return 'personal'
  if (p === 'enterprise' || p === 'enterprise_pro') return 'enterprise'
  return 'free'
}

/** 按当前套餐 id 解析应进入的列表页路径（已付费且未过期） */
export function resolvePremiumEntryPathForPlanId(planId: string | null | undefined): string {
  return premiumEntryPath(planIdToPremiumEntryTier(planId))
}

/**
 * 离开高级房、解散后回到列表：按本地当前有效套餐选路，避免回到「错误分档」再靠分支兜底。
 */
export function getPremiumListPathForCurrentUser(): string {
  const live = readLivePremiumSubscription()
  if (live) return resolvePremiumEntryPathForPlanId(live.planId)
  return PATH.free
}
