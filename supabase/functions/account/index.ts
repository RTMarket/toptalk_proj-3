import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProjectUrl, getServiceRoleKey } from '../_shared/supabaseEnv.ts'
import { randomToken, sha256Hex } from '../_shared/accountCrypto.ts'

const supabaseAdmin = createClient(getProjectUrl(), getServiceRoleKey())

// ── Password hashing (WebCrypto, no Worker) ───────────────────────────────
// 格式：pbkdf2_sha256$<iters>$<salt_b64>$<hash_b64>
const PBKDF2_ITERS = 120_000
const PBKDF2_SALT_BYTES = 16
const PBKDF2_HASH_BYTES = 32

function b64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.slice(i, i + CHUNK))
  return btoa(bin)
}

function unb64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pbkdf2Sha256(password: string, salt: Uint8Array, iters: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iters },
    keyMaterial,
    PBKDF2_HASH_BYTES * 8
  )
  return new Uint8Array(bits)
}

async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(PBKDF2_SALT_BYTES)
  crypto.getRandomValues(salt)
  const h = await pbkdf2Sha256(password, salt, PBKDF2_ITERS)
  return `pbkdf2_sha256$${PBKDF2_ITERS}$${b64(salt)}$${b64(h)}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = String(stored || '').split('$')
    if (parts.length !== 4) return false
    const [alg, itRaw, saltB64, hashB64] = parts
    if (alg !== 'pbkdf2_sha256') return false
    const iters = Number(itRaw)
    if (!Number.isFinite(iters) || iters < 10_000) return false
    const salt = unb64(saltB64)
    const expected = unb64(hashB64)
    const actual = await pbkdf2Sha256(password, salt, iters)
    if (actual.length !== expected.length) return false
    // constant-time compare
    let diff = 0
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
    return diff === 0
  } catch {
    return false
  }
}

function json(d: unknown, s = 200) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-api-key',
  }
  return new Response(JSON.stringify(d), { status: s, headers })
}

function normalizeEmail(s: string): string {
  return String(s || '').trim().toLowerCase()
}

function getBearer(req: Request): string {
  const h = req.headers.get('Authorization') || ''
  if (!h.toLowerCase().startsWith('bearer ')) return ''
  return h.slice(7).trim()
}

function normalizeInviteCode(raw: string): string {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

async function requireSession(req: Request): Promise<{ ok: true; userId: string } | { ok: false; res: Response }> {
  const token = getBearer(req)
  if (!token) return { ok: false, res: json({ success: false, message: '未登录' }, 401) }
  const tokenHash = sha256Hex(token)
  const nowIso = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('app_user_sessions')
    .select('user_id, expires_at, revoked_at')
    .eq('session_token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle()
  if (error) return { ok: false, res: json({ success: false, message: error.message }, 500) }
  if (!data?.user_id) return { ok: false, res: json({ success: false, message: '会话已失效，请重新登录' }, 401) }
  return { ok: true, userId: String(data.user_id) }
}

async function verifyEmailCodeOrFail(email: string, code: string, purpose: 'register' | 'reset_password') {
  const e = normalizeEmail(email)
  const c = String(code || '').trim()
  if (!e || !c) return { ok: false as const, message: '缺少邮箱或验证码' }

  const { data, error } = await supabaseAdmin
    .from('email_verification_codes')
    .select('id, expires_at')
    .eq('email', e)
    .eq('purpose', purpose)
    .eq('code', c)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false as const, message: error.message }
  if (!data?.id) return { ok: false as const, message: '验证码错误或已过期' }

  await supabaseAdmin.from('email_verification_codes').delete().eq('id', data.id)
  return { ok: true as const }
}

async function handleRegister(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const nickname = String(body.nickname || '').trim()
  const password = String(body.password || '')
  const code = String(body.code || '').trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ success: false, message: '邮箱格式不正确' }, 400)
  if (!nickname) return json({ success: false, message: '请输入昵称' }, 400)
  if (!password || password.length !== 8) return json({ success: false, message: '密码必须为8位' }, 400)

  const v = await verifyEmailCodeOrFail(email, code, 'register')
  if (!v.ok) return json({ success: false, message: v.message }, 400)

  const { data: exists } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (exists?.id) return json({ success: false, message: '该邮箱已注册，请直接登录' }, 400)

  const passwordHash = await hashPassword(password)
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .insert({ email, nickname, password_hash: passwordHash })
    .select('id, email, nickname, created_at')
    .single()
  if (error) return json({ success: false, message: error.message }, 500)

  return json({ success: true, user: data })
}

async function handleLogin(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const password = String(body.password || '')
  if (!email || !password) return json({ success: false, message: '缺少邮箱或密码' }, 400)
  if (password.length !== 8) return json({ success: false, message: '密码必须为8位' }, 400)

  const { data: user, error } = await supabaseAdmin
    .from('app_users')
    .select('id, email, nickname, password_hash, login_count')
    .eq('email', email)
    .maybeSingle()
  if (error) return json({ success: false, message: error.message }, 500)
  if (!user?.id) return json({ success: false, message: '该邮箱尚未注册，请先注册账户' }, 400)

  const ok = await verifyPassword(password, String(user.password_hash || ''))
  if (!ok) return json({ success: false, message: '密码错误，请检查后重新输入' }, 400)

  // 单会话：新登录会踢下线旧设备（避免断网/断电卡死无法登录）
  await supabaseAdmin
    .from('app_user_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('revoked_at', null)

  const sessionToken = randomToken(32)
  const tokenHash = sha256Hex(sessionToken)
  const now = new Date()
  const expires = new Date(now.getTime() + 30 * 86400000) // 30 天（只做“单会话”，不做2小时滑动过期）

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
  const ua = req.headers.get('user-agent') || ''

  const { error: insErr } = await supabaseAdmin.from('app_user_sessions').insert({
    user_id: user.id,
    session_token_hash: tokenHash,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    ip,
    user_agent: ua,
  })
  if (insErr) return json({ success: false, message: insErr.message }, 500)

  await supabaseAdmin
    .from('app_users')
    .update({
      last_login_at: now.toISOString(),
      login_count: Number(user.login_count || 0) + 1,
    })
    .eq('id', user.id)

  return json({
    success: true,
    sessionToken,
    user: { id: user.id, email: user.email, nickname: user.nickname },
  })
}

async function handleMe(req: Request) {
  const g = await requireSession(req)
  if (!g.ok) return g.res
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('id, email, nickname, created_at, last_login_at, login_count, plan_id, plan_purchased_at, plan_expires_at')
    .eq('id', g.userId)
    .single()
  if (error) return json({ success: false, message: error.message }, 500)
  return json({
    success: true,
    user: {
      id: data.id,
      email: data.email,
      nickname: data.nickname,
      createdAt: (data as any).created_at ?? null,
      lastLoginAt: (data as any).last_login_at ?? null,
      loginCount: (data as any).login_count ?? 0,
      plan: String((data as any).plan_id || 'free'),
      planPurchasedAt: String((data as any).plan_purchased_at || ''),
      planExpiresAt: String((data as any).plan_expires_at || ''),
    },
  })
}

async function handleLogout(req: Request) {
  const token = getBearer(req)
  if (!token) return json({ success: true })
  const tokenHash = sha256Hex(token)
  await supabaseAdmin
    .from('app_user_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('session_token_hash', tokenHash)
  return json({ success: true })
}

/** 与前端 planExpiry.ts 一致：开通时刻起算；单次 2h30m；其余 N×24h−1 分钟 */
const PLAN_NOMINAL_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  enterprise: 30,
  enterprise_pro: 30,
}
const SINGLE_PLAN_MS = 2.5 * 3600 * 1000
const MINUTE_MS = 60 * 1000

function computePlanExpiresAtIso(planId: string, purchasedMs: number): string {
  if (planId === 'single') return new Date(purchasedMs + SINGLE_PLAN_MS).toISOString()
  const days = PLAN_NOMINAL_DAYS[planId] ?? 30
  return new Date(purchasedMs + days * 86400000 - MINUTE_MS).toISOString()
}

async function handleRedeemInvite(req: Request) {
  const g = await requireSession(req)
  if (!g.ok) return g.res

  const body = await req.json().catch(() => ({}))
  const code = normalizeInviteCode(body.code)
  if (!/^[A-Z0-9]{6}$/.test(code)) return json({ success: false, message: '邀请码格式不正确' }, 400)

  const { data: u } = await supabaseAdmin
    .from('app_users')
    .select('id, email, nickname')
    .eq('id', g.userId)
    .maybeSingle()

  const { data: row, error: delErr } = await supabaseAdmin
    .from('invite_codes')
    .delete()
    .eq('code', code)
    .select('code, plan_id, created_at')
    .maybeSingle()
  if (delErr) return json({ success: false, message: delErr.message }, 500)
  if (!row?.plan_id) return json({ success: false, message: 'notfound' }, 404)

  const planId = String((row as any).plan_id || '')
  const nowMs = Date.now()
  const purchasedAt = new Date(nowMs).toISOString()
  const expiresAt = computePlanExpiresAtIso(planId, nowMs)

  const { error: upErr } = await supabaseAdmin
    .from('app_users')
    .update({ plan_id: planId, plan_purchased_at: purchasedAt, plan_expires_at: expiresAt })
    .eq('id', g.userId)
  if (upErr) return json({ success: false, message: upErr.message }, 500)

  await supabaseAdmin.from('invite_redemptions').insert({
    code,
    plan_id: planId,
    user_id: g.userId,
    user_email: (u as any)?.email || null,
    user_nickname: (u as any)?.nickname || null,
    redeemed_at: purchasedAt,
  })

  return json({ success: true, planId, purchasedAt, expiresAt })
}

async function handleResetConfirm(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  const password = String(body.password || '')
  const code = String(body.code || '').trim()
  if (!email) return json({ success: false, message: '缺少邮箱' }, 400)
  if (!password || password.length !== 8) return json({ success: false, message: '密码必须为8位' }, 400)
  const v = await verifyEmailCodeOrFail(email, code, 'reset_password')
  if (!v.ok) return json({ success: false, message: v.message }, 400)

  const passwordHash = await hashPassword(password)
  const { error } = await supabaseAdmin.from('app_users').update({ password_hash: passwordHash }).eq('email', email)
  if (error) return json({ success: false, message: error.message }, 500)
  return json({ success: true })
}

type RoomEvent = 'create' | 'enter' | 'leave' | 'dissolve'

async function handleEvents(req: Request) {
  const g = await requireSession(req)
  if (!g.ok) return g.res

  const body = await req.json().catch(() => ({}))
  const roomId = String(body.roomId || '').trim()
  const roomType = String(body.roomType || '').trim() // instant | premium
  const event = String(body.event || '').trim() as RoomEvent

  if (!roomId || !roomType || !event) return json({ success: false, message: '缺少事件参数' }, 400)
  if (!['instant', 'premium'].includes(roomType)) return json({ success: false, message: 'roomType 无效' }, 400)
  if (!['create', 'enter', 'leave', 'dissolve'].includes(event)) return json({ success: false, message: 'event 无效' }, 400)

  const nowIso = new Date().toISOString()

  // 1) 写事件表
  const { error: e1 } = await supabaseAdmin.from('room_events').insert({
    room_id: roomId,
    room_type: roomType,
    user_id: g.userId,
    event,
  })
  if (e1) return json({ success: false, message: e1.message }, 500)

  // 2) upsert participants
  // enter/create 都视为进入一次
  const incEnter = event === 'enter' || event === 'create'
  if (incEnter) {
    // try select existing
    const { data: rp } = await supabaseAdmin
      .from('room_participants')
      .select('enter_count')
      .eq('room_id', roomId)
      .eq('user_id', g.userId)
      .maybeSingle()

    const nextEnter = Number(rp?.enter_count || 0) + 1
    await supabaseAdmin.from('room_participants').upsert({
      room_id: roomId,
      room_type: roomType,
      user_id: g.userId,
      first_seen_at: rp ? undefined : nowIso,
      last_seen_at: nowIso,
      enter_count: nextEnter,
    })

    // 3) co-presence（简单口径）：同房间已有参与者 → 相互计数
    const { data: others } = await supabaseAdmin
      .from('room_participants')
      .select('user_id')
      .eq('room_id', roomId)
      .neq('user_id', g.userId)
      .limit(50)

    const otherIds = (others || []).map(o => String((o as any).user_id)).filter(Boolean)
    for (const otherId of otherIds) {
      // user -> other
      const { data: rel1 } = await supabaseAdmin
        .from('user_co_presence')
        .select('room_count')
        .eq('user_id', g.userId)
        .eq('other_user_id', otherId)
        .maybeSingle()
      const rc1 = Number((rel1 as any)?.room_count || 0) + 1
      await supabaseAdmin.from('user_co_presence').upsert({
        user_id: g.userId,
        other_user_id: otherId,
        last_met_at: nowIso,
        room_count: rc1,
      })

      // other -> user
      const { data: rel2 } = await supabaseAdmin
        .from('user_co_presence')
        .select('room_count')
        .eq('user_id', otherId)
        .eq('other_user_id', g.userId)
        .maybeSingle()
      const rc2 = Number((rel2 as any)?.room_count || 0) + 1
      await supabaseAdmin.from('user_co_presence').upsert({
        user_id: otherId,
        other_user_id: g.userId,
        last_met_at: nowIso,
        room_count: rc2,
      })
    }
  } else {
    // leave/dissolve：只更新 last_seen_at
    await supabaseAdmin
      .from('room_participants')
      .update({ last_seen_at: nowIso })
      .eq('room_id', roomId)
      .eq('user_id', g.userId)
  }

  return json({ success: true })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-api-key',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop() || ''

  try {
    if (req.method === 'POST' && path === 'register') return await handleRegister(req)
    if (req.method === 'POST' && path === 'login') return await handleLogin(req)
    if (req.method === 'GET' && path === 'me') return await handleMe(req)
    if (req.method === 'POST' && path === 'logout') return await handleLogout(req)
    if (req.method === 'POST' && (path === 'redeem-invite' || url.pathname.endsWith('/redeem-invite'))) return await handleRedeemInvite(req)
    if (req.method === 'POST' && path === 'reset-confirm') return await handleResetConfirm(req)
    if (req.method === 'POST' && path === 'events') return await handleEvents(req)
    return json({ message: 'Not found' }, 404)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ success: false, message: msg }, 500)
  }
})

