import { supabase, supabaseConfigOk } from './supabase'

export type PremiumActiveRoom = {
  id: string
  createdAt: string // ISO
  destroySeconds: number
  password?: string
  role: 'creator' | 'member'
}

const KEY = 'toptalk_premium_active_rooms'

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function getActivePremiumRooms(): PremiumActiveRoom[] {
  const rooms = safeParse<PremiumActiveRoom[]>(localStorage.getItem(KEY), [])
  return cleanupExpired(rooms)
}

export function setActivePremiumRooms(rooms: PremiumActiveRoom[]) {
  localStorage.setItem(KEY, JSON.stringify(rooms.slice(0, 50)))
  // 让页面即时刷新
  window.dispatchEvent(new Event('storage'))
}

export function cleanupExpired(input?: PremiumActiveRoom[]): PremiumActiveRoom[] {
  const rooms = (input ?? safeParse<PremiumActiveRoom[]>(localStorage.getItem(KEY), [])).filter(Boolean)
  const now = Date.now()
  const next = rooms.filter(r => {
    const expiresAt = new Date(r.createdAt).getTime() + (r.destroySeconds || 0) * 1000
    return expiresAt > now
  })
  if (input == null) setActivePremiumRooms(next)
  return next
}

export function upsertActivePremiumRoom(room: PremiumActiveRoom): PremiumActiveRoom[] {
  const rooms = getActivePremiumRooms()
  const idx = rooms.findIndex(r => r.id === room.id)
  const next = idx >= 0 ? rooms.map(r => (r.id === room.id ? { ...r, ...room } : r)) : [room, ...rooms]
  setActivePremiumRooms(next)
  return next
}

export function removeActivePremiumRoom(roomId: string): PremiumActiveRoom[] {
  const rooms = getActivePremiumRooms()
  const next = rooms.filter(r => r.id !== roomId)
  setActivePremiumRooms(next)
  return next
}

export function activeRoomRemainingMs(room: PremiumActiveRoom): number {
  const exp = new Date(room.createdAt).getTime() + room.destroySeconds * 1000
  return Math.max(0, exp - Date.now())
}

/**
 * 用 Supabase `rooms` 校准本地「活跃高级房」：已解散或墙钟已到的房间从本地移除。
 * 解决：创建者点「离开」后本地仍占位、或房间已解散但本地未同步，导致单次/1 名额套餐误判「已达上限」。
 */
export async function reconcileActivePremiumRoomsWithDb(): Promise<PremiumActiveRoom[]> {
  const rooms = safeParse<PremiumActiveRoom[]>(localStorage.getItem(KEY), [])
  if (!supabaseConfigOk || !rooms.length) {
    cleanupExpired()
    return getActivePremiumRooms()
  }

  const ids = [...new Set(rooms.map(r => String(r.id)))]
  const { data, error } = await supabase
    .from('rooms')
    .select('id, status, created_at, destroy_seconds')
    .eq('room_type', 'premium')
    .in('id', ids)

  const byId = new Map<string, { status?: string | null; created_at: string; destroy_seconds?: number | null }>()
  if (!error && data) {
    for (const row of data as Array<{ id: string; status?: string | null; created_at: string; destroy_seconds?: number | null }>) {
      byId.set(String(row.id), row)
    }
  }

  const now = Date.now()
  const next = rooms.filter(r => {
    const row = byId.get(String(r.id))
    const localEnd = new Date(r.createdAt).getTime() + (Number(r.destroySeconds) || 0) * 1000
    if (!row) {
      return localEnd > now
    }
    if (String(row.status || '') === 'dissolved') return false
    const dbEnd = new Date(row.created_at).getTime() + (Number(row.destroy_seconds) || 0) * 1000
    return dbEnd > now
  })

  if (next.length !== rooms.length) {
    setActivePremiumRooms(next)
  } else {
    cleanupExpired()
  }
  return getActivePremiumRooms()
}

