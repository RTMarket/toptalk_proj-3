/**
 * Edge Functions Secrets：部分控制台不允许以 SUPABASE_ 开头命名，故同时支持两套名称。
 */

/** 与前端 normalizeClientAnonKey 对齐，避免 Secrets 里误带换行/引号导致 401 */
export function normalizeKey(s: string): string {
  let t = s.trim().replace(/^\uFEFF/, '')
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim()
  }
  return t
}

export function getProjectUrl(): string {
  return (
    Deno.env.get('SUPABASE_URL') ||
    Deno.env.get('API_URL') ||
    Deno.env.get('APl_URL') || // 常见笔误（小写 L）
    ''
  ).trim()
}

export function getServiceRoleKey(): string {
  return (
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('SERVICE_ROLE_KEY') ||
    ''
  ).trim()
}

export function getAnonKey(): string {
  const raw = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('ANON_KEY') || ''
  return normalizeKey(raw)
}
