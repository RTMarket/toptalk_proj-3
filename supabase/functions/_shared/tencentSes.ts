/**
 * 腾讯云 SES SendEmail（API 3.0 / TC3-HMAC-SHA256）
 * 密钥仅通过环境变量传入，勿写入前端或仓库。
 */
import { createHash, createHmac } from 'node:crypto'

const SES_HOST = 'ses.tencentcloudapi.com'
const SES_VERSION = '2020-10-02'

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

function hmacBytes(key: string | Uint8Array, msg: string): Uint8Array {
  // 在 Supabase Edge（Deno）环境中没有 Node 的 Buffer，全程用 Uint8Array
  return createHmac('sha256', key).update(msg, 'utf8').digest()
}

function hmacHex(key: string | Uint8Array, msg: string): string {
  return createHmac('sha256', key).update(msg, 'utf8').digest('hex')
}

function base64FromUtf8(s: string): string {
  const bytes = new TextEncoder().encode(s)
  // 避免 String.fromCharCode(...bytes) 在较长内容时爆栈，分块拼接
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.slice(i, i + CHUNK))
  }
  return btoa(bin)
}

/** 生成 TC3 Authorization 头并 POST SendEmail */
export async function sendSesEmail(opts: {
  secretId: string
  secretKey: string
  region: string
  fromAddress: string
  to: string[]
  subject: string
  textBody: string
  htmlBody?: string
  /** 如果未开通自定义发送权限，需使用模板发送（TemplateID 为整数） */
  templateId?: number
  /** 模板变量（会被 JSON.stringify 成 TemplateData） */
  templateData?: Record<string, string>
}): Promise<{ ok: boolean; message?: string; raw?: string }> {
  const payloadObj: Record<string, unknown> = {
    FromEmailAddress: opts.fromAddress,
    Destination: opts.to,
    Subject: opts.subject,
  }

  if (opts.templateId && Number.isFinite(opts.templateId)) {
    payloadObj.Template = {
      TemplateID: Math.trunc(opts.templateId),
      TemplateData: JSON.stringify(opts.templateData || {}),
    }
  } else {
    payloadObj.Simple = {
      Text: base64FromUtf8(opts.textBody),
      ...(opts.htmlBody ? { Html: base64FromUtf8(opts.htmlBody) } : {}),
    }
  }
  const payload = JSON.stringify(payloadObj)

  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000)
  const dateStr = date.toISOString().slice(0, 10)

  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\n` + `host:${SES_HOST}\n`
  const signedHeaders = 'content-type;host'
  const hashedPayload = sha256Hex(payload)
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n')

  const credentialScope = `${dateStr}/ses/tc3_request`
  const hashedCanonicalRequest = sha256Hex(canonicalRequest)
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n')

  const kDate = hmacBytes('TC3' + opts.secretKey, dateStr)
  const kService = hmacBytes(kDate, 'ses')
  const kSigning = hmacBytes(kService, 'tc3_request')
  const signature = hmacHex(kSigning, stringToSign)

  const authorization =
    `TC3-HMAC-SHA256 Credential=${opts.secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  const res = await fetch(`https://${SES_HOST}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Host: SES_HOST,
      Authorization: authorization,
      'X-TC-Action': 'SendEmail',
      'X-TC-Version': SES_VERSION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': opts.region,
    },
    body: payload,
  })

  const txt = await res.text()
  if (!res.ok) {
    return { ok: false, message: `SES HTTP ${res.status}: ${txt}`, raw: txt }
  }
  try {
    const j = JSON.parse(txt)
    if (j.Response?.Error) {
      return {
        ok: false,
        message: j.Response.Error.Message || JSON.stringify(j.Response.Error),
        raw: txt,
      }
    }
    return { ok: true, raw: txt }
  } catch {
    return { ok: false, message: txt, raw: txt }
  }
}

export function getSesEnv() {
  const secretId = Deno.env.get('TENCENT_SECRET_ID') || ''
  const secretKey = Deno.env.get('TENCENT_SECRET_KEY') || ''
  const region = Deno.env.get('TENCENT_SES_REGION') || 'ap-hongkong'
  const fromAddress = Deno.env.get('TENCENT_SES_FROM') || ''
  // 模板 ID：建议按用途拆分（验证码/订单通知），避免共用同一模板变量
  const otpTemplateIdRaw = (
    Deno.env.get('TENCENT_SES_OTP_TEMPLATE_ID') ||
    Deno.env.get('TENCENT_SES_TEMPLATE_ID') || // 兼容旧配置
    ''
  ).trim()
  const orderTemplateIdRaw = (Deno.env.get('TENCENT_SES_ORDER_TEMPLATE_ID') || '').trim()

  const otpTemplateId = otpTemplateIdRaw ? Number(otpTemplateIdRaw) : undefined
  const orderTemplateId = orderTemplateIdRaw ? Number(orderTemplateIdRaw) : undefined

  return { secretId, secretKey, region, fromAddress, otpTemplateId, orderTemplateId }
}

export function sesConfigured(): boolean {
  const e = getSesEnv()
  return !!(e.secretId && e.secretKey && e.fromAddress)
}
