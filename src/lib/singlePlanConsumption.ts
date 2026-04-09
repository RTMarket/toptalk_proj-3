/** 单次高级套餐：以「本次开通的 purchased 戳」判断是否已消耗（与 PremiumRoomSelection 一致） */

export function getSinglePurchaseStamp(): string {
  return (localStorage.getItem('toptalk_plan_purchased') || '').trim() || 'unknown';
}

export function isSingleConsumedForCurrentPurchase(): boolean {
  try {
    const consumedAt = (localStorage.getItem('toptalk_single_consumed_at') || '').trim();
    const consumedPurchase = (localStorage.getItem('toptalk_single_consumed_purchase') || '').trim();
    if (!consumedAt) return false;
    return consumedPurchase === getSinglePurchaseStamp();
  } catch {
    return false;
  }
}
