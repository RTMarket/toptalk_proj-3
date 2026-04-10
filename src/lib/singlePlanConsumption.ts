/** 单次高级套餐：以「本次开通的 purchased 戳」判断是否已消耗（与 PremiumRoomSelection 一致） */

export function getSinglePurchaseStamp(): string {
  return (localStorage.getItem('toptalk_plan_purchased') || '').trim() || 'unknown';
}

/** 新开通/兑换后应调用，避免旧浏览器里「unknown」戳与历史消耗记录误匹配 */
export function clearSinglePlanConsumption(): void {
  try {
    localStorage.removeItem('toptalk_single_consumed_at')
    localStorage.removeItem('toptalk_single_consumed_purchase')
  } catch {
    /* ignore */
  }
}

export function isSingleConsumedForCurrentPurchase(): boolean {
  try {
    const stamp = getSinglePurchaseStamp()
    const consumedAt = (localStorage.getItem('toptalk_single_consumed_at') || '').trim();
    const consumedPurchase = (localStorage.getItem('toptalk_single_consumed_purchase') || '').trim();
    if (!consumedAt) return false;

    // 正常：开通戳与消耗时记录的戳一致
    if (stamp && stamp !== 'unknown') {
      return consumedPurchase === stamp;
    }

    // 无开通戳（或仍为占位 unknown）：只有历史上用 unknown 记过消耗时才视为已消耗，避免「从未开通却永久 blocked」；
    // 新兑换单次会写入真实 purchasedAt 并 clearSinglePlanConsumption，脱离该分支
    return consumedPurchase === 'unknown';
  } catch {
    return false;
  }
}
