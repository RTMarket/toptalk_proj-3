/** 昵称最多 8 个「字」（Unicode 码点，汉字/英文/数字混合） */
export const NICKNAME_MAX_LEN = 8

export function nicknameCharCount(s: string): number {
  return [...s].length
}

export function clampNickname(s: string): string {
  return [...s].slice(0, NICKNAME_MAX_LEN).join('')
}

export function isValidNickname(s: string): boolean {
  const t = s.trim()
  return t.length > 0 && nicknameCharCount(t) <= NICKNAME_MAX_LEN
}
