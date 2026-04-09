import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone(): boolean {
  // iOS Safari
  const nav = window.navigator as any
  if (nav?.standalone) return true
  // Other browsers
  return window.matchMedia?.('(display-mode: standalone)')?.matches ?? false
}

function isProbablyMobile(): boolean {
  const ua = navigator.userAgent || ''
  return /Android|iPhone|iPad|iPod/i.test(ua)
}

function isIOS(): boolean {
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/i.test(ua)
}

function isSafariIOS(): boolean {
  const ua = navigator.userAgent || ''
  const isWebKit = /AppleWebKit/i.test(ua)
  const isCriOS = /CriOS/i.test(ua)
  const isFxiOS = /FxiOS/i.test(ua)
  return isIOS() && isWebKit && !isCriOS && !isFxiOS
}

const DISMISS_KEY_DEFAULT = 'toptalk_install_prompt_dismissed_v1'
const DISMISS_KEY_ADMIN = 'toptalk_install_prompt_dismissed_admin_v1'

export default function InstallPrompt() {
  const location = useLocation()
  const [bipEvent, setBipEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)

  const isAdmin = location.pathname.startsWith('/admin')
  const dismissKey = isAdmin ? DISMISS_KEY_ADMIN : DISMISS_KEY_DEFAULT

  const eligible = useMemo(() => {
    if (typeof window === 'undefined') return false
    if (!isProbablyMobile()) return false
    if (isStandalone()) return false
    try {
      if (localStorage.getItem(dismissKey) === '1') return false
    } catch { /* ignore */ }
    return true
  }, [dismissKey])

  useEffect(() => {
    if (!eligible) return

    const onBip = (e: Event) => {
      e.preventDefault()
      setBipEvent(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onBip)

    // iOS Safari 没有 beforeinstallprompt，只能做引导提示
    if (isSafariIOS()) {
      const t = window.setTimeout(() => setVisible(true), 1200)
      return () => {
        window.clearTimeout(t)
        window.removeEventListener('beforeinstallprompt', onBip)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [eligible])

  if (!eligible || !visible) return null

  const canInstall = !!bipEvent
  const title = canInstall ? '安装到手机桌面' : '添加到主屏幕'
  const desc = canInstall
    ? '一键安装后可像 App 一样打开 TopTalk。'
    : '点击 Safari 分享按钮 → 添加到主屏幕。'

  const dismiss = (persist: boolean) => {
    setVisible(false)
    if (persist) {
      try { localStorage.setItem(dismissKey, '1') } catch { /* ignore */ }
    }
  }

  const doInstall = async () => {
    if (!bipEvent) return
    setInstalling(true)
    try {
      await bipEvent.prompt()
      const choice = await bipEvent.userChoice.catch(() => null)
      if (choice?.outcome === 'accepted') dismiss(true)
      else dismiss(false)
    } finally {
      setInstalling(false)
      setBipEvent(null)
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[500] p-3 sm:p-4">
      <div className="max-w-md mx-auto bg-[#0b1730]/95 border border-white/10 backdrop-blur-md rounded-2xl p-4 shadow-2xl animate-[bounce_1.2s_ease-in-out_1]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-400/15 border border-yellow-400/25 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">T</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white font-bold text-sm">{title}</div>
            <div className="text-gray-500 text-xs mt-1 leading-relaxed">{desc}</div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(false)}
            className="text-gray-600 hover:text-white px-2 -mr-1"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          {canInstall ? (
            <button
              type="button"
              onClick={doInstall}
              disabled={installing}
              className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-[#1a365d] font-bold py-2.5 rounded-xl text-sm disabled:opacity-60"
            >
              {installing ? '安装中…' : '安装应用'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => dismiss(true)}
              className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold py-2.5 rounded-xl text-sm"
            >
              我知道了
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 py-2.5 rounded-xl text-sm"
          >
            不再提示
          </button>
        </div>

        {!canInstall && (
          <div className="mt-2 text-gray-700 text-[11px]">
            iPhone：Safari → 分享 → 添加到主屏幕。添加后如需移除，请在桌面长按图标删除。
          </div>
        )}
      </div>
    </div>
  )
}

