import { getSessionToken } from './accountApi'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''

function getAdminToken(): string {
  return sessionStorage.getItem('toptalk_admin_token') || localStorage.getItem('toptalk_admin_token') || ''
}

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

export type GeneratedInviteCode = {
  code: string
  planId: string
  createdAt: string
  expiresAt?: string | null
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
    body: JSON.stringify({ code }),

