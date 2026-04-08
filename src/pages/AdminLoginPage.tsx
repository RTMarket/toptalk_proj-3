import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

/** 与 Supabase Functions 环境变量 ADMIN_TOKEN 一致 */
export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!token.trim()) {
      setErr('请输入管理员口令')
      return
    }
    setLoading(true)
    try {
      sessionStorage.setItem('toptalk_admin_token', token.trim())
      localStorage.setItem('toptalk_admin_token', token.trim())
      navigate('/admin/payments', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050d1a] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md bg-white/5 border border-white/15 rounded-3xl p-10">
        <h1 className="text-2xl font-bold text-white mb-2">管理后台登录</h1>
        <p className="text-gray-500 text-sm mb-8">请输入你在 Supabase 中配置的 ADMIN_TOKEN</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="管理员口令"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-400/50"
            autoComplete="current-password"
          />
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a365d] font-bold py-3 rounded-xl text-sm disabled:opacity-60"
          >
            {loading ? '…' : '进入后台'}
          </button>
        </form>
        <p className="text-center text-gray-600 text-xs mt-6">
          <Link to="/" className="text-gray-500 hover:text-white">返回首页</Link>
        </p>
      </div>
    </div>
  )
}
