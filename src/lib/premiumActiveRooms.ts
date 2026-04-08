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

