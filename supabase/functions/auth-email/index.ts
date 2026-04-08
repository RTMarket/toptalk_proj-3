// 注册邮箱验证码：发送 / 校验（腾讯云 SES）
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSesEnv, sendSesEmail, sesConfigured } from '../_shared/tencentSes.ts'
import { assertAnonJwtForProject } from '../_shared/anonJwt.ts'
import { getProjectUrl, getServiceRoleKey } from '../_shared/supabaseEnv.ts'

const supabaseAdmin = createClient(getProjectUrl(), getServiceRoleKey())

function json(d: unknown, s = 200) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-api-key',
  }
  return new Response(JSON.stringify(d), { status: s, headers })
}

/** 校验请求携带 Supabase anon public JWT（role=anon），与 API_URL 项目 ref 一致；无需在 Secrets 里再配 ANON_KEY */
function requireAnon(req: Request) {
  const g = assertAnonJwtForProject(req, getProjectUrl())
  if (!g.ok) return { ok: false, res: json({ success: false, message: g.message }, g.status) }
  return { ok: true as const }
}

function random6(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function handleSendRegisterCode(req: Request) {
  const gate = requireAnon(req)
  if (!gate.ok) return gate.res
  if (!sesConfigured()) {
    return json({ success: false, message: '邮件服务未配置（请在 Functions 环境变量中配置 TENCENT_*）' }, 500)
  }

  const { email } = await req.json().catch(() => ({}))
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return json({ success: false, message: '邮箱格式不正确' }, 400)
  }

  const e = String(email).trim().toLowerCase()
  const code = random6()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: insErr } = await supabaseAdmin.from('email_verification_codes').insert({
    email: e,
    code,
    purpose: 'register',
    expires_at: expiresAt,
  })
  if (insErr) return json({ success: false, message: '保存验证码失败: ' + insErr.message }, 500)

  const env = getSesEnv()
  const subject = 'TopTalk 注册验证码'
  const text = `您的注册验证码是：${code}\n\n10 分钟内有效。如非本人操作请忽略。\n\nTopTalk`
  const html = `<p>您的注册验证码是：<strong>${code}</strong></p><p>10 分钟内有效。如非本人操作请忽略。</p><p>TopTalk</p>`

  const sent = await sendSesEmail({
    secretId: env.secretId,
    secretKey: env.secretKey,
    region: env.region,
    fromAddress: env.fromAddress,
    to: [e],
    subject,
    textBody: text,
    htmlBody: html,
    templateId: env.otpTemplateId,
    templateData: { code },
  })
  if (!sent.ok) {
    return json({ success: false, message: sent.message || '邮件发送失败' }, 500)
  }
  return json({ success: true, message: '验证码已发送' })
}

async function handleVerifyRegisterCode(req: Request) {
  const gate = requireAnon(req)
  if (!gate.ok) return gate.res

  const { email, code } = await req.json().catch(() => ({}))
  if (!email || !code) return json({ success: false, message: '缺少邮箱或验证码' }, 400)

  const e = String(email).trim().toLowerCase()
  const c = String(code).trim()

  const { data, error } = await supabaseAdmin
    .from('email_verification_codes')
    .select('id, expires_at')
    .eq('email', e)
    .eq('purpose', 'register')
    .eq('code', c)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return json({ success: false, message: error.message }, 500)
  if (!data) return json({ success: false, message: '验证码错误或已过期' }, 400)

  await supabaseAdmin.from('email_verification_codes').delete().eq('id', data.id)

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

  const path = req.url.split('/').pop()?.split('?')[0] || ''
  try {
    if (req.method === 'POST' && path === 'send-register-code') return await handleSendRegisterCode(req)
    if (req.method === 'POST' && path === 'verify-register-code') return await handleVerifyRegisterCode(req)
    return json({ message: 'Not found' }, 404)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ success: false, message: msg }, 500)
  }
})
