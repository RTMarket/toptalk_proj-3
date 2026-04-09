import { createClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: true,
  },
}

function bucketName(): string {
  return (
    process.env.SUPABASE_PREMIUM_BUCKET ||
    process.env.VITE_SUPABASE_PREMIUM_BUCKET ||
    'premium-room-files'
  ).trim()
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]/g, '_').slice(0, 180) || 'file'
}

// Vercel Node serverless（需设置 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY）
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!supabaseUrl || !serviceKey) {
    res.status(501).json({ error: 'Server upload not configured', code: 'NO_SERVICE_ROLE' })
    return
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const roomId = String(req.body?.roomId || '').trim()
  const fileName = String(req.body?.fileName || '').trim()
  const contentType = String(req.body?.contentType || 'application/octet-stream').trim()

  if (!roomId || roomId === '------') {
    res.status(400).json({ error: 'Missing roomId' })
    return
  }
  if (!fileName) {
    res.status(400).json({ error: 'Missing fileName' })
    return
  }

  const looksLikeRoomId = /^\d{6}$/.test(roomId)

  const { data: room, error: roomErr } = await supabaseAdmin
    .from('rooms')
    .select('id, room_type, status')
    .eq('id', roomId)
    .eq('room_type', 'premium')
    .maybeSingle()

  if (roomErr) {
    res.status(500).json({ error: roomErr.message })
    return
  }

  if (room && String((room as { status?: string }).status || '') === 'dissolved') {
    res.status(404).json({ error: 'Room ended' })
    return
  }

  if (!room && !looksLikeRoomId) {
    res.status(404).json({ error: 'Room not found' })
    return
  }

  const BUCKET = bucketName()
  const safe = safeFileName(fileName)
  const path = `${roomId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safe}`

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    res.status(500).json({ error: error?.message || 'createSignedUploadUrl failed' })
    return
  }

  res.status(200).json({
    bucket: BUCKET,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    contentTypeHint: contentType,
  })
}
