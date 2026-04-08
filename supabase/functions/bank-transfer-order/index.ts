// bank-transfer-order/index.ts
// 银行转账订单：创建 + 管理端审核

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSesEnv, sendSesEmail, sesConfigured } from '../_shared/tencentSes.ts'
import { assertAnonJwtForProject } from '../_shared/anonJwt.ts'
import { getProjectUrl, getServiceRoleKey } from '../_shared/supabaseEnv.ts'

const ADMIN_TOKEN = Deno.env.get('ADMIN_TOKEN') || ''

/** 匿名接口：校验 anon public JWT（role=anon），与 API_URL 项目一致 */
function requireAnonKey(req: Request): Response | null {
  const g = assertAnonJwtForProject(req, getProjectUrl())
  if (!g.ok) return json({ success: false, message: g.message }, g.status)
  return null
}

// Service Role 客户端（用于写入 Storage + DB）
const supabaseAdmin = createClient(getProjectUrl(), getServiceRoleKey())
const BUCKET_NAME = 'payment-proofs'

const PLAN_AMOUNT: Record<string, number> = {
  daily: 15, weekly: 39, monthly: 99,
  single: 9.9, enterprise: 299, enterprise_pro: 399,
}
const PLAN_NAME: Record<string, string> = {
  daily: '日卡', weekly: '周卡', monthly: '月卡',
  single: '单次高级', enterprise: '企业版', enterprise_pro: '企业版 Pro',
}

function genOrderNo(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return [
    'TT', d.getFullYear(),
    pad(d.getMonth()+1), pad(d.getDate()),
    pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds()),
    Math.random().toString().slice(2, 6)
  ].join('')
}

function json(d: any, s = 200, isCors = false) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
  if (isCors || true) {
    headers['Access-Control-Allow-Origin'] = '*'
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, apikey, x-api-key'
  }
  return new Response(JSON.stringify(d), { status: s, headers })
}

function getBearerToken(req: Request): string {
  const auth = req.headers.get('Authorization') || ''
  if (!auth.toLowerCase().startsWith('bearer ')) return ''
  return auth.slice(7).trim()
}

function requireAdmin(req: Request) {
  if (!ADMIN_TOKEN) return { ok: false, res: json({ success: false, message: '管理员功能未配置' }, 500) }
  const token = getBearerToken(req)
  if (!token || token !== ADMIN_TOKEN) return { ok: false, res: json({ success: false, message: '未授权' }, 401) }
  return { ok: true as const }
}

// ── POST /create: 用户提交订单 ────────────────────────────────
async function handleCreate(req: Request) {
  const deny = requireAnonKey(req)
  if (deny) return deny

  let planId: string
  let screenshotBase64: string | null = null
  let screenshotExt = 'jpg'
  let userEmail = ''
  let userNickname = ''

  const ct = req.headers.get('Content-Type') || ''

  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    planId = fd.get('planId') as string
    userEmail = (fd.get('userEmail') as string) || ''
    userNickname = (fd.get('userNickname') as string) || ''
    const file = fd.get('screenshot') as File | null
    if (file && file.size > 0) {
      screenshotExt = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const buf = await file.arrayBuffer()
      screenshotBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
    }
  } else {
    const body = await req.json()
    planId = body.planId
    userEmail = body.userEmail || ''
    userNickname = body.userNickname || ''
    screenshotBase64 = body.screenshotBase64 || null
    screenshotExt = body.screenshotExt || 'jpg'
  }

  if (!planId || PLAN_AMOUNT[planId] === undefined) {
    return json({ success: false, message: '无效的套餐' }, 400)
  }

  const amount = PLAN_AMOUNT[planId]
  const planName = PLAN_NAME[planId]
  const orderNo = genOrderNo()

  // 上传截图（base64 → 二进制 → Storage）
  let screenshotUrl = ''
  if (screenshotBase64) {
    const filePath = `${orderNo}.${screenshotExt}`
    const binaryStr = atob(screenshotBase64)
    const buf = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) buf[i] = binaryStr.charCodeAt(i)

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buf, {
        contentType: `image/${screenshotExt === 'jpg' ? 'jpeg' : screenshotExt}`,
        upsert: true,
      })

    if (upErr) {
      return json({ success: false, message: '截图上传失败: ' + upErr.message }, 500)
    }
    const { data } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(filePath)
    screenshotUrl = data.publicUrl
  }

  // 写入数据库
  const { error: dbErr } = await supabaseAdmin
    .from('payment_orders')
    .insert({
      order_no: orderNo,
      plan_id: planId,
      plan_name: planName,
      amount,
      bank_transfer_screenshot_url: screenshotUrl,
      status: 'pending',
      user_email: userEmail,
      user_nickname: userNickname,
    })

  if (dbErr) return json({ success: false, message: '订单创建失败: ' + dbErr.message }, 500)
  return json({ success: true, orderNo, amount, planName, screenshotUrl })
}

// ── GET /check-order: 用户查自己的订单状态 ──────────────────────
async function handleCheckOrder(req: Request) {
  const deny = requireAnonKey(req)
  if (deny) return deny
  const url = new URL(req.url)
  const email = url.searchParams.get('email') || ''
  if (!email) return json({ success: false, message: '缺少邮箱' }, 400)
  const { data, error } = await supabaseAdmin
    .from('payment_orders')
    .select('plan_id, plan_name, status, approved_at')
    .eq('user_email', email)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(1)
    .single()
  if (error && error.code !== 'PGRST116') return json({ success: false, message: error.message }, 500)
  return json({ success: true, order: data || null })
}

// ── GET /orders: 管理员查询 ──────────────────────────────────
async function handleList(req: Request) {
  const admin = requireAdmin(req)
  if (!admin.ok) return admin.res
  const url = new URL(req.url)
  const status = url.searchParams.get('status') || 'pending'
  const { data, error } = await supabaseAdmin
    .from('payment_orders')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return json({ success: false, message: error.message }, 500)
  return json({ success: true, orders: data })
}

// ── POST /approve: 管理员审核 ────────────────────────────────
async function handleApprove(req: Request) {
  const admin = requireAdmin(req)
  if (!admin.ok) return admin.res
  const { orderId, action, remark } = await req.json()
  if (!orderId || !action) return json({ success: false, message: '缺少参数' }, 400)
  const newStatus = action === 'approve' ? 'approved' : 'rejected'

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('payment_orders')
    .select('id, order_no, user_email, plan_name, amount, status')
    .eq('id', orderId)
    .maybeSingle()
  if (fetchErr) return json({ success: false, message: fetchErr.message }, 500)
  if (!row) return json({ success: false, message: '订单不存在' }, 404)

  const nowIso = new Date().toISOString()
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    approved_at: nowIso,
  }
  if (typeof remark === 'string' && remark.trim()) {
    updatePayload.admin_remark = remark.trim()
  }

  const { error } = await supabaseAdmin
    .from('payment_orders')
    .update(updatePayload)
    .eq('id', orderId)
  if (error) return json({ success: false, message: error.message }, 500)

  // 审核结果邮件通知（腾讯云 SES）
  const to = (row.user_email as string) || ''
  if (to && sesConfigured()) {
    const env = getSesEnv()
    const isOk = newStatus === 'approved'
    const subject = isOk
      ? `【TopTalk】订单 ${row.order_no} 审核已通过`
      : `【TopTalk】订单 ${row.order_no} 审核未通过`
    const text = isOk
      ? `您好，\n\n您的转账订单已审核通过。\n订单号：${row.order_no}\n套餐：${row.plan_name}\n金额：¥${row.amount}\n\n请重新打开 TopTalk 网站，套餐状态将自动同步。\n\nTopTalk`
      : `您好，\n\n您的转账订单未通过审核。\n订单号：${row.order_no}\n套餐：${row.plan_name}\n金额：¥${row.amount}\n${remark?.trim() ? `说明：${remark.trim()}\n` : ''}\n如有疑问请联系客服。\n\nTopTalk`
    const html = isOk
      ? `<p>您好，</p><p>您的转账订单已<strong>审核通过</strong>。</p><ul><li>订单号：<code>${row.order_no}</code></li><li>套餐：${row.plan_name}</li><li>金额：¥${row.amount}</li></ul><p>请重新打开 TopTalk 网站，套餐状态将自动同步。</p><p>TopTalk</p>`
      : `<p>您好，</p><p>您的转账订单<strong>未通过审核</strong>。</p><ul><li>订单号：<code>${row.order_no}</code></li><li>套餐：${row.plan_name}</li><li>金额：¥${row.amount}</li></ul>${remark?.trim() ? `<p>说明：${remark.trim()}</p>` : ''}<p>如有疑问请联系客服。</p><p>TopTalk</p>`

    const sent = await sendSesEmail({
      secretId: env.secretId,
      secretKey: env.secretKey,
      region: env.region,
      fromAddress: env.fromAddress,
      to: [to],
      subject,
      textBody: text,
      htmlBody: html,
      templateId: env.orderTemplateId,
      templateData: {
        status_text: isOk ? '审核通过' : '审核未通过',
        order_no: String(row.order_no || ''),
        plan_name: String(row.plan_name || ''),
        amount: String(row.amount ?? ''),
        remark_text: (remark || '').trim() ? `拒绝原因：${String(remark).trim()}` : '',
      },
    })
    if (!sent.ok) {
      return json({
        success: true,
        status: newStatus,
        emailWarning: sent.message || '订单已更新，但通知邮件发送失败',
      })
    }
  }

  return json({ success: true, status: newStatus })
}

// ── 路由 ────────────────────────────────────────────────────
serve(async (req: Request) => {
  // 处理 CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-api-key',
        'Access-Control-Max-Age': '86400',
      }
    })
  }

  const path = req.url.split('/').pop()?.split('?')[0] || ''
  try {
    if (req.method === 'POST' && path === 'create') return await handleCreate(req)
    if (req.method === 'GET' && path === 'orders') return await handleList(req)
    if (req.method === 'POST' && path === 'approve') return await handleApprove(req)
    if (req.method === 'GET' && path === 'check-order') return await handleCheckOrder(req)
    return json({ message: 'Not found' }, 404)
  } catch (e: any) {
    return json({ success: false, message: e.message }, 500)
  }
})
