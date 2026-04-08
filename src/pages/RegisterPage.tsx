import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { normalizeClientAnonKey } from '../lib/anonKey';
import { clampNickname, isValidNickname, NICKNAME_MAX_LEN } from '../lib/nickname';
import { accountRegister } from '../lib/accountApi';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
const ANON_KEY = normalizeClientAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

function emailHeaders() {
  const k = ANON_KEY
  return {
    'Content-Type': 'application/json',
    apikey: k,
    Authorization: `Bearer ${k}`,
    'x-api-key': k,
  } as Record<string, string>
}

export default function RegisterPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
      email: '', nickname: '', password: '', confirmPassword: '', emailCode: '', agree: false,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [sendLoading, setSendLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [codeCountdown, setCodeCountdown] = useState(0);

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.email) e.email = '请输入邮箱地址';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = '邮箱格式不正确';
        if (!form.emailCode || !/^\d{6}$/.test(form.emailCode)) e.emailCode = '请输入6位邮箱验证码';
        if (!form.nickname.trim()) e.nickname = '请输入昵称';
        else if (!isValidNickname(form.nickname)) e.nickname = `昵称需在 1～${NICKNAME_MAX_LEN} 个字符以内（汉字、英文、数字均可）`;
        if (!form.password) e.password = '请输入密码';
        else if (form.password.length !== 8) e.password = '密码必须为8位';
        if (form.password !== form.confirmPassword) e.confirmPassword = '两次密码输入不一致';
        if (!form.agree) e.agree = '请同意用户协议';
        return e;
    };

    const handleSendCode = async () => {
        const e: Record<string, string> = {};
        if (!form.email) e.email = '请先填写邮箱';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = '邮箱格式不正确';
        if (!SUPABASE_URL || !ANON_KEY || ANON_KEY.includes('placeholder')) {
            setErrors({ ...e, email: '邮件服务未配置（请设置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）' });
            return;
        }
        if (Object.keys(e).length) { setErrors(e); return; }
        setSendLoading(true);
        setErrors({});
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-email/send-register-code`, {
                method: 'POST',
                headers: emailHeaders(),
                body: JSON.stringify({ email: form.email.trim() }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) throw new Error(data?.message || `发送失败（HTTP ${res.status}）`);
            setCodeCountdown(60);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '发送失败';
            setErrors({ email: msg });
        } finally {
            setSendLoading(false);
        }
    };

    useEffect(() => {
        if (codeCountdown <= 0) return;
        const t = setTimeout(() => setCodeCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [codeCountdown]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const v = validate();
        if (Object.keys(v).length > 0) { setErrors(v); return; }
        if (!SUPABASE_URL || !ANON_KEY || ANON_KEY.includes('placeholder')) {
            setErrors({ email: '环境未配置，无法完成邮箱验证' });
            return;
        }
        setLoading(true);
        setErrors({});
        try {
            const user = await accountRegister({
              email: form.email.trim(),
              nickname: form.nickname.trim(),
              password: form.password,
              code: form.emailCode.trim(),
            })

            localStorage.setItem('toptalk_user', JSON.stringify({
              nickname: user.nickname,
              email: user.email,
              plan: 'free',
            }));
            localStorage.setItem('toptalk_plan', 'free');
            window.dispatchEvent(new Event('toptalk_login'));
            navigate('/rooms');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '注册失败';
            setErrors({ emailCode: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050d1a] flex items-center justify-center px-6 py-16">
            <div className="w-full max-w-lg">
                <div className="flex justify-center mb-8">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-yellow-500/20">T</div>
                        <span className="text-2xl font-bold text-white">Top<span className="text-yellow-400">Talk</span></span>
                    </Link>
                </div>

                <div className="bg-white/5 border border-white/15 rounded-3xl p-10 backdrop-blur-sm">
                    <h1 className="text-3xl font-bold text-white mb-3 tracking-wide">注册账户</h1>
                    <p className="text-gray-500 mb-8">创建账户，开始使用 TopTalk</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-gray-300 text-base font-medium mb-3">邮箱地址</label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="your@email.com"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    className={`flex-1 bg-white/5 border ${errors.email ? 'border-red-500/60' : 'border-white/15'} rounded-xl px-5 py-4 text-white text-base placeholder-gray-600 focus:outline-none focus:border-yellow-400/60 transition-colors`}
                                />
                                <button
                                    type="button"
                                    onClick={handleSendCode}
                                    disabled={sendLoading || codeCountdown > 0}
                                    className="shrink-0 px-4 rounded-xl text-sm font-bold bg-yellow-400/20 border border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/30 disabled:opacity-50"
                                >
                                    {sendLoading ? '…' : codeCountdown > 0 ? `${codeCountdown}s` : '发验证码'}
                                </button>
                            </div>
                            {errors.email && <p className="text-red-400 text-sm mt-2">{errors.email}</p>}
                        </div>

                        <div>
                            <label className="block text-gray-300 text-base font-medium mb-3">邮箱验证码</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="6位数字"
                                value={form.emailCode}
                                onChange={e => setForm({ ...form, emailCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                                className={`w-full bg-white/5 border ${errors.emailCode ? 'border-red-500/60' : 'border-white/15'} rounded-xl px-5 py-4 text-white text-base placeholder-gray-600 focus:outline-none focus:border-yellow-400/60 transition-colors tracking-widest text-center font-mono`}
                            />
                            {errors.emailCode && <p className="text-red-400 text-sm mt-2">{errors.emailCode}</p>}
                        </div>

                        <div>
                            <label className="block text-gray-300 text-base font-medium mb-3">昵称</label>
                            <input
                                type="text"
                                placeholder={`最多 ${NICKNAME_MAX_LEN} 个字符（汉字、英文、数字均可）`}
                                value={form.nickname}
                                onChange={e => setForm({ ...form, nickname: clampNickname(e.target.value) })}
                                className={`w-full bg-white/5 border ${errors.nickname ? 'border-red-500/60' : 'border-white/15'} rounded-xl px-5 py-4 text-white text-base placeholder-gray-600 focus:outline-none focus:border-yellow-400/60 transition-colors`}
                            />
                            <p className="text-gray-600 text-xs mt-1.5">不超过 {NICKNAME_MAX_LEN} 个字符</p>
                            {errors.nickname && <p className="text-red-400 text-sm mt-2">{errors.nickname}</p>}
                        </div>

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

                        <div>
                            <label className="block text-gray-300 text-base font-medium mb-3">确认密码</label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    placeholder="再次输入密码"
                                    value={form.confirmPassword}
                                    onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                                    maxLength={8}
                                    className={`w-full bg-white/5 border ${errors.confirmPassword ? 'border-red-500/60' : 'border-white/15'} rounded-xl px-5 py-4 pr-12 text-white text-base placeholder-gray-600 focus:outline-none focus:border-yellow-400/60 transition-colors`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                >
                                    {showConfirm ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            </div>
                            {errors.confirmPassword && <p className="text-red-400 text-sm mt-2">{errors.confirmPassword}</p>}
                        </div>

                        <div>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.agree}
                                    onChange={e => setForm({ ...form, agree: e.target.checked })}
                                    className="mt-1 accent-yellow-400 w-5 h-5 rounded"
                                />
                                <span className="text-gray-400 text-base leading-relaxed">
                                    我已阅读并同意 <a href="/legal/terms" className="text-yellow-400 hover:underline">《用户协议》</a> 和 <a href="/legal/privacy" className="text-yellow-400 hover:underline">《隐私政策》</a>
                                </span>
                            </label>
                            {errors.agree && <p className="text-red-400 text-sm mt-2">{errors.agree}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed text-[#1a365d] font-bold py-4 rounded-xl text-base transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? '创建中...' : '创建账户'}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-white/10 text-center">
                        <Link to="/login" className="text-gray-400 hover:text-white text-base transition-colors">
                            已有账户？<span className="text-yellow-400 font-medium">立即登录</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
