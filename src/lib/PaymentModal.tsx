import { useState, useEffect, useRef } from 'react'
import { createAlipayOrder, queryPayStatus } from '../lib/payment'

interface PaymentModalProps {
  planId: string
  planName: string
  amount: string
  onClose: () => void
  onSuccess: (planName: string) => void
}

export default function PaymentModal({ planId, planName, amount, onClose, onSuccess }: PaymentModalProps) {
  const [step, setStep] = useState<'loading' | 'qrcode' | 'paid' | 'error'>('loading')
  const [qrCode, setQrCode] = useState('')
  const [error, setError] = useState('')
  const [planLabel, setPlanLabel] = useState('')
  const pollTimer = useRef<number | null>(null)

  useEffect(() => {
    const PLAN_LABELS: Record<string, string> = {
      daily: '日卡',
      weekly: '周卡',
      monthly: '月卡',
      enterprise: '企业版',
    }
    setPlanLabel(PLAN_LABELS[planId] || planId)

    createAlipayOrder(planId, planName, parseFloat(amount))
      .then(res => {
        if (res.error) throw new Error(res.error)
        setQrCode(res.qrCode || "")
        setStep('qrcode')
        pollPayStatus(res.outTradeNo || "", planId)
      })
      .catch(err => {
        setError(err.message || '创建订单失败')
        setStep('error')
      })

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pollPayStatus = (tradeNo: string, pid: string) => {
    pollTimer.current = window.setInterval(async () => {
      try {
        const res = await queryPayStatus(tradeNo, pid)
        if (res.status === 'PAID') {
          clearInterval(pollTimer.current!)
          setStep('paid')
          setTimeout(() => {
            onSuccess(planLabel)
            onClose()
          }, 1500)
        }
      } catch { /* ignore polling errors */ }
    }, 3000)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0d1f35] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div>
            <h3 className="text-white font-bold text-base">支付宝支付</h3>
            <p className="text-gray-400 text-xs mt-0.5">
              {step === 'loading' && '正在创建订单...'}
              {step === 'qrcode' && '请扫码完成支付'}
              {step === 'paid' && '支付成功！'}
              {step === 'error' && '支付失败'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center">
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-10 h-10 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">正在生成付款码...</p>
            </div>
          )}

          {step === 'qrcode' && (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-3 rounded-xl">
                <img src={qrCode} alt="支付宝付款码" className="w-52 h-52 object-contain" />
              </div>
              <p className="text-gray-400 text-xs">请使用<span className="text-yellow-400 font-bold">支付宝</span>扫码付款</p>
              <div className="text-center">
                <span className="text-yellow-400 text-2xl font-bold">¥{amount}</span>
                <span className="text-gray-400 text-sm ml-2">{planLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                支付成功后自动开通
              </div>
            </div>
          )}

          {step === 'paid' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <span className="text-green-400 text-3xl">✓</span>
              </div>
              <p className="text-green-400 font-bold text-base">支付成功！</p>
              <p className="text-gray-400 text-sm">正在开通 {planLabel}...</p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <span className="text-red-400 text-3xl">!</span>
              </div>
              <p className="text-red-400 font-bold text-base">订单创建失败</p>
              <p className="text-gray-400 text-sm text-center">{error}</p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-white/10 hover:bg-white/15 text-white text-sm rounded-lg border border-white/10 transition-colors"
              >
                关闭
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
