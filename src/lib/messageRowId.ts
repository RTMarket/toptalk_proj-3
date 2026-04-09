/** 若表 `messages.id` 未设 DEFAULT，INSERT 不传 id 会触发 not-null；浏览器侧生成 UUID */
export function newMessageRowId(): string {
  const c = globalThis.crypto
  if (typeof c !== 'undefined' && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (ch) => {
    const n = (Math.random() * 16) | 0
    const v = ch === 'x' ? n : (n & 0x3) | 0x8
    return v.toString(16)
  })
}
