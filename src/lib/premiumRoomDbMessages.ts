import { supabase } from './supabase'

/** 若表 `messages.type` 不允许 `file`，则用 `text` + 此前缀存文件元数据 JSON */
export const PREMIUM_FILE_CONTENT_PREFIX = '__TOPFILE__'

export type PremiumDbMessageShape = {
  id: string
  type: 'text' | 'file'
  sender: string
  senderName: string
  text?: string
  fileName?: string
  fileUrl?: string
  fileSize?: string
  fileType?: string
  allowDownload: boolean
  destroySeconds: number
  expireAt: number
  createdAt: string
  isMine?: boolean
}

type Row = {
  id: string
  sender_id: string
  sender_name: string
  type: string
  content: string | null
  destroy_seconds: number | null
  created_at: string
}

function rowToMessage(row: Row, myUserId: string, nowMs: number): PremiumDbMessageShape | null {
  const ds = Number(row.destroy_seconds) || 0
  const createdMs = new Date(row.created_at).getTime()
  const expireAt = ds > 0 ? createdMs + ds * 1000 : 0
  if (expireAt > 0 && expireAt <= nowMs) return null

  const id = String(row.id)
  const base = {
    id,
    sender: row.sender_id,
    senderName: row.sender_name,
    destroySeconds: ds,
    expireAt,
    createdAt: row.created_at,
    isMine: row.sender_id === myUserId,
  }

  const content = row.content || ''

  if (row.type === 'text' && content.startsWith(PREMIUM_FILE_CONTENT_PREFIX)) {
    try {
      const meta = JSON.parse(content.slice(PREMIUM_FILE_CONTENT_PREFIX.length)) as Record<string, unknown>
      return {
        ...base,
        type: 'file',
        fileName: String(meta.file_name || ''),
        fileUrl: String(meta.file_url || ''),
        fileSize: String(meta.file_size || ''),
        fileType: String(meta.file_type || 'application/octet-stream'),
        allowDownload: !!meta.allow_download,
      }
    } catch {
      return null
    }
  }

  if (row.type === 'file') {
    try {
      const meta = JSON.parse(content || '{}') as Record<string, unknown>
      return {
        ...base,
        type: 'file',
        fileName: String(meta.file_name || ''),
        fileUrl: String(meta.file_url || ''),
        fileSize: String(meta.file_size || ''),
        fileType: String(meta.file_type || 'application/octet-stream'),
        allowDownload: !!meta.allow_download,
      }
    } catch {
      return null
    }
  }

  if (row.type === 'text') {
    return {
      ...base,
      type: 'text',
      text: content,
      allowDownload: false,
    }
  }

  return null
}

/** 进房时拉取未过期的历史消息（与实时广播共用 DB 中的 id，避免重复） */
export async function fetchPremiumRoomMessagesFromDb(
  roomId: string,
  myUserId: string
): Promise<PremiumDbMessageShape[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, sender_name, type, content, destroy_seconds, created_at')
    .eq('room_id', `premium_${roomId}`)
    .order('created_at', { ascending: true })
    .limit(300)

  if (error || !data?.length) return []

  const nowMs = Date.now()
  const out: PremiumDbMessageShape[] = []
  for (const row of data as Row[]) {
    const m = rowToMessage(row, myUserId, nowMs)
    if (m) out.push(m)
  }
  return out
}

export async function persistPremiumTextMessage(params: {
  roomId: string
  myId: string
  myName: string
  textBody: string
  destroySeconds: number
}): Promise<{ id: string; createdAt: string } | { error: string }> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: `premium_${params.roomId}`,
      sender_id: params.myId,
      sender_name: params.myName,
      type: 'text',
      content: params.textBody,
      destroy_seconds: params.destroySeconds,
    })
    .select('id, created_at')
    .single()

  if (error || !data) return { error: error?.message || 'insert failed' }
  return { id: String(data.id), createdAt: String(data.created_at) }
}

export async function persistPremiumFileMessage(params: {
  roomId: string
  myId: string
  myName: string
  destroySeconds: number
  fileUrl: string
  fileName: string
  fileSize: string
  fileType: string
  allowDownload: boolean
}): Promise<{ id: string; createdAt: string } | { error: string }> {
  const payload = JSON.stringify({
    file_url: params.fileUrl,
    file_name: params.fileName,
    file_size: params.fileSize,
    file_type: params.fileType,
    allow_download: params.allowDownload,
  })

  let ins = await supabase
    .from('messages')
    .insert({
      room_id: `premium_${params.roomId}`,
      sender_id: params.myId,
      sender_name: params.myName,
      type: 'file',
      content: payload,
      destroy_seconds: params.destroySeconds,
    })
    .select('id, created_at')
    .single()

  if (ins.error) {
    ins = await supabase
      .from('messages')
      .insert({
        room_id: `premium_${params.roomId}`,
        sender_id: params.myId,
        sender_name: params.myName,
        type: 'text',
        content: PREMIUM_FILE_CONTENT_PREFIX + payload,
        destroy_seconds: params.destroySeconds,
      })
      .select('id, created_at')
      .single()
  }

  if (ins.error || !ins.data) return { error: ins.error?.message || 'insert failed' }
  return { id: String(ins.data.id), createdAt: String(ins.data.created_at) }
}

/** 是否为 Supabase 返回的 messages 行 id（UUID），避免对临时 id 发 delete */
export function isPersistedPremiumMessageId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/** 单条消息阅后即焚到期：从数据库删除该行（需 messages 表对 anon 开放 DELETE 或你的策略允许） */
export async function deletePremiumMessageRow(id: string): Promise<void> {
  if (!isPersistedPremiumMessageId(id)) return
  const { error } = await supabase.from('messages').delete().eq('id', id)
  if (error) console.warn('删除过期消息失败:', error.message)
}

/** 房间结束/解散：删除该高级房在 messages 表中的全部记录 */
export async function deleteAllPremiumMessagesForRoom(roomId: string): Promise<void> {
  if (!roomId || roomId === '------') return
  const { error } = await supabase.from('messages').delete().eq('room_id', `premium_${roomId}`)
  if (error) console.warn('清空房间消息失败:', error.message)
}
