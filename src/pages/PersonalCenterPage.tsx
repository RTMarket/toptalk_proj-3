import { useState, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { pricingPlans } from '../data/pricingData';
import { Link, useSearchParams } from 'react-router-dom';
import { clampNickname, isValidNickname, NICKNAME_MAX_LEN } from '../lib/nickname';
import { isValidInviteCode, normalizeInviteCode, redeemInviteCode } from '../lib/inviteCodeApi';

const planLabels: Record<string, string> = {
  free: '免费版', single: '单次高级', daily: '日卡', weekly: '周卡',
  monthly: '月卡', enterprise: '企业版', enterprise_pro: '企业版 Pro',
};
const planColors: Record<string, string> = {
  free: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  single: 'from-yellow-400/20 to-yellow-600/10 border-yellow-400/30',
  daily: 'from-yellow-400/20 to-yellow-600/10 border-yellow-400/30',
  weekly: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
  monthly: 'from-yellow-400/30 to-yellow-600/15 border-yellow-400/40',
  enterprise: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  enterprise_pro: 'from-pink-500/20 to-pink-600/10 border-pink-500/30',
};
const planBadgeColors: Record<string, string> = {
  free: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  single: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
  daily: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
  weekly: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  monthly: 'bg-yellow-400/30 text-yellow-300 border-yellow-400/40',
  enterprise: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  enterprise_pro: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

function useCountdown(targetDate: string | null) {
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    if (!targetDate) { setRemaining(0); return; }
    const calc = () => {
      const t = new Date(String(targetDate)).getTime();
      if (!Number.isFinite(t)) { setRemaining(0); return; }
      setRemaining(Math.max(0, Math.floor((t - Date.now()) / 1000)));
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return remaining;
}

function formatCountdown(s: number) {
  if (s <= 0) return null;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}天 ${h}小时`;
  if (h > 0) return `${h}小时 ${m}分钟`;
  return `${m}分钟 ${s % 60}秒`;
}

function toMs(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(String(iso)).getTime();
  return Number.isFinite(t) ? t : null;
}

function getPlanDays(planId: string): number | null {
  switch (planId) {
    case 'daily': return 1;
    case 'weekly': return 7;
    case 'monthly': return 30;
    case 'enterprise': return 30;
    case 'enterprise_pro': return 30;
    // 单次高级：不按时间过期，给一个很长的展示有效期（由高级聊天室“单次消耗”逻辑控制）
    case 'single': return 3650;
    default: return null;
  }
}

type Tab = 'subscription' | 'upgrade' | 'profile' | 'security';

// Password input with eye toggle
function PwdInput({ id, label, value, onChange, placeholder, error, maxLength }: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; placeholder: string; error?: string; maxLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-gray-300 text-sm font-medium mb-2">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`w-full bg-white/5 border ${error ? 'border-red-500/60' : 'border-white/15'} rounded-xl px-5 py-3.5 pr-12 text-white text-base placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 transition-colors`}
        />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
          {show ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
    </div>
  );
}

export default function PersonalCenterPage() {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') || '').trim() as Tab;
  const [activeTab, setActiveTab] = useState<Tab>(initialTab || 'subscription');

  const [user, setUser] = useState<{ nickname: string; email: string; plan: string; password?: string; planPurchasedAt?: string; planExpiresAt?: string } | null>(null);
  const [plan, setPlan] = useState('free');
  const [planPurchasedAt, setPlanPurchasedAt] = useState('');
  const [planExpiresAt, setPlanExpiresAt] = useState('');
  const remaining = useCountdown(planExpiresAt || null);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  useEffect(() => {
    const loadUser = () => {
      const stored = localStorage.getItem('toptalk_user');
      // planId 以 localStorage 为准，但必须是已知 id；否则一律回退 free（避免出现“58天”等异常显示）
      let p = (localStorage.getItem('toptalk_plan') || 'free').trim();
      try {
        const known = new Set(pricingPlans.map(x => x.id));
        if (!known.has(p)) p = 'free';
      } catch { /* ignore */ }
      // 兼容多来源：toptalk_plan_* / toptalk_subscription / toptalk_user 字段
      let purchased = localStorage.getItem('toptalk_plan_purchased') || '';
      let expires = localStorage.getItem('toptalk_plan_expires') || '';
      if (stored) {
        try { setUser({ ...JSON.parse(stored), plan: p }); }
        catch { setUser({ nickname: stored, email: stored, plan: p }); }
      }
      try {
        const u = stored ? JSON.parse(stored) : null;
        if (!purchased) purchased = String(u?.planPurchasedAt || '');
        if (!expires) expires = String(u?.planExpiresAt || '');
      } catch { /* ignore */ }
      if (!expires) {
        try {
          const subRaw = localStorage.getItem('toptalk_subscription');
          const sub = subRaw ? JSON.parse(subRaw) : null;
          expires = String(sub?.expireAt || sub?.expiresAt || '');
        } catch { /* ignore */ }
      }

      // 免费版：不显示任何有效期（清掉遗留的 plan 时间字段，避免误显示）
      if (p === 'free') {
        purchased = '';
        expires = '';
        try {
          localStorage.removeItem('toptalk_plan_purchased');
          localStorage.removeItem('toptalk_plan_expires');
          localStorage.removeItem('toptalk_subscription');
        } catch { /* ignore */ }
      }

      // 规则 A：不叠加（到期时间始终=生效时间+套餐天数）
      // 如果本地缓存出现异常（例如显示 58 天），在个人中心做一次校准并写回 localStorage
      try {
        const days = getPlanDays(p);
        const purchasedMs = toMs(purchased);
        const expiresMs = toMs(expires);
        if (days) {
          const toleranceMs = 2 * 60 * 1000;
          // 如果缺少 purchasedAt，但 expiresAt 异常偏大（例如 58 天），按“现在生效”校准
          const maxRemainingMs = days * 86400000 + toleranceMs;
          if (!purchasedMs) {
            const remainingMs = expiresMs ? Math.max(0, expiresMs - Date.now()) : 0;
            if (!expiresMs || remainingMs > maxRemainingMs) {
              const nowMs = Date.now();
              purchased = new Date(nowMs).toISOString();
              expires = new Date(nowMs + days * 86400000).toISOString();
              localStorage.setItem('toptalk_plan_purchased', purchased);
              localStorage.setItem('toptalk_plan_expires', expires);
              localStorage.setItem('toptalk_subscription', JSON.stringify({ planId: p, expireAt: expires }));
            }
          } else {
            const expectedExpiresMs = purchasedMs + days * 86400000;
            if (!expiresMs || expiresMs > expectedExpiresMs + toleranceMs || expiresMs < expectedExpiresMs - toleranceMs) {
              expires = new Date(expectedExpiresMs).toISOString();
              localStorage.setItem('toptalk_plan_expires', expires);
              localStorage.setItem('toptalk_subscription', JSON.stringify({ planId: p, expireAt: expires }));
            }
          }
        }
      } catch { /* ignore */ }

      setPlan(p); setPlanPurchasedAt(purchased); setPlanExpiresAt(expires);
    };
    loadUser();
    const h = () => loadUser();
    window.addEventListener('toptalk_login', h);
    window.addEventListener('storage', h);
    return () => { window.removeEventListener('toptalk_login', h); window.removeEventListener('storage', h); };
  }, []);

  const [nickname, setNickname] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileNicknameError, setProfileNicknameError] = useState('');
  useEffect(() => { if (user) setNickname(user.nickname); }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNicknameError('');
    if (!nickname.trim()) {
      setProfileNicknameError('请输入昵称');
      return;
    }
    if (!isValidNickname(nickname)) {
      setProfileNicknameError(`昵称需在 1～${NICKNAME_MAX_LEN} 个字符以内`);
      return;
    }
    setProfileSaving(true);
    await new Promise(r => setTimeout(r, 800));
    const base = localStorage.getItem('toptalk_user') ? JSON.parse(localStorage.getItem('toptalk_user')) : {};
    const updated = { ...base, nickname: nickname.trim() };
    localStorage.setItem('toptalk_user', JSON.stringify(updated));
    setUser(updated);
    window.dispatchEvent(new Event('toptalk_login'));
    setProfileSaving(false);
    setProfileSuccess(true);
    setTimeout(() => setProfileSuccess(false), 2500);
  };

  // ── Password reset ──
  const [pwdForm, setPwdForm] = useState({ newPwd: '', confirmPwd: '' });
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!pwdForm.newPwd) errs.newPwd = '请输入新密码';
    else if (pwdForm.newPwd.length !== 8) errs.newPwd = '新密码必须为8位';
    if (pwdForm.newPwd !== pwdForm.confirmPwd) errs.confirmPwd = '两次密码输入不一致';
    if (Object.keys(errs).length > 0) { setPwdErrors(errs); return; }
    setPwdErrors({});
    setPwdLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    // Update stored password (current user + registration record)
    const base = localStorage.getItem('toptalk_user') ? JSON.parse(localStorage.getItem('toptalk_user') as string) : {};
    const email = (base.email || user?.email || '') as string;
    localStorage.setItem('toptalk_user', JSON.stringify({ ...base, password: pwdForm.newPwd }));
    if (email) {
      const regKey = 'toptalk_user_' + email;
      const regRaw = localStorage.getItem(regKey);
      if (regRaw) {
        try {
          const reg = JSON.parse(regRaw);
          localStorage.setItem(regKey, JSON.stringify({ ...reg, password: pwdForm.newPwd }));
        } catch { /* ignore */ }
      }
    }
    setUser(prev => prev ? { ...prev, password: pwdForm.newPwd } : prev);
    setPwdForm({ newPwd: '', confirmPwd: '' });
    setPwdSuccess(true);
    setPwdLoading(false);
    setTimeout(() => setPwdSuccess(false), 3000);
  };

  const currentPlanData = pricingPlans.find(p => p.id === plan);
  const purchasedDate = planPurchasedAt ? new Date(planPurchasedAt).toLocaleDateString('zh-CN') : null;

  if (!user) {
    return <div className="min-h-screen bg-[#050d1a] flex items-center justify-center"><div className="text-gray-400">加载中...</div></div>;
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'subscription', label: '订阅套餐', icon: '💎' },
    { id: 'upgrade', label: '升级套餐', icon: '💳' },
    { id: 'profile', label: '个人资料', icon: '👤' },
    { id: 'security', label: '账户安全', icon: '🔒' },
  ];

  useEffect(() => {
    const t = (searchParams.get('tab') || '').trim() as Tab;
    if (!t) return;
    if (tabs.some(x => x.id === t)) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  return (
    <div className="min-h-screen bg-[#050d1a] text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">个人中心</h1>
          <p className="text-gray-500">管理您的账户信息、套餐状态和账户安全</p>
        </div>

        <div className="flex gap-2 mb-8 bg-white/5 border border-white/10 rounded-2xl p-1.5 w-fit max-w-full overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === t.id ? 'bg-yellow-400/15 text-yellow-400 shadow-sm' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ═══ Subscription Tab ═══ */}
        {activeTab === 'subscription' && (
          <div className="space-y-6 animate-fadeIn">
            <div className={`relative rounded-3xl p-8 bg-gradient-to-br ${planColors[plan] || planColors.free} border`}>
              <div className="absolute inset-0 rounded-3xl bg-yellow-400/5" />
              <div className="relative">
                <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs px-3 py-1 rounded-full border bg-white/5">当前套餐</span>
                      <span className={`text-xs px-3 py-1 rounded-full border font-medium ${planBadgeColors[plan] || planBadgeColors.free}`}>{planLabels[plan] || plan}</span>
                    </div>
                    <div className="text-4xl font-extrabold text-white mb-1">{planLabels[plan] || plan}</div>
                    {currentPlanData && <div className="text-gray-400 text-sm">{currentPlanData.duration} · {currentPlanData.roomCount}个{plan === 'free' ? '' : '高级'}聊天室</div>}
                  </div>
                  <div className="text-right">
                    {plan !== 'free' && currentPlanData ? (
                      <div><div className="text-3xl font-extrabold text-yellow-400">{typeof currentPlanData.price === 'number' ? `¥${currentPlanData.price}` : currentPlanData.price}</div>
                      <div className="text-gray-500 text-xs">{currentPlanData.priceUnit}</div></div>
                    ) : <div className="text-3xl font-extrabold text-gray-400">免费</div>}
                  </div>
                </div>
                {currentPlanData && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentPlanData.features.map(f => <span key={f} className="text-xs bg-white/5 border border-white/10 text-gray-300 px-3 py-1 rounded-full">✓ {f}</span>)}
                  </div>
                )}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {purchasedDate && (
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"><div className="text-gray-500 text-xs mb-1">开通时间</div><div className="text-white font-semibold text-sm">{purchasedDate}</div></div>
                  )}
                  {planExpiresAt && remaining > 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"><div className="text-gray-500 text-xs mb-1">剩余有效期</div><div className="text-yellow-400 font-bold text-sm">{formatCountdown(remaining) || '即将到期'}</div></div>
                  ) : plan !== 'free' ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"><div className="text-gray-500 text-xs mb-1">剩余有效期</div><div className="text-gray-400 font-semibold text-sm">已过期</div></div>
                  ) : null}
                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"><div className="text-gray-500 text-xs mb-1">房间数量</div><div className="text-white font-semibold text-sm">{currentPlanData?.roomCount || 1}个</div></div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">邀请码开通套餐</h3>
              <p className="text-gray-500 text-sm mb-4">输入 6 位邀请码（大写字母+数字）即可立即开通对应套餐</p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={inviteCode}
                  onChange={e => {
                    setInviteError('');
                    setInviteSuccess('');
                    setInviteCode(normalizeInviteCode(e.target.value));
                  }}
                  placeholder="例如：A1B2C3"
                  inputMode="text"
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-5 py-3.5 text-white text-base placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 transition-colors tracking-widest font-mono"
                  maxLength={6}
                />
                <button
                  disabled={inviteLoading || !isValidInviteCode(inviteCode)}
                  onClick={async () => {
                    if (!isValidInviteCode(inviteCode)) { setInviteError('请输入 6 位大写字母/数字邀请码'); return; }
                    setInviteLoading(true);
                    setInviteError('');
                    setInviteSuccess('');
                    try {
                      const redeemResult = await redeemInviteCode(inviteCode);
                      localStorage.setItem('toptalk_plan', redeemResult.planId);
                      if (redeemResult.purchasedAt) localStorage.setItem('toptalk_plan_purchased', redeemResult.purchasedAt);
                      localStorage.setItem('toptalk_plan_expires', redeemResult.expiresAt);
                      localStorage.setItem('toptalk_subscription', JSON.stringify({ planId: redeemResult.planId, expireAt: redeemResult.expiresAt }));
                      // 立即更新本页状态（避免依赖 storage 事件导致显示不刷新）
                      setPlan(redeemResult.planId)
                      setPlanPurchasedAt(redeemResult.purchasedAt || '')
                      setPlanExpiresAt(redeemResult.expiresAt)
                      setUser(prev => prev ? { ...prev, plan: redeemResult.planId, planPurchasedAt: redeemResult.purchasedAt, planExpiresAt: redeemResult.expiresAt } : prev)
                      // 同步 user 信息（不影响登录态）
                      try {
                        const raw = localStorage.getItem('toptalk_user');
                        const u = raw ? JSON.parse(raw) : {};
                        u.plan = redeemResult.planId;
                        u.planPurchasedAt = redeemResult.purchasedAt;
                        u.planExpiresAt = redeemResult.expiresAt;
                        localStorage.setItem('toptalk_user', JSON.stringify(u));
                      } catch { /* ignore */ }
                      window.dispatchEvent(new Event('storage'));
                      window.dispatchEvent(new Event('toptalk_login'));
                      setInviteCode('');
                      setInviteSuccess('兑换成功，套餐已开通');
                    } catch (e: unknown) {
                      const msg = e instanceof Error ? e.message : '兑换失败';
                      setInviteError(msg);
                    } finally {
                      setInviteLoading(false);
                    }
                  }}
                  className="sm:w-40 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a365d] font-bold py-3.5 rounded-xl text-base hover:from-yellow-300 hover:to-yellow-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {inviteLoading ? '兑换中...' : '立即开通'}
                </button>
              </div>

              {inviteError && <p className="text-red-400 text-sm mt-3">{inviteError}</p>}
              {inviteSuccess && <p className="text-green-400 text-sm mt-3">{inviteSuccess}</p>}
              <p className="text-gray-700 text-xs mt-3">
                说明：邀请码兑换需要后端已部署 `account/redeem-invite` 接口。
              </p>
            </div>
          </div>
        )}

        {/* ═══ Upgrade Tab ═══ */}
        {activeTab === 'upgrade' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">升级套餐</h2>
                  <p className="text-gray-500 text-sm">查看 6 个订阅套餐详情。开通方式：在“订阅套餐”页签输入邀请码即可立即生效。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('subscription')}
                  className="bg-yellow-400/15 hover:bg-yellow-400/20 border border-yellow-400/25 text-yellow-300 font-semibold px-4 py-2 rounded-xl text-sm"
                >
                  去输入邀请码 →
                </button>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">6个订阅套餐一览</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pricingPlans.filter(p => p.id !== 'free').map(p => (
                  <div
                    key={p.id}
