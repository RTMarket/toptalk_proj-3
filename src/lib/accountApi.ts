import { normalizeClientAnonKey } from './anonKey'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
const ANON_KEY = normalizeClientAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

export type AppUser = { id: string; email: string; nickname: string }

function apiBase() {
  return `${SUPABASE_URL}/functions/v1/account`
}

export function getSessionToken(): string {
  return (localStorage.getItem('toptalk_session_token') || '').trim()
}

export function setSessionToken(t: string) {
  localStorage.setItem('toptalk_session_token', t)
}

export function clearSessionToken() {
  localStorage.removeItem('toptalk_session_token')
}

function anonHeaders(): Record<string, string> {
  // 走 Supabase Functions 统一网关，带上 apikey 便于通过网关
  return {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    'x-api-key': ANON_KEY,
  }
}

function sessionHeaders(): Record<string, string> {
  const t = getSessionToken()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${t}`,
  }
}

export async function accountRegister(input: { email: string; nickname: string; password: string; code: string }) {
  const res = await fetch(`${apiBase()}/register`, {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.success) throw new Error(data?.message || `注册失败（HTTP ${res.status}）`)
  return data.user as AppUser
}

export async function accountLogin(input: { email: string; password: string }) {
  const res = await fetch(`${apiBase()}/login`, {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.success) throw new Error(data?.message || `登录失败（HTTP ${res.status}）`)
  const sessionToken = String(data.sessionToken || '')
  if (!sessionToken) throw new Error('登录失败：缺少 sessionToken')
  setSessionToken(sessionToken)
  return data.user as AppUser
}

export async function accountMe() {
  const res = await fetch(`${apiBase()}/me`, {
    method: 'GET',
    headers: sessionHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.success) throw new Error(data?.message || `请求失败（HTTP ${res.status}）`)
  return data.user as AppUser
}

export async function accountLogout() {
  try {
    await fetch(`${apiBase()}/logout`, { method: 'POST', headers: sessionHeaders() })
  } catch {
    // ignore
  } finally {
    clearSessionToken()
  }
}

export async function postRoomEvent(input: { roomId: string; roomType: 'instant' | 'premium'; event: 'create' | 'enter' | 'leave' | 'dissolve' }) {
  const res = await fetch(`${apiBase()}/events`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.success) throw new Error(data?.message || `上报失败（HTTP ${res.status}）`)
}

