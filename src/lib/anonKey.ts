/**
 * 与 Edge Functions 侧 normalizeKey 对齐：避免 .env 里误带引号、空白、BOM。
 */
export function normalizeClientAnonKey(k: string | undefined | null): string {
  if (k == null) return ''
  let s = String(k).trim().replace(/^\uFEFF/, '')
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}
