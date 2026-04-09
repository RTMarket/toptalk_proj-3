/** 即时聊天室：房间有效期固定为 15 分钟（秒） */
export const INSTANT_ROOM_SECONDS = 15 * 60

/** 检测是否为浏览器刷新（F5 / 刷新按钮），用于「刷新 = 离开房间」 */
export function isNavigationReload(): boolean {
  if (typeof performance === 'undefined') return false
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return nav?.type === 'reload'
}
