/** 即时聊天室：房间有效期固定为 15 分钟（秒） */
export const INSTANT_ROOM_SECONDS = 15 * 60

/** 检测是否为浏览器刷新（F5 / 刷新按钮），用于「刷新 = 离开房间」 */
export function isNavigationReload(): boolean {
  if (typeof performance === 'undefined') return false
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return nav?.type === 'reload'
}

/** 房间是否已到结束时间（与 roomLeft 状态无关，避免 roomMeta 刚写入时 roomLeft 仍为 0 误判） */
export function isRoomWallClockExpired(meta: { createdAt: string; destroySeconds: number }): boolean {
  const created = new Date(meta.createdAt).getTime()
  const totalMs = Math.max(0, Number(meta.destroySeconds) || 0) * 1000
  const end = created + totalMs
  return Number.isFinite(created) && Number.isFinite(end) && Date.now() >= end
}

/** 从列表页 SPA 进入聊天室前写入；聊天页消费后可忽略「整站曾 reload」误判（否则一进房就被当刷新踢回列表且 Realtime 不订阅） */
const PENDING_INSTANT_NAV = 'toptalk_pending_instant_chat_nav'
const PENDING_PREMIUM_NAV = 'toptalk_pending_premium_chat_nav'

export function markPendingInstantChatNavigation(roomId: string): void {
  try {
    const id = String(roomId || '').trim()
    if (!id) return
    sessionStorage.setItem(PENDING_INSTANT_NAV, id)
  } catch {
    /* ignore */
  }
}

export function consumePendingInstantChatNavigation(roomId: string): boolean {
  try {
    const id = String(roomId || '').trim()
    if (!id) return false
    if (sessionStorage.getItem(PENDING_INSTANT_NAV) !== id) return false
    sessionStorage.removeItem(PENDING_INSTANT_NAV)
    return true
  } catch {
    return false
  }
}

export function markPendingPremiumChatNavigation(roomId: string): void {
  try {
    const id = String(roomId || '').trim()
    if (!id || id === '------') return
    sessionStorage.setItem(PENDING_PREMIUM_NAV, id)
  } catch {
    /* ignore */
  }
}

export function consumePendingPremiumChatNavigation(roomId: string): boolean {
  try {
    const id = String(roomId || '').trim()
    if (!id || id === '------') return false
    if (sessionStorage.getItem(PENDING_PREMIUM_NAV) !== id) return false
    sessionStorage.removeItem(PENDING_PREMIUM_NAV)
    return true
  } catch {
    return false
  }
}
