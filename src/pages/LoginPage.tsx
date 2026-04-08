import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { accountLogin } from '../lib/accountApi';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email) e.email = '请输入邮箱地址';
    if (!form.password) e.password = '请输入密码';
    else if (form.password.length !== 8) e.password = '密码必须为8位';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) { setErrors(v); return; }
    setErrors({});
    setLoading(true);
    try {
      const user = await accountLogin({ email: form.email.trim(), password: form.password });
      // 兼容现有 UI：仍缓存用户信息（不再存明文密码）
      const plan = localStorage.getItem('toptalk_plan') || 'free';
      localStorage.setItem('toptalk_user', JSON.stringify({ email: user.email, nickname: user.nickname, plan }));
      window.dispatchEvent(new Event('toptalk_login'));
      navigate('/rooms');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登录失败';
      // 与旧体验一致：优先显示在 email 上
      setErrors({ email: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050d1a] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-12">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-yellow-500/20">T</div>
            <span className="text-2xl font-bold text-white">Top<span className="text-yellow-400">Talk</span></span>
          </Link>
        </div>

        {/* Login Form Card */}
        <div className="bg-white/5 border border-white/15 rounded-3xl p-10 backdrop-blur-sm">
          <h1 className="text-3xl font-bold text-white mb-3 tracking-wide">登录账户</h1>
          <p className="text-gray-500 mb-8">欢迎回来！请输入您的账户信息</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-gray-300 text-base font-medium mb-3">邮箱地址</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className={`w-full bg-white/5 border ${errors.email ? 'border-red-500/60' : 'border-white/15'} rounded-xl px-5 py-4 text-white text-base placeholder-gray-600 focus:outline-none focus:border-yellow-400/60 transition-colors`}
              />
              {errors.email && <p className="text-red-400 text-sm mt-2">{errors.email}</p>}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-gray-300 text-base font-medium mb-3">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="8位，字母/数字/组合均可"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  maxLength={8}
                  className={`w-full bg-white/5 border ${errors.password ? 'border-red-500/60' : 'border-white/15'} rounded-xl px-5 py-4 pr-12 text-white text-base placeholder-gray-600 focus:outline-none focus:border-yellow-400/60 transition-colors`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-sm mt-2">{errors.password}</p>}
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={e => setForm({ ...form, remember: e.target.checked })}
                  className="accent-yellow-400 w-4 h-4 rounded"
                />
                <span className="text-gray-500 text-sm">记住登录状态</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed text-[#1a365d] font-bold py-4 rounded-xl text-base transition-all flex items-center justify-center gap-2"
            >
              {loading ? '登录中...' : '登录账户'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <Link to="/register" className="text-gray-400 hover:text-white text-base transition-colors">
              还没有账户？<span className="text-yellow-400 font-medium">立即注册</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
