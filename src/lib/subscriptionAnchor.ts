/**
 * 个人中心 / 订阅展示：仅以「最近一次有效开通」为准（与之前是日/周/月/企业/单次等无关）。
 * 邀请码兑换或订单同步会更新锚点时间；/me 若带回更早的 planPurchasedAt，视为旧记录，勿覆盖本地。
 *
 * 注意：「套餐何时算结束」因类型而异——仅 single 在创建权已用后还有「会话结束即本地结束」逻辑（见 singlePlanConsumption）；
 * 日/周/月/企业等非单次套餐仅以有效期到期为结束，不由本文件实现，但锚点仍用于防止「旧开通」在 /me 合并时顶掉当前态。
 */

const KEY = 'toptalk_latest_subscription_purchased_at'

function parseMs(iso: string | null | undefined): number | null {
  const s = String(iso || '').trim()
  if (!s) return null
  const t = new Date(s).getTime()
  return Number.isFinite(t) ? t : null
}

/** 邀请码兑换、订单写入等：以本次开通为最新一条 */
export function replaceLatestSubscriptionPurchasedAt(iso: string): void {
  const ms = parseMs(iso)
  if (ms == null) return
  try {
    localStorage.setItem(KEY, new Date(ms).toISOString())
  } catch {
    /* ignore */
  }
}

/** /me 同步成功写入本地后：若服务端开通时间更新，则抬高锚点（跨设备） */
export function bumpLatestSubscriptionPurchasedAtIfNewer(iso: string): void {
  const ms = parseMs(iso)
  if (ms == null) return
  try {
    const cur = getLatestSubscriptionPurchasedMs()
    if (cur == null || ms > cur) {
      localStorage.setItem(KEY, new Date(ms).toISOString())
    }
  } catch {
    /* ignore */
  }
}

export function clearLatestSubscriptionPurchasedAt(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function getLatestSubscriptionPurchasedMs(): number | null {
  try {
    return parseMs(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

/**
 * 仅比较「服务端本条记录的 planPurchasedAt」与本地锚点（须二者均可解析）。
 * 服务端时间严格早于锚点 → 已被后续开通覆盖，勿写回。
 */
export function isServerPlanOlderThanLatestSubscription(serverPurchasedAt: string | null | undefined): boolean {
  const anchor = getLatestSubscriptionPurchasedMs()
  if (anchor == null) return false
  const sm = parseMs(serverPurchasedAt)
  if (sm == null) return false
  return sm < anchor
}

/**
 * 本地已记过「有过一次较新的开通」（锚点存在），当前本地套餐为 free，
 * 但服务端仍返回付费套餐且未带 planPurchasedAt → 无法对齐时间线，勿用其顶掉免费态。
 */
export function shouldRejectServerPlanWithoutPurchasedAtWhenLocalFree(
  nextPlan: string,
  serverPurchasedAt: string | null | undefined,
  localPlan: string,
): boolean {
  if (nextPlan === 'free') return false
  if (localPlan !== 'free') return false
  if (String(serverPurchasedAt || '').trim()) return false
  return getLatestSubscriptionPurchasedMs() != null
}
