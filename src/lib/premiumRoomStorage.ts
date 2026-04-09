import { supabase } from './supabase'

/** Supabase Storage 桶名：需在控制台创建并配置策略（公开读 + 允许 anon 上传） */
const BUCKET =
  (import.meta.env.VITE_SUPABASE_PREMIUM_BUCKET as string | undefined)?.trim() || 'premium-room-files'

export function getPremiumRoomStorageBucket(): string {
  return BUCKET
}

/**
 * 将文件上传到 Supabase Storage，返回所有人可访问的 public URL（用于广播给房间内其他成员）。
 * blob: 链接无法跨浏览器使用，必须走此上传。
 */
export async function uploadPremiumRoomFile(
  roomId: string,
  file: File
): Promise<{ url: string } | { error: string }> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!baseUrl || baseUrl.includes('placeholder')) {
    return { error: '未配置有效的 Supabase 环境变量' }
  }

  const safe =
    file.name.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]/g, '_').slice(0, 180) || 'file'
  const path = `${roomId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safe}`

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
