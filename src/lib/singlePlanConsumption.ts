/** 单次高级套餐：以「本次开通的 purchased 戳」判断是否已消耗（与 PremiumRoomSelection 一致） */

/** 单次会话已本地结束：防止 `/me` 仍返回 single 时把已结束的权益写回本地 */
export const SINGLE_SESSION_ENDED_KEY = 'toptalk_single_session_ended'

export function clearSingleSessionEndedGuard(): void {
  try {
    localStorage.removeItem(SINGLE_SESSION_ENDED_KEY)
  } catch {
    /* ignore */
  }
}

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
    const plan = (localStorage.getItem('toptalk_plan') || '').trim();
    if (plan !== 'single') return false;

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

/**
 * 单次套餐：用户已用掉「创建 1 次高级房」后，当**创建者**侧房间会话结束（解散或墙钟到期），
 * 本地立即视为套餐结束（与个人中心倒计时归零一致），便于再次兑换单次或其它套餐。
 * 未消耗创建权（例如仅加入他人房间）不调用本函数。
 */
export function expireSinglePlanAfterPremiumRoomSessionEnd(): void {
  try {
    const plan = (localStorage.getItem('toptalk_plan') || '').trim();
    if (plan !== 'single') return;
    if (!isSingleConsumedForCurrentPurchase()) return;

    clearSinglePlanConsumption();
    try {
      localStorage.setItem(SINGLE_SESSION_ENDED_KEY, '1');
      localStorage.setItem('toptalk_plan', 'free');
      localStorage.removeItem('toptalk_plan_purchased');
      localStorage.removeItem('toptalk_plan_expires');
      localStorage.removeItem('toptalk_subscription');
    } catch {
      /* ignore */
    }

    const raw = localStorage.getItem('toptalk_user');
    if (raw) {
      try {
        const u = JSON.parse(raw) as Record<string, unknown>;
        u.plan = 'free';
        delete u.planPurchasedAt;
        delete u.planExpiresAt;
        localStorage.setItem('toptalk_user', JSON.stringify(u));
      } catch {
        /* ignore */
      }
    }
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('toptalk_login'));
  } catch {
    /* ignore */
  }
}
