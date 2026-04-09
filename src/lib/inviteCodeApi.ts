import { getSessionToken } from './accountApi'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''

export function normalizeInviteCode(raw: string): string {
  return (raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

export function isValidInviteCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code)
}

export type RedeemInviteResult = {
  planId: string
  purchasedAt: string
  expiresAt: string
}

export async function redeemInviteCode(code: string): Promise<RedeemInviteResult> {
  if (!SUPABASE_URL) throw new Error('缺少 VITE_SUPABASE_URL')
  const t = getSessionToken()
  if (!t) throw new Error('请先登录后再使用邀请码')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/account/redeem-invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${t}`,
    },
    body: JSON.stringify({ code: normalizeInviteCode(code) }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.success) throw new Error(data?.message || `兑换失败（HTTP ${res.status}）`)

  const planId = String(data.planId || '')
  const purchasedAt = String(data.purchasedAt || '')
  const expiresAt = String(data.expiresAt || '')
  if (!planId || !expiresAt) throw new Error('兑换失败：返回数据不完整')

  return { planId, purchasedAt, expiresAt }
}

