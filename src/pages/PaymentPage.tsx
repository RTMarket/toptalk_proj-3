import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import { pricingPlans } from '../data/pricingData'
import { normalizeClientAnonKey } from '../lib/anonKey'
import { clampNickname, isValidNickname, NICKNAME_MAX_LEN } from '../lib/nickname'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
const ANON_KEY = normalizeClientAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

// ── 银行账户信息 ────────────────────────────────────────
const BANK_INFO = {
  accountName: '上海玳久人信息技术有限公司',
  accountNumber: '1601155700',
  bankName: '中国民生银行股份有限公司上海静安支行',
}

// ── 套餐有效期（天）────────────────────────────────────
const PLAN_DAYS: Record<string, number> = {
  daily: 1, weekly: 7, monthly: 30,
  single: 0, enterprise: 30, enterprise_pro: 30,
}

export default function PaymentPage() {
  const [step, setStep] = useState<'select' | 'fill' | 'upload' | 'done'>('select')
  const [selectedPlanId, setSelectedPlanId] = useState('monthly')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [checkingOrder, setCheckingOrder] = useState(false)

  const plan = pricingPlans.find(p => p.id === selectedPlanId)

  // 组件挂载时：从 localStorage 读取当前用户信息填充
  useEffect(() => {
    const stored = localStorage.getItem('toptalk_user')
    if (stored) {
      try {
        const u = JSON.parse(stored)
        if (u.email) setEmail(u.email)
        if (u.nickname) setNickname(u.nickname)
      } catch {}
    }
  }, [])

  // 截图预览
  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshot(file)
    const reader = new FileReader()
    reader.onload = ev => setScreenshotPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // 提交凭证
  const handleSubmit = async () => {
    if (!email.trim() || !nickname.trim()) { setError('请填写邮箱和昵称'); return }
    if (!isValidNickname(nickname)) { setError(`昵称需在 1～${NICKNAME_MAX_LEN} 个字符以内`); return }
    if (!plan) { setError('请先选择套餐'); return }
    if (!screenshot) { setError('请上传转账截图'); return }
    if (!SUPABASE_URL || !ANON_KEY || ANON_KEY.includes('placeholder') || SUPABASE_URL.includes('placeholder')) {
      setError('支付功能未配置：请在 .env 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY（真实值）')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const base64 = await fileToBase64(screenshot)
      const ext = (screenshot.name.split('.').pop() || 'jpg').toLowerCase()

      const res = await fetch(`${SUPABASE_URL}/functions/v1/bank-transfer-order/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          'x-api-key': ANON_KEY,
        },
        body: JSON.stringify({
          planId: plan.id,
          userEmail: email.trim(),
          userNickname: nickname.trim(),
          screenshotBase64: base64,
          screenshotExt: ext,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `提交失败（HTTP ${res.status}）`)
      }

      setOrderNo(data.orderNo || '')
      setStep('done')
    } catch (e: any) {
      setError(e.message || '提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050d1a] text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">

        {/* 步骤条 */}
        <div className="flex items-center gap-2 mb-10">
          {['选择套餐', '填写信息', '上传凭证', '提交完成'].map((label, i) => {
            const steps = ['select', 'fill', 'upload', 'done']
            const current = steps.indexOf(step)
            const done = i < current
            const active = i === current
            return (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
                  done ? 'bg-yellow-400/20 text-yellow-400' :
                  active ? 'bg-yellow-400 text-[#050d1a]' :
                  'bg-white/5 text-gray-500'
                }`}>
                  <span>{done ? '✓' : i + 1}</span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < 3 && <div className="flex-1 h-px bg-white/10" />}
              </div>
            )
          })}
        </div>

        {/* ── Step 1：选择套餐 ── */}
        {step === 'select' && (
          <>
            <h1 className="text-3xl font-bold text-white mb-1">选择套餐</h1>
            <p className="text-gray-500 mb-8">转账至企业对公账户，安全可靠</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {pricingPlans.map(p => (
                <div
                  key={p.id}
                  onClick={() => { setSelectedPlanId(p.id); setStep('fill') }}
                  className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 ${
                    selectedPlanId === p.id
                      ? 'bg-yellow-400/10 border-yellow-400/50 shadow-lg shadow-yellow-500/10'
                      : 'bg-white/3 border-white/10 hover:border-white/20'
                  }`}
                >
                  {p.highlight && (
                    <div className="text-yellow-400 text-xs font-bold mb-1">⭐ {p.badge}</div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold">{p.name}</span>
                    {selectedPlanId === p.id && (
                      <span className="text-yellow-400 text-sm font-bold">✓</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-2xl font-extrabold text-yellow-400">¥{p.price}</span>
                    {p.priceUnit && <span className="text-gray-600 text-xs">{p.priceUnit}</span>}
                  </div>
                  <div className="text-gray-600 text-xs">{p.duration} · {p.roomCount}个房间</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Step 2：填写信息 & 查看银行账户 ── */}
        {step === 'fill' && plan && (
          <>
            <button onClick={() => setStep('select')} className="text-gray-500 hover:text-white text-sm mb-6 flex items-center gap-1">
              ← 返回选择套餐
            </button>

            <h1 className="text-3xl font-bold text-white mb-1">填写信息 & 转账</h1>
            <p className="text-gray-500 mb-8">向以下对公账户转账后上传截图</p>

            {/* 银行账户卡片 */}
            <div className="bg-gradient-to-br from-[#1a2a4a] to-[#0d1f35] border border-yellow-400/30 rounded-2xl p-6 mb-6">
              <div className="text-yellow-400 text-xs font-bold mb-4 tracking-widest">🏦 对公账户信息</div>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-gray-400 text-sm">账户名称</span>
                  <span className="text-white font-semibold text-right text-sm leading-snug max-w-[60%]">{BANK_INFO.accountName}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-gray-400 text-sm">开户银行</span>
                  <span className="text-white font-semibold text-right text-sm leading-snug max-w-[60%]">{BANK_INFO.bankName}</span>
                </div>
                <div className="flex justify-between items-center border-t border-white/8 pt-3 mt-3">
                  <span className="text-gray-400 text-sm">账户号码</span>
                  <span className="text-yellow-400 font-bold text-lg tracking-widest">{BANK_INFO.accountNumber}</span>
                </div>
              </div>
            </div>

            {/* 订单金额 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-white font-bold text-lg">{plan.name}</div>
                  <div className="text-gray-500 text-sm">{plan.duration} · {plan.roomCount}个高级聊天室</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-yellow-400">¥{plan.price}</div>
                  <div className="text-gray-600 text-xs">{plan.priceUnit}</div>
                </div>
              </div>
            </div>

            {/* 用户信息 */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-gray-400 text-sm mb-1.5 block">邮箱地址</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="用于接收开通通知"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1.5 block">昵称</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(clampNickname(e.target.value))}
                  placeholder={`最多 ${NICKNAME_MAX_LEN} 个字符`}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 transition-colors"
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (!email.trim()) { setError('请填写邮箱'); return }
                if (!nickname.trim()) { setError('请填写昵称'); return }
                if (!isValidNickname(nickname)) { setError(`昵称需在 1～${NICKNAME_MAX_LEN} 个字符以内`); return }
                setError('')
                setStep('upload')
              }}
              className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 active:scale-95 text-[#050d1a] font-bold py-4 rounded-xl text-lg transition-all shadow-xl shadow-yellow-500/20"
            >
              已完成转账，去上传凭证 →
            </button>
          </>
        )}

        {/* ── Step 3：上传转账凭证 ── */}
        {step === 'upload' && plan && (
          <>
            <button onClick={() => setStep('fill')} className="text-gray-500 hover:text-white text-sm mb-6 flex items-center gap-1">
              ← 返回修改信息
            </button>

            <h1 className="text-3xl font-bold text-white mb-1">上传转账凭证</h1>
            <p className="text-gray-500 mb-8">请上传网银/手机银行转账截图，便于我们快速核实</p>

            {/* 订单摘要 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 flex justify-between items-center">
              <div>
                <div className="text-white font-bold">{plan.name}</div>
                <div className="text-gray-500 text-sm">{nickname} · {email}</div>
              </div>
              <div className="text-2xl font-extrabold text-yellow-400">¥{plan.price}</div>
            </div>

            {/* 文件上传 */}
            <div className="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center mb-6 hover:border-yellow-400/40 transition-colors">
              {screenshotPreview ? (
                <div className="relative inline-block">
                  <img src={screenshotPreview} alt="凭证预览" className="max-h-64 rounded-xl mx-auto" />
                  <button
                    onClick={() => { setScreenshot(null); setScreenshotPreview('') }}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 rounded-full text-white text-sm font-bold shadow-lg"
                  >×</button>
                </div>
              ) : (
                <>
                  <div className="text-5xl mb-4">📤</div>
                  <p className="text-gray-400 mb-2">点击或拖拽上传转账截图</p>
                  <p className="text-gray-600 text-xs mb-4">支持 JPG / PNG / WEBP，不超过 10MB</p>
                  <label className="inline-block bg-yellow-400/20 border border-yellow-400/40 text-yellow-400 px-6 py-2 rounded-lg cursor-pointer hover:bg-yellow-400/30 transition-colors text-sm font-bold">
                    选择文件
                    <input type="file" accept="image/*" onChange={handleScreenshotChange} className="hidden" />
                  </label>
                </>
              )}
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 mb-4 text-red-400 text-sm">
                ❌ {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 active:scale-95 text-[#050d1a] font-bold py-4 rounded-xl text-lg transition-all shadow-xl shadow-yellow-500/20 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? '⏳ 提交中...' : '✅ 提交审核'}
            </button>
          </>
        )}

        {/* ── Step 4：提交完成 ── */}
        {step === 'done' && (
          <div className="text-center py-12">
            <div className="text-7xl mb-6">🎉</div>
            <h2 className="text-4xl font-extrabold text-white mb-3">提交成功！</h2>
            <p className="text-gray-400 text-lg mb-2">您的转账凭证已提交，正在等待审核</p>
            <p className="text-gray-500 text-sm mb-8">订单号：<span className="text-yellow-400 font-mono font-bold">{orderNo}</span></p>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-md mx-auto mb-8 text-left">
              <div className="text-gray-400 text-xs mb-3">本次订单摘要</div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400 text-sm">套餐</span>
                <span className="text-white font-semibold">{plan?.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400 text-sm">邮箱</span>
                <span className="text-white text-sm">{email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">金额</span>
                <span className="text-yellow-400 font-bold text-xl">¥{plan?.price}</span>
              </div>
            </div>

            <p className="text-gray-600 text-sm mb-6">
              审核通过后，套餐将自动开通，稍后会以消息通知您。
            </p>

            <button
              onClick={() => { setStep('select'); setScreenshot(null); setScreenshotPreview('') }}
              className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white px-8 py-3 rounded-xl hover:bg-white/15 transition-colors"
            >
              返回首页
            </button>
          </div>
        )}

      </div>
      <Footer />
    </div>
  )
}

// ── 工具函数 ──────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1]) // 去掉 data:image/xxx;base64,
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
