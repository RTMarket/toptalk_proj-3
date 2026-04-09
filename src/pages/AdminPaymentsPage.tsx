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

export default function AdminPaymentsPage() {
  const navigate = useNavigate()
  const [adminToken, setAdminToken] = useState('')
  const [status, setStatus] = useState<OrderStatus>('pending')
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

  // ── Invite code generator ───────────────────────────────
  const [invitePlanId, setInvitePlanId] = useState('monthly')
  const [inviteQty, setInviteQty] = useState(10)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteErr, setInviteErr] = useState('')
  const [inviteCodes, setInviteCodes] = useState<GeneratedInviteCode[]>([])

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

  useEffect(() => {
    if (!canQuery) return
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, adminToken])

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
              onClick={fetchOrders}
              disabled={loading}
              className="bg-yellow-400 hover:bg-yellow-300 text-[#1a365d] font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-60"
            >
              {loading ? '加载中...' : '刷新列表'}
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

        <div className="flex items-center gap-2 mb-4">
          {([
            { id: 'pending', label: '待审核' },
            { id: 'approved', label: '已通过' },
            { id: 'rejected', label: '已拒绝' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setStatus(t.id)}
              className={`px-4 py-2 rounded-xl text-sm border transition-colors ${
                status === t.id
                  ? 'bg-yellow-400/15 text-yellow-300 border-yellow-400/30'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              {t.label}
            </button>
          ))}
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

        {/* 邀请码生成（按套餐批量生成） */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-white font-bold text-lg">邀请码生成</h2>
              <p className="text-gray-500 text-sm mt-1">选择套餐并填写数量，一键生成 6 位（大写字母+数字）邀请码</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-gray-500 text-xs mb-2">选择套餐</div>
              <select
                value={invitePlanId}
                onChange={e => setInvitePlanId(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-400/50"
              >
                {pricingPlans.filter(p => p.id !== 'free').map(p => (
                  <option key={p.id} value={p.id} className="bg-[#0a1628]">
                    {p.name}（{p.duration}）
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-gray-500 text-xs mb-2">生成数量</div>
              <input
                type="number"
                min={1}
                max={500}
                value={inviteQty}
                onChange={e => setInviteQty(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-400/50"
              />
              <div className="text-gray-700 text-xs mt-2">建议一次 10～50 个；上限 500</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
              <div className="text-gray-500 text-xs mb-2">操作</div>
              <button
                type="button"
                disabled={inviteLoading}
                onClick={async () => {
                  setInviteErr('')
                  setInviteCodes([])
                  setInviteLoading(true)
                  try {
                    const codes = await adminGenerateInviteCodes({ planId: invitePlanId, quantity: inviteQty })
                    setInviteCodes(codes)
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : '生成失败'
                    setInviteErr(msg)
                  } finally {
                    setInviteLoading(false)
                  }
                }}
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-[#1a365d] font-bold px-5 py-3 rounded-xl text-sm disabled:opacity-60"
              >
                {inviteLoading ? '生成中...' : '生成邀请码'}
              </button>
            </div>
          </div>

          {inviteErr && <div className="mt-4 text-red-400 text-sm">❌ {inviteErr}</div>}

          {inviteCodes.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div className="text-gray-400 text-sm">已生成 {inviteCodes.length} 个</div>
                <button
                  type="button"
                  onClick={async () => {
                    const text = inviteCodes.map(c => c.code).join('\n')
                    try {
                      await navigator.clipboard.writeText(text)
                      setInfo(`已复制 ${inviteCodes.length} 个邀请码`)
                    } catch { /* ignore */ }
                  }}
                  className="text-yellow-400 text-sm hover:text-yellow-300 font-medium"
                >
                  一键复制全部 →
                </button>
              </div>

              <div className="bg-black/20 border border-white/10 rounded-xl p-4 max-h-56 overflow-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {inviteCodes.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={async () => { try { await navigator.clipboard.writeText(c.code) } catch { /* ignore */ } }}
                      className="font-mono tracking-widest text-sm text-white/90 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-center"
                      title="点击复制"
                    >
                      {c.code}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-gray-700 text-xs mt-3">提示：点击单个邀请码可复制。用户在个人中心输入即可立即开通对应套餐。</p>
            </div>
          )}

          <p className="text-gray-700 text-xs mt-4">
            说明：需后端已部署 `account/admin/generate-invite` 接口，并在数据库创建 `invite_codes` 表。
          </p>
        </div>

        {/* 用户使用情况（按邮箱） */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <div className="text-gray-500 text-xs mb-1">用户邮箱</div>
              <input
                value={usageEmail}
                onChange={e => setUsageEmail(e.target.value)}
                placeholder="例如：user@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-400/50"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchUsage(usageEmail)}
              disabled={usageLoading || !usageEmail.trim()}
              className="bg-white/10 hover:bg-white/15 border border-white/15 text-white px-4 py-2.5 rounded-xl text-sm disabled:opacity-60"
            >
              {usageLoading ? '查询中...' : '查询使用情况'}
            </button>
          </div>
          {usageErr && <div className="mt-3 text-sm text-red-400">❌ {usageErr}</div>}
          {usageData && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white/3 border border-white/10 rounded-xl p-4">
                <div className="text-gray-500 text-xs mb-2">套餐信息（最近一次通过）</div>
                <div className="text-white font-semibold">{usageData?.lastApprovedOrder?.plan_name || '—'}</div>
                <div className="text-gray-600 text-xs mt-1">
                  审核通过：{formatTime(usageData?.lastApprovedOrder?.approved_at)}
                </div>
              </div>
              <div className="bg-white/3 border border-white/10 rounded-xl p-4">
                <div className="text-gray-500 text-xs mb-2">高级聊天室使用</div>
                <div className="text-gray-200">创建次数：<span className="text-yellow-400 font-semibold">{usageData?.usage?.premiumCreates ?? 0}</span></div>
                <div className="text-gray-200">进入次数：<span className="text-yellow-400 font-semibold">{usageData?.usage?.premiumEnters ?? 0}</span></div>
              </div>
              <div className="bg-white/3 border border-white/10 rounded-xl p-4">
                <div className="text-gray-500 text-xs mb-2">即时聊天室使用</div>
                <div className="text-gray-200">创建次数：<span className="text-yellow-400 font-semibold">{usageData?.usage?.instantCreates ?? 0}</span></div>
                <div className="text-gray-200">进入次数：<span className="text-yellow-400 font-semibold">{usageData?.usage?.instantEnters ?? 0}</span></div>
                <div className="text-gray-600 text-xs mt-1">参与房间数：{usageData?.usage?.participatedRooms ?? 0}</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="border-b border-white/10">
                {['订单号', '邮箱', '昵称', '套餐', '金额', '时间', '凭证', '操作'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-gray-500 text-xs font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={String(o.id)} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                  <td className="px-5 py-3.5 text-gray-300 font-mono">{o.order_no}</td>
                  <td className="px-5 py-3.5 text-gray-300">{o.user_email}</td>
                  <td className="px-5 py-3.5 text-gray-400">{o.user_nickname || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-200">{o.plan_name}</td>
                  <td className="px-5 py-3.5 text-yellow-400 font-semibold">¥{o.amount}</td>
                  <td className="px-5 py-3.5 text-gray-500">{formatTime(o.created_at)}</td>
                  <td className="px-5 py-3.5">
                    {o.bank_transfer_screenshot_url ? (
                      <button
                        type="button"
                        onClick={() => setSelected(o)}
                        className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                      >
                        查看
                      </button>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => act(o, 'approve')}
                          disabled={loading}
                          className="bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60"
                        >
                          通过
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejectTarget(o); setRejectRemark('') }}
                          disabled={loading}
                          className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60"
                        >
                          拒绝
                        </button>
                        <button
                          type="button"
                          onClick={() => { setUsageEmail(o.user_email); fetchUsage(o.user_email) }}
                          disabled={loading}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60"
                        >
                          使用情况
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(o)}
                          disabled={loading}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 text-red-300 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60"
                        >
                          删除
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setUsageEmail(o.user_email); fetchUsage(o.user_email) }}
                          disabled={loading}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60"
                        >
                          使用情况
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(o)}
                          disabled={loading}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 text-red-300 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60"
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-600">
                    {loading ? '加载中...' : '暂无数据'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selected?.bank_transfer_screenshot_url && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
            <div className="max-w-3xl w-full bg-[#0b1730] border border-white/10 rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <div className="text-white font-semibold text-sm">支付凭证预览</div>
                <button type="button" className="text-gray-500 hover:text-white" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="p-5">
                <img
                  src={selected.bank_transfer_screenshot_url}
                  alt="支付凭证"
                  className="w-full max-h-[70vh] object-contain rounded-xl bg-black/30"
                />
                <div className="mt-4 text-xs text-gray-500">
                  {selected.user_email} · {selected.plan_name} · ¥{selected.amount}
                </div>
              </div>
            </div>
          </div>
        )}

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

