import { useState, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { pricingPlans } from '../data/pricingData';
import { Link, useSearchParams } from 'react-router-dom';
import { clampNickname, isValidNickname, NICKNAME_MAX_LEN } from '../lib/nickname';
import { isValidInviteCode, normalizeInviteCode, redeemInviteCode } from '../lib/inviteCodeApi';
import { accountMe } from '../lib/accountApi';
import { computePlanExpiresAtIso, computePlanExpiresAtMs, SINGLE_PLAN_DURATION_MS } from '../lib/planExpiry';
import { isSingleConsumedForCurrentPurchase } from '../lib/singlePlanConsumption';

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
      // 用 ceil，避免出现「29天0小时」这类边界展示（分钟/秒要算进倒计时）
      setRemaining(Math.max(0, Math.ceil((t - Date.now()) / 1000)));
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
  if (d > 0) return `${d}天 ${h}小时 ${m}分钟`;
  if (h > 0) return `${h}小时 ${m}分钟`;
  return `${m}分钟 ${s % 60}秒`;
}

function toMs(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(String(iso)).getTime();
  return Number.isFinite(t) ? t : null;
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

      // 规则：开通时刻起算；单次 2h30m；日/周/月 为 N×24h−1 分钟。与 planExpiry.ts / 后端 redeem 一致。
      try {
        if (p !== 'free') {
          let purchasedMsRaw = toMs(purchased);
          const expiresMs = toMs(expires);
          const toleranceMs = 2 * 60 * 1000;
          // 仅有到期、缺少开通：单次可从到期反推开通，避免每次刷新把开通时间写成「现在」
          if (!purchasedMsRaw && expiresMs && p === 'single') {
            purchasedMsRaw = expiresMs - SINGLE_PLAN_DURATION_MS;
            purchased = new Date(purchasedMsRaw).toISOString();
            localStorage.setItem('toptalk_plan_purchased', purchased);
          }
          const basePurchase = purchasedMsRaw ?? Date.now();
          const expectedMs = computePlanExpiresAtMs(p, basePurchase);
          if (expectedMs != null) {
            if (!purchasedMsRaw) {
              purchased = new Date(basePurchase).toISOString();
              expires = new Date(expectedMs).toISOString();
              localStorage.setItem('toptalk_plan_purchased', purchased);
              localStorage.setItem('toptalk_plan_expires', expires);
              localStorage.setItem('toptalk_subscription', JSON.stringify({ planId: p, expireAt: expires }));
            } else if (!expiresMs || Math.abs(expiresMs - expectedMs) > toleranceMs) {
              expires = new Date(expectedMs).toISOString();
              localStorage.setItem('toptalk_plan_expires', expires);
              localStorage.setItem('toptalk_subscription', JSON.stringify({ planId: p, expireAt: expires }));
            }
          }
        }
      } catch { /* ignore */ }

      setPlan(p); setPlanPurchasedAt(purchased); setPlanExpiresAt(expires);
    };
    loadUser();

    // 规则：个人中心以服务端为准做一次订阅状态同步（跨设备一致；换套餐按最新套餐的 purchasedAt/expiresAt 计算）
    void (async () => {
      try {
        const me = await accountMe();
        const nextPlan = (me?.plan || 'free').trim() || 'free';
        let nextPurchasedAt = String(me?.planPurchasedAt || '').trim();
        let nextExpiresAt = String(me?.planExpiresAt || '').trim();

        const localPlanGuard = (localStorage.getItem('toptalk_plan') || 'free').trim();
        const localExpGuard = toMs(localStorage.getItem('toptalk_plan_expires'));
        const localActiveGuard = localPlanGuard !== 'free' && localExpGuard != null && localExpGuard > Date.now();

        // 服务端为 free：仅当本地也没有有效付费订阅时才清空（避免 DB 未同步导致刷新后变免费）
        if (nextPlan === 'free') {
          const localPlan = localPlanGuard;
          const localExp = localExpGuard;
          const localActive = localPlan !== 'free' && localExp != null && localExp > Date.now();
          if (!localActive) {
            try {
              localStorage.setItem('toptalk_plan', 'free');
              localStorage.removeItem('toptalk_plan_purchased');
              localStorage.removeItem('toptalk_plan_expires');
              localStorage.removeItem('toptalk_subscription');
            } catch { /* ignore */ }
          }
        } else {
          if (!nextExpiresAt && nextPurchasedAt) {
            const pm = toMs(nextPurchasedAt);
            if (pm) {
              const iso = computePlanExpiresAtIso(nextPlan, pm);
              if (iso) nextExpiresAt = iso;
            }
          }
          if (!nextExpiresAt) nextExpiresAt = (localStorage.getItem('toptalk_plan_expires') || '').trim();
          if (!nextPurchasedAt) nextPurchasedAt = (localStorage.getItem('toptalk_plan_purchased') || '').trim();

          try {
            localStorage.setItem('toptalk_plan', nextPlan);
            if (nextPurchasedAt) localStorage.setItem('toptalk_plan_purchased', nextPurchasedAt);
            if (nextExpiresAt) {
              localStorage.setItem('toptalk_plan_expires', nextExpiresAt);
              localStorage.setItem('toptalk_subscription', JSON.stringify({ planId: nextPlan, expireAt: nextExpiresAt }));
            }
          } catch { /* ignore */ }
        }

        // 服务端误报 free 但本地仍有效时，勿覆盖 toptalk_user.plan（否则刷新后变免费）
        if (!(nextPlan === 'free' && localActiveGuard)) {
          try {
            const raw = localStorage.getItem('toptalk_user');
            const u = raw ? JSON.parse(raw) : {};
            u.plan = nextPlan;
            if (nextPurchasedAt) u.planPurchasedAt = nextPurchasedAt;
            if (nextExpiresAt) u.planExpiresAt = nextExpiresAt;
            localStorage.setItem('toptalk_user', JSON.stringify(u));
          } catch { /* ignore */ }
        }

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('toptalk_login'));
        loadUser();
      } catch {
        // ignore: 未登录/会话过期/后端未部署时，仍以本地缓存展示
      }
    })();

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

  if (!user) {
    return <div className="min-h-screen bg-[#050d1a] flex items-center justify-center"><div className="text-gray-400">加载中...</div></div>;
  }

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
                  {plan === 'single' ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                      <div className="text-gray-500 text-xs mb-1">剩余有效期</div>
                      {planExpiresAt && remaining > 0 ? (
                        <div className="text-yellow-400 font-bold text-sm">{formatCountdown(remaining) || '即将到期'}</div>
                      ) : (
                        <div className="text-gray-400 font-semibold text-sm">已过期</div>
                      )}
                      <div className="text-gray-600 text-[11px] mt-2 leading-snug">
                        {isSingleConsumedForCurrentPurchase()
                          ? '本次单次权益已用于创建高级房'
                          : '单次：可创建 1 个高级聊天室，创建后即消耗'}
                      </div>
                    </div>
                  ) : planExpiresAt && remaining > 0 ? (
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
                    className={`rounded-2xl p-5 border transition-all ${
                      plan === p.id ? 'bg-yellow-400/10 border-yellow-400/40' : 'bg-white/3 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className={`text-xs px-2 py-0.5 rounded-full w-fit mb-2 border ${planBadgeColors[p.id] || 'bg-white/5 text-gray-400 border-white/10'}`}>
                          {p.name}
                        </div>
                        <div className="text-2xl font-extrabold text-white">
                          {typeof p.price === 'number' ? `¥${p.price}` : p.price}
                        </div>
                        <div className="text-gray-600 text-xs mt-1">{p.duration} · {p.roomCount}个高级聊天室</div>
                      </div>
                      {plan === p.id && (
                        <div className="text-yellow-400 text-xs font-bold whitespace-nowrap">当前使用中</div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(p.features || []).slice(0, 6).map(f => (
                        <span key={f} className="text-xs bg-white/5 border border-white/10 text-gray-300 px-3 py-1 rounded-full">
                          ✓ {f}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Profile Tab ═══ */}
        {activeTab === 'profile' && (
          <div className="animate-fadeIn">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 max-w-2xl">
              <h2 className="text-xl font-bold text-white mb-6">个人资料</h2>
              {profileSuccess && (
                <div className="mb-5 flex items-center gap-3 bg-green-500/15 border border-green-500/30 text-green-400 rounded-xl px-4 py-3 text-sm">✅ 个人资料已保存！</div>
              )}
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400/40 to-yellow-600/40 flex items-center justify-center text-white text-2xl font-bold">{nickname?.[0]?.toUpperCase() || 'U'}</div>
                  <div><div className="text-white font-semibold">{nickname || '未设置昵称'}</div><div className="text-gray-500 text-sm">{user.email}</div></div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm font-medium mb-2">注册邮箱</label>
                  <input type="email" value={user.email} readOnly className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-gray-500 text-base cursor-not-allowed" />
                  <p className="text-gray-700 text-xs mt-1.5">邮箱地址不可修改，如需更换请联系客服</p>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">昵称</label>
                  <input type="text" value={nickname} onChange={e => { setProfileNicknameError(''); setNickname(clampNickname(e.target.value)); }} placeholder={`最多 ${NICKNAME_MAX_LEN} 个字符（汉字、英文、数字均可）`}
                    className={`w-full bg-white/5 border ${profileNicknameError ? 'border-red-500/50' : 'border-white/15'} rounded-xl px-5 py-3.5 text-white text-base placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 transition-colors`} />
                  <p className="text-gray-600 text-xs mt-1.5">不超过 {NICKNAME_MAX_LEN} 个字符</p>
                  {profileNicknameError && <p className="text-red-400 text-sm mt-2">{profileNicknameError}</p>}
                </div>
                <div>
                  <label className="block text-gray-400 text-sm font-medium mb-2">当前套餐</label>
                  <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium ${planBadgeColors[plan] || 'bg-white/5 text-gray-400 border-white/10'}`}>{planLabels[plan] || plan}</div>
                </div>
                <button type="submit" disabled={profileSaving}
                  className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a365d] font-bold py-3.5 rounded-xl text-base hover:from-yellow-300 hover:to-yellow-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20">
                  {profileSaving ? '保存中...' : '保存修改'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ═══ Security Tab ═══ */}
        {activeTab === 'security' && (
          <div className="animate-fadeIn">
            {pwdSuccess && (
              <div className="mb-6 flex items-center gap-3 bg-green-500/15 border border-green-500/30 text-green-400 rounded-xl px-4 py-3 text-sm">✅ 密码修改成功！</div>
            )}

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 max-w-2xl mb-6">
              <h2 className="text-xl font-bold text-white mb-1">修改密码</h2>
              <p className="text-gray-500 text-sm mb-6">
                请输入新密码并确认，即可完成修改
              </p>

              <form onSubmit={handleResetPassword} className="space-y-5">
                {/* 新密码 */}
                <PwdInput
                  id="newPwd"
                  label="新密码"
                  value={pwdForm.newPwd}
                  onChange={v => setPwdForm({ ...pwdForm, newPwd: v })}
                  placeholder="8位，字母/数字/组合均可"
                  error={pwdErrors.newPwd}
                  maxLength={8}
                />

                {/* 确认新密码 */}
                <PwdInput
                  id="confirmPwd"
                  label="确认新密码"
                  value={pwdForm.confirmPwd}
                  onChange={v => setPwdForm({ ...pwdForm, confirmPwd: v })}
                  placeholder="再次输入新密码"
                  error={pwdErrors.confirmPwd}
                  maxLength={8}
                />

                <button type="submit" disabled={pwdLoading}
                  className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a365d] font-bold py-3.5 rounded-xl text-base hover:from-yellow-300 hover:to-yellow-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20">
                  {pwdLoading ? '提交中...' : '确认修改密码'}
                </button>
              </form>
            </div>

            {/* 安全建议 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-2xl">
              <h3 className="text-white font-semibold mb-4">安全建议</h3>
              <ul className="space-y-3">
                {[
                  '密码必须为8位，字母/数字/组合均可，不支持特殊字符',
                  '定期更换密码，建议每3个月更换一次',
                  '不要在公共电脑上保存密码',
                  '如果怀疑账户被盗，请立即修改密码',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-400 text-sm">
                    <span className="text-yellow-400 mt-0.5">✓</span>{tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
      <Footer />
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } .animate-fadeIn { animation: fadeIn 0.3s ease-out; }`}</style>
    </div>
  );
}
