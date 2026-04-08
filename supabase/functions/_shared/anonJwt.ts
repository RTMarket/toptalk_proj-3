/**
 * 匿名接口鉴权：校验请求里带的是 **anon public** JWT（非 service_role），且 ref 与当前项目一致。
 * 不依赖 Edge Secrets 中的 ANON_KEY 与前端逐字相同，避免 Secrets 命名/优先级导致 401。
 * （网关默认 verify_jwt 时，无效签名不会到达本函数。）
 */
import { normalizeKey } from './supabaseEnv.ts'

function getBearerToken(req: Request): string {
  const auth = req.headers.get('Authorization') || ''
  if (!auth.toLowerCase().startsWith('bearer ')) return ''
  return normalizeKey(auth.slice(7))
}

/** 从 Authorization / apikey / x-api-key 取 JWT 字符串 */
export function getClientJwt(req: Request): string {
  const a = getBearerToken(req)
  const b = normalizeKey(req.headers.get('apikey') || '')
  const c = normalizeKey(req.headers.get('x-api-key') || '')
  return a || b || c
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4
    if (pad) b64 += '='.repeat(4 - pad)
    const json = atob(b64)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

/** 从 https://xxx.supabase.co 解析 project ref */
export function extractSupabaseProjectRef(projectUrl: string): string {
  const u = projectUrl.trim()
  if (!u) return ''
  try {
    const host = new URL(u).hostname
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return m ? m[1] : ''
  } catch {
    return ''
  }
}

export type AnonGateResult =
  | { ok: true }
  | { ok: false; status: number; message: string }

/** 要求 anon JWT，且（若可解析）ref 与 projectUrl 一致 */
export function assertAnonJwtForProject(req: Request, projectUrl: string): AnonGateResult {
  const url = projectUrl.trim()
  if (!url) {
    return { ok: false, status: 500, message: '服务端未配置 API_URL / SUPABASE_URL' }
  }
  const token = getClientJwt(req)
  if (!token) {
    return {
      ok: false,
      status: 401,
      message: '未授权：请在请求中携带 anon public 密钥（Authorization: Bearer 或 apikey）',
    }
  }
  const payload = decodeJwtPayload(token)
  if (!payload) {
    return { ok: false, status: 401, message: '未授权：密钥格式无效' }
  }
  const role = String(payload.role ?? '')
  if (role === 'service_role') {
    return {
      ok: false,
      status: 401,
      message: '未授权：请使用 Settings → API 的 anon public 密钥，勿使用 service_role',
    }
  }
  if (role !== 'anon') {
    return {
      ok: false,
      status: 401,
      message: '未授权：请使用 anon public 密钥（role 须为 anon）',
    }
  }
  const ref = String(payload.ref ?? '')
  const expected = extractSupabaseProjectRef(url)
  if (expected && ref && ref !== expected) {
    return {
      ok: false,
      status: 401,
      message: '未授权：密钥对应项目与当前 Edge 配置的 API_URL 不一致，请检查 VITE_SUPABASE_URL',
    }
  }
  return { ok: true }
}
