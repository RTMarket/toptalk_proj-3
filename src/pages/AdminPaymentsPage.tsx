import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import { pricingPlans } from '../data/pricingData'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

type OrderStatus = 'pending' | 'approved' | 'rejected'

type PaymentOrder = {
  id: string | number
  order_no: string
  user_email: string
  user_nickname?: string | null
  plan_id: string
  plan_name: string
  amount: number
  bank_transfer_screenshot_url?: string | null
  status: OrderStatus
  created_at?: string
  approved_at?: string | null
}

function formatTime(iso?: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

function getAdminToken(): string {
  return sessionStorage.getItem('toptalk_admin_token') || localStorage.getItem('toptalk_admin_token') || ''
}

type InviteRedemptionRow = {
  id: number
  code: string
  plan_id: string
  user_email?: string | null
  user_nickname?: string | null
  redeemed_at?: string | null
}

export default function AdminPaymentsPage() {
  const navigate = useNavigate()
  const [adminToken, setAdminToken] = useState('')
  const [status, setStatus] = useState<OrderStatus>('pending')
  const [panel, setPanel] = useState<'invite'>('invite')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [selected, setSelected] = useState<PaymentOrder | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PaymentOrder | null>(null)
  const [rejectRemark, setRejectRemark] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PaymentOrder | null>(null)
  const [usageEmail, setUsageEmail] = useState('')
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageErr, setUsageErr] = useState('')
  const [usageData, setUsageData] = useState<any | null>(null)

  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteErr, setInviteErr] = useState('')
  const [inviteCounts, setInviteCounts] = useState<Record<string, number>>({})
  const [inviteRows, setInviteRows] = useState<InviteRedemptionRow[]>([])

  useEffect(() => {
    const t = getAdminToken()
    if (!t) {
      navigate('/admin/login', { replace: true })
      return
    }
    setAdminToken(t)
  }, [navigate])

  const canQuery = useMemo(() => {
    return !!SUPABASE_URL && !!adminToken.trim()
  }, [adminToken])

  const fetchOrders = async () => {
    if (!SUPABASE_URL) {
      setErr('缺少 VITE_SUPABASE_URL（请在环境变量中配置）')
      return
    }
    const t = adminToken.trim() || getAdminToken()
    if (!t) {
      navigate('/admin/login', { replace: true })
      return
    }
    setErr('')
    setInfo('')
    setLoading(true)
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/bank-transfer-order/orders?status=${encodeURIComponent(status)}`,
        { headers: { Authorization: `Bearer ${t}` } }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) throw new Error(data?.message || `请求失败（HTTP ${res.status}）`)
      setOrders((data.orders || []) as PaymentOrder[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载失败'
      setErr(msg)
    } finally {
      setLoading(false)
    }
  }

  const fetchInviteInventory = async () => {
    if (!SUPABASE_URL) return
    const t = adminToken.trim() || getAdminToken()
    if (!t) return
    setInviteErr('')
    setInviteLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bank-transfer-order/invite-inventory`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) throw new Error(data?.message || `请求失败（HTTP ${res.status}）`)
      setInviteCounts((data.counts || {}) as Record<string, number>)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载失败'
      setInviteErr(msg)
    } finally {
      setInviteLoading(false)
    }
  }

  const fetchInviteRedemptions = async () => {
    if (!SUPABASE_URL) return
    const t = adminToken.trim() || getAdminToken()
    if (!t) return
    setInviteErr('')
    setInviteLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bank-transfer-order/invite-redemptions`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) throw new Error(data?.message || `请求失败（HTTP ${res.status}）`)
      setInviteRows((data.rows || []) as InviteRedemptionRow[])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载失败'
      setInviteErr(msg)
    } finally {
      setInviteLoading(false)
    }
  }

  useEffect(() => {
    if (!canQuery) return
    void fetchInviteInventory()
    void fetchInviteRedemptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, adminToken, panel])

  const act = async (order: PaymentOrder, action: 'approve' | 'reject', remark?: string) => {
    if (!SUPABASE_URL) return
    const t = getAdminToken()
    if (!t) {
      navigate('/admin/login', { replace: true })
      return
    }
    setErr('')
    setInfo('')
    setLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bank-transfer-order/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ orderId: order.id, action, remark: remark || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) throw new Error(data?.message || `操作失败（HTTP ${res.status}）`)
      if (data.emailWarning) setInfo(String(data.emailWarning))
      await fetchOrders()
      setSelected(null)
      setRejectTarget(null)
      setRejectRemark('')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '操作失败'
      setErr(msg)
    } finally {
      setLoading(false)
    }
  }

  const del = async (order: PaymentOrder) => {
    if (!SUPABASE_URL) return
    const t = getAdminToken()
    if (!t) {
      navigate('/admin/login', { replace: true })
      return
    }
    setErr('')
    setInfo('')
    setLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bank-transfer-order/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ orderId: order.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) throw new Error(data?.message || `删除失败（HTTP ${res.status}）`)
      setInfo(`已删除订单：${order.order_no}`)
      setDeleteTarget(null)
      await fetchOrders()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '删除失败'
      setErr(msg)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsage = async (email: string) => {
    if (!SUPABASE_URL) return
    const t = getAdminToken()
    if (!t) {
      navigate('/admin/login', { replace: true })
      return
    }
    const e = (email || '').trim()
    if (!e) return
    setUsageErr('')
    setUsageData(null)
    setUsageLoading(true)
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/bank-transfer-order/user-usage?email=${encodeURIComponent(e)}`,
        { headers: { Authorization: `Bearer ${t}` } }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) throw new Error(data?.message || `查询失败（HTTP ${res.status}）`)
      setUsageData(data)
    } catch (e2: unknown) {
      const msg = e2 instanceof Error ? e2.message : '查询失败'
      setUsageErr(msg)
    } finally {
      setUsageLoading(false)
    }
  }

  const logout = () => {
    sessionStorage.removeItem('toptalk_admin_token')
    localStorage.removeItem('toptalk_admin_token')
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#050d1a] text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-3xl font-bold">订单审核后台</h1>
            <p className="text-gray-500 text-sm mt-1">审核用户提交的转账凭证，通过后套餐才会生效</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void fetchInviteInventory();
                void fetchInviteRedemptions();
              }}
              disabled={loading || inviteLoading}
              className="bg-yellow-400 hover:bg-yellow-300 text-[#1a365d] font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-60"
            >
              {(loading || inviteLoading) ? '加载中...' : '刷新列表'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="border border-white/20 text-gray-300 hover:text-white px-5 py-2.5 rounded-xl text-sm"
            >
              退出后台
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="px-4 py-2 rounded-xl text-sm border bg-yellow-400/15 text-yellow-300 border-yellow-400/30">
            邀请码兑换统计
          </div>
        </div>

        {info && (
          <div className="bg-amber-900/30 border border-amber-500/40 rounded-xl p-4 mb-4 text-amber-200 text-sm">
            ⚠️ {info}
          </div>
        )}

        {err && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 mb-4 text-red-400 text-sm">
            ❌ {err}
          </div>
        )}

        <div className="space-y-5">
            {inviteErr && (
              <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 text-red-400 text-sm">
                ❌ {inviteErr}
              </div>
            )}

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-white font-bold text-lg">邀请码库存（无需审核）</h2>
                  <p className="text-gray-500 text-sm mt-1">展示当前未使用的邀请码数量（按套餐统计）</p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchInviteInventory()}
                  disabled={inviteLoading}
                  className="bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4 py-2.5 rounded-xl text-sm disabled:opacity-60"
                >
                  {inviteLoading ? '加载中...' : '刷新库存'}
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {pricingPlans.filter(p => p.id !== 'free').map(p => (
                  <div key={p.id} className="bg-white/3 border border-white/10 rounded-xl p-4">
                    <div className="text-gray-500 text-xs mb-2">{p.name}</div>
                    <div className="text-white font-bold text-lg">{inviteCounts[p.id] ?? 0}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-white font-bold text-lg">邀请码兑换记录</h2>
                  <p className="text-gray-500 text-sm mt-1">用户兑换成功后自动生效，无需审核</p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchInviteRedemptions()}
                  disabled={inviteLoading}
                  className="bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4 py-2.5 rounded-xl text-sm disabled:opacity-60"
                >
                  {inviteLoading ? '加载中...' : '刷新记录'}
                </button>
              </div>

              <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5">
                    <tr className="border-b border-white/10">
                      {['兑换时间', '邮箱', '昵称', '套餐', '邀请码'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-gray-500 text-xs font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inviteRows.map(r => (
                      <tr key={String(r.id)} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                        <td className="px-5 py-3.5 text-gray-500">{formatTime(String(r.redeemed_at || ''))}</td>
                        <td className="px-5 py-3.5 text-gray-300">{r.user_email || '—'}</td>
                        <td className="px-5 py-3.5 text-gray-400">{r.user_nickname || '—'}</td>
                        <td className="px-5 py-3.5 text-gray-200">{pricingPlans.find(p => p.id === r.plan_id)?.name || r.plan_id}</td>
                        <td className="px-5 py-3.5 text-white font-mono tracking-widest">{r.code}</td>
                      </tr>
                    ))}
                    {inviteRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-gray-600">
                          {inviteLoading ? '加载中...' : '暂无兑换记录'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>

        {/* 对公转账已关闭：不再展示审核相关模块 */}

        {rejectTarget && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRejectTarget(null)}>
            <div className="max-w-md w-full bg-[#0b1730] border border-white/10 rounded-2xl p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-bold mb-2">拒绝订单</h3>
              <p className="text-gray-500 text-sm mb-4">可选：填写原因，将一并邮件通知用户</p>
              <textarea
                value={rejectRemark}
                onChange={e => setRejectRemark(e.target.value)}
                placeholder="拒绝原因（可选）"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setRejectTarget(null)} className="px-4 py-2 rounded-xl border border-white/15 text-gray-400 text-sm">取消</button>
                <button
                  type="button"
                  onClick={() => act(rejectTarget, 'reject', rejectRemark)}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-red-500/80 text-white text-sm font-bold disabled:opacity-60"
                >
                  确认拒绝
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
            <div className="max-w-md w-full bg-[#0b1730] border border-white/10 rounded-2xl p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-bold mb-2">删除订单</h3>
              <p className="text-gray-500 text-sm mb-4">
                确认删除订单 <span className="font-mono text-gray-300">{deleteTarget.order_no}</span> 吗？此操作不可恢复。
              </p>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl border border-white/15 text-gray-400 text-sm">取消</button>
                <button
                  type="button"
                  onClick={() => del(deleteTarget)}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-red-500/80 text-white text-sm font-bold disabled:opacity-60"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}

