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
