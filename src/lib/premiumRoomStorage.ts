import { supabase } from './supabase'

/** Supabase Storage 桶名：需在控制台创建并配置策略（公开读 + 允许 anon 上传） */
const BUCKET =
  (import.meta.env.VITE_SUPABASE_PREMIUM_BUCKET as string | undefined)?.trim() || 'premium-room-files'

export function getPremiumRoomStorageBucket(): string {
  return BUCKET
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]/g, '_').slice(0, 180) || 'file'
}

async function uploadViaSignedUrl(roomId: string, file: File): Promise<{ url: string } | { error: string }> {
  let r: Response
  try {
    r = await fetch('/api/premium-upload-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
      }),
    })
  } catch {
    return { error: '__FALLBACK__' }
  }

  if (r.status === 404 || r.status === 501) {
    return { error: '__FALLBACK__' }
  }

  const j = (await r.json().catch(() => ({}))) as {
    error?: string
    bucket?: string
    path?: string
    token?: string
    signedUrl?: string
  }

  if (!r.ok) {
    return { error: j.error || `签名上传不可用(${r.status})` }
  }

  const path = j.path
  const token = j.token
  const signedUrl = j.signedUrl
  const bucket = (j.bucket || BUCKET).trim()

  if (!path || !token) {
    return { error: '签名响应缺少 path/token' }
  }

  const storageApi = supabase.storage.from(bucket) as {
    uploadToSignedUrl?: (
      p: string,
      t: string,
      body: File,
      opts?: { cacheControl?: string; contentType?: string; upsert?: boolean }
    ) => Promise<{ error: { message: string } | null }>
  }

  if (typeof storageApi.uploadToSignedUrl === 'function') {
    const { error: upErr } = await storageApi.uploadToSignedUrl(path, token, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (!upErr) {
      // ok
    } else if (signedUrl) {
      const put = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
      if (!put.ok) return { error: upErr.message || `直传失败(${put.status})` }
    } else {
      return { error: upErr.message }
    }
  } else if (signedUrl) {
    const put = await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    })
    if (!put.ok) return { error: `直传失败(${put.status})` }
  } else {
    return { error: '客户端不支持 uploadToSignedUrl 且未返回 signedUrl' }
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  const publicUrl = data?.publicUrl
  if (!publicUrl) return { error: '无法生成文件访问地址' }
  return { url: publicUrl }
}

/**
 * 将文件上传到 Supabase Storage，返回所有人可访问的 public URL（用于广播给房间内其他成员）。
 * blob: 链接无法跨浏览器使用，必须走此上传。
 *
 * 顺序：1) Vercel /api/premium-upload-sign + Service Role 签名直传（绕过 storage RLS）
 *       2) 回退：匿名客户端直传（需在 Supabase 配置 storage 策略，见 supabase/sql/premium_room_storage.sql）
 */
export async function uploadPremiumRoomFile(
  roomId: string,
  file: File
): Promise<{ url: string } | { error: string }> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!baseUrl || baseUrl.includes('placeholder')) {
    return { error: '未配置有效的 Supabase 环境变量' }
  }

  const signed = await uploadViaSignedUrl(roomId, file)
  if ('url' in signed) return signed
  if (signed.error !== '__FALLBACK__') return signed

  const path = `${roomId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safeFileName(file.name)}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) return { error: upErr.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = data?.publicUrl
  if (!publicUrl) return { error: '无法生成文件访问地址' }
  return { url: publicUrl }
}
