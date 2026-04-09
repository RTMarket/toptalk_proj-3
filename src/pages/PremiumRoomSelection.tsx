import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pricingPlans } from '../data/pricingData';
import { supabase } from '../lib/supabase';
import Navbar from '../components/layout/Navbar';
import { syncSubscriptionFromApprovedOrder } from '../lib/subscription';
import { postRoomEvent } from '../lib/accountApi';
import { activeRoomRemainingMs, cleanupExpired, getActivePremiumRooms, PremiumActiveRoom, removeActivePremiumRoom, upsertActivePremiumRoom } from '../lib/premiumActiveRooms';

interface PremiumRoom {
  id: string;
  type: 'premium';
  createdAt: string;
  password: string;
  destroy: number;
}

interface Subscription {
  planId: string;
  expireAt: string;
}

// ── 本地存储操作 ─────────────────────────────────

function isPremiumRoomCreator(roomId: string): boolean {
  try {
    const created: string[] = JSON.parse(localStorage.getItem('toptalk_premium_created_rooms') || '[]');
    return created.includes(roomId);
  } catch { return false; }
}

function isSubscribed(sub: Subscription | null): boolean {
  if (!sub) return false;
  if (sub.planId === 'free') return false;
  if (new Date(sub.expireAt).getTime() < Date.now()) return false;
  return true;
}

function formatRemain(ms: number): string {
  if (ms <= 0) return '已结束';
  const s = Math.ceil(ms / 1000);
  if (s >= 3600) return `${Math.floor(s / 3600)}小时${Math.floor((s % 3600) / 60)}分`;
  if (s >= 60) return `${Math.floor(s / 60)}分${s % 60}秒`;
  return `${s}秒`;
}

function getSinglePurchaseStamp(): string {
  // 以“购买时间戳”作为一次单次套餐的唯一标识，便于用户再次购买单次时重新可用
  return (localStorage.getItem('toptalk_plan_purchased') || '').trim() || 'unknown';
}

function isSingleConsumedForCurrentPurchase(): boolean {
  try {
    const consumedAt = (localStorage.getItem('toptalk_single_consumed_at') || '').trim();
    const consumedPurchase = (localStorage.getItem('toptalk_single_consumed_purchase') || '').trim();
    if (!consumedAt) return false;
    return consumedPurchase === getSinglePurchaseStamp();
  } catch {
    return false;
  }
}

function markSingleConsumedNow(): void {
  try {
    localStorage.setItem('toptalk_single_consumed_at', new Date().toISOString());
    localStorage.setItem('toptalk_single_consumed_purchase', getSinglePurchaseStamp());
  } catch {
    // ignore
  }
}

// ── 套餐弹窗组件 ────────────────────────────────────────────────────────────
const PLAN_META: Record<string, { emoji: string; tag: string; tagColor: string; bgFrom: string; bgTo: string; btnFrom: string; btnTo: string }> = {
  single:         { emoji: '⚡', tag: '单次', tagColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30', bgFrom: 'from-orange-500/5', bgTo: 'to-orange-600/5', btnFrom: 'from-orange-400', btnTo: 'to-amber-500' },
  daily:          { emoji: '🌞', tag: '日卡', tagColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30', bgFrom: 'from-amber-500/5', bgTo: 'to-orange-500/5', btnFrom: 'from-amber-400', btnTo: 'to-orange-500' },
  weekly:         { emoji: '📅', tag: '周卡', tagColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', bgFrom: 'from-yellow-500/5', bgTo: 'to-amber-500/5', btnFrom: 'from-yellow-400', btnTo: 'to-amber-500' },
  monthly:        { emoji: '🚀', tag: '最热', tagColor: 'bg-yellow-400/30 text-yellow-300 border-yellow-400/40', bgFrom: 'from-yellow-400/10', bgTo: 'to-orange-400/10', btnFrom: 'from-yellow-400', btnTo: 'to-amber-500' },
  enterprise:     { emoji: '🏢', tag: '企业', tagColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30', bgFrom: 'from-purple-500/5', bgTo: 'to-pink-500/5', btnFrom: 'from-purple-500', btnTo: 'to-pink-500' },
  enterprise_pro: { emoji: '💎', tag: '旗舰', tagColor: 'bg-pink-500/20 text-pink-400 border-pink-500/30', bgFrom: 'from-pink-500/5', bgTo: 'to-purple-500/5', btnFrom: 'from-pink-500', btnTo: 'to-purple-500' },
};

function PricingModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const paidPlans = pricingPlans.filter(p => p.id !== 'free');

  const handleSubscribe = (planId: string) => {
    // 对公转账已关闭：改为邀请码开通
    onClose();
    navigate('/personal-center');
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)' }}
      onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full sm:max-w-5xl rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0d1f35 0%, #091525 100%)', border: '1px solid rgba(255,255,255,0.10)', maxHeight: '92vh' }}
      >
        {/* 顶部渐变条 */}
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #f59e0b, #f97316, #ef4444, #a855f7)' }} />

        {/* 标题区 */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <h2 className="text-white font-extrabold text-2xl">选择订阅套餐</h2>
            <p className="text-gray-500 text-sm mt-1">解锁高级聊天室全部特权</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all text-lg"
          >
            ✕
          </button>
        </div>

        {/* 套餐网格 */}
        <div className="px-4 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(92vh - 120px)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {paidPlans.map(function(plan) {
              var meta = PLAN_META[plan.id] || PLAN_META.weekly;
              var isHighlight = !!plan.highlight;
              var cardClass = isHighlight
                ? 'border-yellow-400/50 bg-gradient-to-b from-yellow-400/12 to-transparent shadow-lg'
                : 'border-white/8 bg-gradient-to-b ' + meta.bgFrom + ' ' + meta.bgTo + ' hover:border-white/20';
              var btnClass = isHighlight
                ? 'bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-[#1a365d]'
                : 'bg-gradient-to-r ' + meta.btnFrom + ' ' + meta.btnTo + ' hover:opacity-90 text-white';
              return (
                <div
                  key={plan.id}
                  className={'relative rounded-2xl p-5 flex flex-col border transition-all duration-200 cursor-default ' + cardClass}
                >
                  {isHighlight && (
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <span className="inline-flex items-center gap-1 bg-yellow-400 text-[#1a365d] text-xs font-black px-4 py-1 rounded-full shadow-lg">
                        ⭐ 推荐
                      </span>
                    </div>
                  )}

                  {/* 图标 + 名称 */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(249,115,22,0.1))', border: '1px solid rgba(245,158,11,0.2)' }}
                    >
                      {meta.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-base">{plan.name}</span>
                        <span className={'text-xs px-2 py-0.5 rounded-full border ' + meta.tagColor}>{meta.tag}</span>
                      </div>
                      <div className="text-gray-600 text-xs mt-0.5">{plan.duration} · {plan.roomCount}个聊天室</div>
                    </div>
                  </div>

                  {/* 价格 */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-yellow-400">{'¥' + plan.price}</span>
                      <span className="text-gray-600 text-sm">/{plan.priceUnit}</span>
                    </div>
                  </div>

                  {/* 分割线 */}
                  <div className={isHighlight ? 'h-px mb-4 bg-yellow-400/20' : 'h-px mb-4 bg-white/6'} />

                  {/* 功能列表 */}
                  <div className="flex-1 space-y-2 mb-5">
                    {plan.features.map(function(f, i) {
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-green-400 text-sm flex-shrink-0 mt-0.5">✓</span>
                          <span className="text-gray-400 text-xs leading-relaxed">{f}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 订阅按钮 */}
                  <button
                    onClick={function() { handleSubscribe(plan.id); }}
                    className={'w-full py-3 rounded-xl text-sm font-bold transition-all duration-150 shadow-md hover:shadow-lg active:scale-95 ' + btnClass}
                  >
                    立即订阅
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-center text-gray-700 text-xs mt-4">
            支付成功后即可创建高级聊天室，有效期内无限使用 · 所有套餐采用AES-256加密
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PremiumRoomSelection() {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loggedIn, setLoggedIn] = useState(() => {
    try { return !!localStorage.getItem('toptalk_user'); } catch { return false; }
  });
  const [showPricing, setShowPricing] = useState(false);
  const [createPassword, setCreatePassword] = useState('');
  const [createDuration, setCreateDuration] = useState(900);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [myRooms, setMyRooms] = useState<PremiumRoom[]>([]);

  // 活跃高级房间列表（创建 + 加入 都算）
  const [activeRooms, setActiveRooms] = useState<PremiumActiveRoom[]>([]);

  // 加载订阅状态（初始 + 从支付页返回时）
  useEffect(function() {
    function loadSub() {
      try {
        setLoggedIn(!!localStorage.getItem('toptalk_user'));
        var raw = localStorage.getItem('toptalk_subscription');
        if (raw) {
          setSubscription(JSON.parse(raw));
        } else {
          // 兼容：如果没有 toptalk_subscription，尝试读取 toptalk_plan
          var plan = localStorage.getItem('toptalk_plan');
          if (plan && plan !== 'free') {
            var expires = (localStorage.getItem('toptalk_plan_expires') || '').trim();
            // expireAt 为空时视为未开通（通常是还没同步到本地订阅）
            setSubscription(expires ? { planId: plan, expireAt: expires } : null);
          } else {
            setSubscription(null);
          }
        }
      } catch {
        setSubscription(null);
        try { setLoggedIn(!!localStorage.getItem('toptalk_user')); } catch { setLoggedIn(false); }
      }
    }
    loadSub();
    // 进入高级页时，主动向后端拉一次“已通过订单”同步（避免用户已购买但本地未更新）
    try {
      const rawUser = localStorage.getItem('toptalk_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u?.email) syncSubscriptionFromApprovedOrder(String(u.email));
      }
    } catch { /* ignore */ }
    // 用户从支付页返回 / 订阅状态写入 localStorage / 登录态变化时，重新检测
    window.addEventListener('popstate', loadSub);
    window.addEventListener('storage', loadSub as any);
    window.addEventListener('toptalk_login', loadSub as any);
    return function() {
      window.removeEventListener('popstate', loadSub);
      window.removeEventListener('storage', loadSub as any);
      window.removeEventListener('toptalk_login', loadSub as any);
    };
  }, []);

  const subscribed = isSubscribed(subscription);

  const loadRooms = () => {
    try {
      const raw: PremiumRoom[] = JSON.parse(localStorage.getItem('toptalk_rooms') || '[]');
      setMyRooms(raw.filter((r: any) => r.type === 'premium'));
    } catch { setMyRooms([]); }
  };

  // 初始化：加载活跃高级房间
  useEffect(() => {
    loadRooms();
    setActiveRooms(getActivePremiumRooms());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 每秒更新倒计时（用于 UI 刷新 + 过期清理）
  useEffect(() => {
    const id = setInterval(() => {
      cleanupExpired();
      setActiveRooms(getActivePremiumRooms());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const roomRemain = (room: PremiumRoom) => {
    const expire = new Date(room.createdAt).getTime() + (room.destroy || 900) * 1000;
    return Math.max(0, expire - Date.now());
  };

  const handleSelectPlan = (planId: string) => {
    const plan = pricingPlans.find(p => p.id === planId);
    if (!plan) return;
    const expireAt = new Date();
    if (plan.type === 'single') expireAt.setFullYear(expireAt.getFullYear() + 10);
    else if (plan.type === 'daily') expireAt.setDate(expireAt.getDate() + 1);
    else if (plan.type === 'weekly') expireAt.setDate(expireAt.getDate() + 7);
    else if (plan.type === 'monthly') expireAt.setMonth(expireAt.getMonth() + 1);
    else if (plan.type === 'enterprise' || plan.type === 'enterprise_pro') expireAt.setMonth(expireAt.getMonth() + 1);
    else expireAt.setDate(expireAt.getDate() + 1);
    const sub: Subscription = { planId, expireAt: expireAt.toISOString() };
    localStorage.setItem('toptalk_subscription', JSON.stringify(sub));
    setSubscription(sub);
    setShowPricing(false);
  };

  const durationOptions = [
    { label: '15分钟', value: 900 }, { label: '30分钟', value: 1800 },
    { label: '45分钟', value: 2700 }, { label: '1小时', value: 3600 },
    { label: '1小时15分', value: 4500 }, { label: '1小时30分', value: 5400 },
    { label: '2小时', value: 7200 }, { label: '2小时15分', value: 8100 },
    { label: '2小时30分', value: 9000 },
  ];

  const currentPlanId = subscription?.planId || localStorage.getItem('toptalk_plan') || 'free';
  const currentPlan = pricingPlans.find(p => p.id === currentPlanId) || pricingPlans.find(p => p.id === 'free')!;
  const maxActive = subscribed ? (Number(currentPlan.roomCount) || 1) : 0;
  const activeCount = activeRooms.length;
  const activeMemberCount = activeRooms.filter(r => r.role === 'member').length;
  // 加入者：同一时刻只能占 1 间（离开房间后活跃列表移除即可再加入其他房间）
  const joinWithinPlan = !subscribed || activeCount < maxActive;
  const canJoin = loggedIn && activeMemberCount < 1 && joinWithinPlan;
  const singleConsumed = currentPlanId === 'single' && isSingleConsumedForCurrentPurchase();
  const canCreate = subscribed && !singleConsumed && activeCount < maxActive;

  const handleCreateRoom = async () => {
    if (!createPassword || !/^\d{4}$/.test(createPassword)) { setCreateError('请输入4位数字房间密码'); return; }
    if (!subscribed) { setCreateError('请先订阅套餐'); return; }
    if (currentPlanId === 'single' && isSingleConsumedForCurrentPurchase()) {
      setCreateError('单次高级（9.9）已使用：该套餐仅允许创建 1 次高级聊天室。如需再次创建请升级/更换套餐。');
      return;
    }
    if (activeRooms.length >= maxActive) { setCreateError(`当前套餐最多同时活跃 ${maxActive} 个高级房间（创建/加入都算）`); return; }
    setCreateError('');
    setCreateLoading(true);
    await new Promise(r => setTimeout(r, 500));
    const newId = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date().toISOString();
    const room: PremiumRoom = { id: newId, type: 'premium', createdAt: now, password: createPassword, destroy: createDuration };

    // 写入 localStorage（创建者本地记录）
    const existing: PremiumRoom[] = JSON.parse(localStorage.getItem('toptalk_rooms') || '[]');
    localStorage.setItem('toptalk_rooms', JSON.stringify([room, ...existing].slice(0, 50)));

    // 写入 Supabase（供其他用户查询加入）- room_type = 'premium'
    try {
      await supabase.from('rooms').upsert({
        id: newId,
        room_type: 'premium',
        password: createPassword,
        destroy_seconds: createDuration,
        status: 'active',
        created_at: now,
      });
    } catch { /* ignore - localStorage 已成功 */ }

    // 标记为创建者 + 活跃房间
    try {
      const created: string[] = JSON.parse(localStorage.getItem('toptalk_premium_created_rooms') || '[]');
      if (!created.includes(newId)) { created.push(newId); localStorage.setItem('toptalk_premium_created_rooms', JSON.stringify(created)); }
    } catch { /* ignore */ }
    upsertActivePremiumRoom({ id: newId, createdAt: now, destroySeconds: createDuration, role: 'creator', password: createPassword });
    setActiveRooms(getActivePremiumRooms());
    // 单次高级：一旦“创建”成功即视为已消耗（加入不消耗）
    if (currentPlanId === 'single') {
      markSingleConsumedNow();
    }

    setCreateLoading(false);
    setCreatePassword('');
    loadRooms();
    // 统计：创建房间
    postRoomEvent({ roomId: newId, roomType: 'premium', event: 'create' }).catch(() => {});
    const label = durationOptions.find(o => o.value === createDuration)?.label || '1小时';
    navigate(`/premium-chat?roomId=${newId}&destroy=${createDuration}&duration=${encodeURIComponent(label)}&password=${createPassword}`);
  };

  const handleJoinRoom = async () => {
    if (!joinRoomId || joinRoomId.length !== 6) { setJoinError('请输入6位房间号'); return; }
    if (!joinPassword) { setJoinError('请输入房间密码'); return; }
    if (!loggedIn) { setJoinError('请先登录后再加入高级聊天室'); return; }
    if (activeMemberCount >= 1) {
      setJoinError('同一时间只能加入一间高级聊天室，请先离开当前房间后再加入其他房间');
      return;
    }
    if (subscribed && activeRooms.length >= maxActive) {
      setJoinError(`当前套餐最多同时活跃 ${maxActive} 个高级房间（创建/加入都算），请先结束或解散其中一个`);
      return;
    }

    setJoinError('');
    setJoinLoading(true);

    // 高级聊天室：查 Supabase（所有用户共享的房间数据）结合本地记录（创建者的密码）
    let targetPassword = '';
    let targetDestroy = 900;
    let targetCreatedAt = '';

    // 优先查本地记录（创建者的房间元数据）
    const localRooms: any[] = JSON.parse(localStorage.getItem('toptalk_rooms') || '[]');
    const localTarget = localRooms.find(r => r.id === joinRoomId);
    if (localTarget) {
      targetPassword = localTarget.password || '';
      targetDestroy = localTarget.destroy || 900;
      targetCreatedAt = localTarget.createdAt || '';
    }

    // 同时查 Supabase（过滤 room_type === 'premium'，即时房间永远不在结果里）
    try {
      const { data: dbTarget } = await supabase
        .from('rooms')
        .select('id, password, destroy_seconds, status, created_at')
        .eq('id', joinRoomId)
        .eq('room_type', 'premium')
        .maybeSingle();
      if (dbTarget) {
        targetPassword = dbTarget.password || targetPassword;
        targetDestroy = dbTarget.destroy_seconds || targetDestroy;
        targetCreatedAt = (dbTarget as any).created_at || targetCreatedAt;
      }
    } catch { /* ignore - 使用本地记录 */ }

    // 第一步：先验证密码（正确密码才允许重新加入，离开记录可被覆盖）
    if (!localTarget && !targetPassword) {
      setJoinError('房间不存在，请确认房间号是否正确'); setJoinLoading(false); return;
    }
    if (targetPassword && targetPassword !== joinPassword) {
      setJoinError('密码错误，请重新输入'); setJoinLoading(false); return;
    }

    // 第二步：密码正确后，清除离开记录（允许重新加入），再进入房间
    const leftRooms: Record<string, number> = JSON.parse(localStorage.getItem('toptalk_left') || '{}');
    if (leftRooms[joinRoomId]) {
      delete leftRooms[joinRoomId];
      localStorage.setItem('toptalk_left', JSON.stringify(leftRooms));
    }

    setJoinLoading(false);
    // 标记加入也算活跃房间
    // 活跃倒计时必须以“房间创建时间”计算，不能用加入时间重置
    upsertActivePremiumRoom({
      id: joinRoomId,
      createdAt: targetCreatedAt || new Date().toISOString(),
      destroySeconds: targetDestroy,
      role: 'member',
      password: joinPassword,
    });
    setActiveRooms(getActivePremiumRooms());
    navigate(`/premium-chat?roomId=${joinRoomId}&destroy=${targetDestroy}&password=${joinPassword}`);
  };

  return (
    <div className="min-h-screen bg-[#050d1a] flex flex-col">
      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}

      <Navbar />

      <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto px-4 sm:px-5 pt-24 sm:pt-28 pb-10 space-y-8 w-full">

        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-3xl">🔐</span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">高级聊天室</h1>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <span className="bg-yellow-400/20 text-yellow-400 text-xs px-3 py-1 rounded-full border border-yellow-400/30 font-medium">创建需订阅</span>
            <span className="bg-emerald-500/15 text-emerald-300 text-xs px-3 py-1 rounded-full border border-emerald-500/25 font-medium">加入需登录 · 单次一间</span>
            <span className="text-gray-500 text-xs w-full sm:w-auto text-center sm:text-left">文件传输 · 2.5小时有效期 · 密码保护</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 左：加入高级房间 */}
          <div className="bg-[#0a1628] border border-white/8 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/20 border border-yellow-400/25 flex items-center justify-center"><span className="text-xl">💬</span></div>
              <div>
                <h2 className="text-white font-bold text-base">加入高级房间</h2>
                <p className="text-gray-600 text-xs mt-0.5">登录后凭房间号 + 密码进入（无需订阅）</p>
              </div>
            </div>

            <p className="text-gray-600 text-xs mb-3 leading-relaxed">
              未订阅也可加入他人房间；同一时间只能加入一间，离开当前房间后即可再加入其他高级房间。
            </p>

            {!loggedIn && (
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-3 text-gray-400 text-xs">
                请先登录后再加入高级聊天室。
              </div>
            )}

            {loggedIn && activeMemberCount >= 1 && (
              <div className="bg-orange-400/10 border border-orange-400/20 rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-orange-400 text-xs font-medium">
                  您已在另一间高级聊天室中（加入身份）。请先离开该房间，再加入其他房间。
                </span>
              </div>
            )}

            {loggedIn && activeMemberCount < 1 && subscribed && activeCount >= maxActive && (
              <div className="bg-orange-400/10 border border-orange-400/20 rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-400 animate-pulse flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-orange-400 text-xs font-medium">
                  当前套餐最多同时活跃 {maxActive} 个高级房间（创建/加入都算），请先结束或解散其中一个
                </span>
              </div>
            )}

            <div className="space-y-3">
              <input
                value={joinRoomId}
                onChange={e => { setJoinRoomId(e.target.value.replace(/\D/g, '').slice(0, 6)); setJoinError(''); }}
                placeholder="请输入6位数字房间号"
                disabled={!canJoin}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-yellow-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <input
                value={joinPassword}
                onChange={e => { setJoinPassword(e.target.value.replace(/\D/g, '').slice(0, 4)); setJoinError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleJoinRoom(); }}
                type="password"
                placeholder="请输入4位房间密码"
                disabled={!canJoin}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-yellow-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              />
              {joinError && <p className="text-red-400 text-xs">{joinError}</p>}
              <button
                onClick={handleJoinRoom}
                disabled={joinLoading || !canJoin}
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-[#1a365d] font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                {joinLoading ? '⟳' : '↪️'}{' '}
                {joinLoading
                  ? '加入中...'
                  : !loggedIn
                    ? '请先登录'
                    : activeMemberCount >= 1
                      ? '已有加入中的房间'
                      : subscribed && activeCount >= maxActive
                        ? '已达套餐上限'
                        : '进入聊天室'}
              </button>
            </div>
          </div>

          {/* 右：创建 或 订阅 */}
          {subscribed ? (
            <div className="bg-[#0a1628] border border-yellow-400/20 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-yellow-400/20 border border-yellow-400/25 flex items-center justify-center"><span className="text-xl">🔒</span></div>
                <div>
                  <h2 className="text-white font-bold text-base">创建高级聊天室</h2>
                  <p className="text-gray-600 text-xs mt-0.5">设置密码 · 选择有效期</p>
                </div>
              </div>
              <div className="bg-yellow-400/8 border border-yellow-400/20 rounded-xl p-3 mb-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-400"><span className="text-green-400">✓</span> 文字+文件+图片消息</div>
                <div className="flex items-center gap-2 text-xs text-gray-400"><span className="text-green-400">✓</span> 阅后即焚（最长2.5小时）</div>
                <div className="flex items-center gap-2 text-xs text-gray-400"><span className="text-green-400">✓</span> 密码保护房间</div>
              </div>

              {/* 达到上限提示 */}
              {!canCreate && subscribed && (
                <div className="bg-orange-400/10 border border-orange-400/20 rounded-xl px-4 py-3 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-400 animate-pulse flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-orange-400 text-xs font-medium">
                    当前套餐最多同时活跃 {maxActive} 个高级房间（创建/加入都算），请先结束或解散其中一个
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <input
                  value={createPassword}
                  onChange={e => { setCreatePassword(e.target.value.replace(/\D/g, '').slice(0, 4)); setCreateError(''); }}
                  type="password"
                  placeholder="请输入4位房间密码"
                  disabled={!canCreate}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-yellow-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <select
                  value={createDuration}
                  onChange={e => setCreateDuration(Number(e.target.value))}
                  disabled={!canCreate}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {durationOptions.map(o => <option key={o.value} value={o.value} className="bg-[#0a1628]">{o.label}</option>)}
                </select>
                {createError && <p className="text-red-400 text-xs">{createError}</p>}
                <button
                  onClick={handleCreateRoom}
                  disabled={createLoading || !canCreate}
                  className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-[#1a365d] font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  {createLoading ? '⟳' : '🔒'} {createLoading ? '创建中...' : !canCreate ? '已达上限' : '创建高级聊天室'}
                </button>
                {subscribed && (
                  <p className="text-center text-gray-600 text-xs">当前活跃：{activeCount}/{maxActive}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#0a1628] border border-yellow-400/20 rounded-2xl p-6 flex flex-col justify-center">
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-2xl bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center text-3xl mx-auto mb-3">🔐</div>
                <h2 className="text-white font-bold text-lg mb-1">解锁创建高级房间</h2>
                <p className="text-gray-500 text-sm">订阅后可创建房间；已登录用户也可凭房间号与密码加入他人高级聊天室（左侧）</p>
              </div>
              <div className="space-y-2 mb-5">
                {['文字+文件+图片消息', '阅后即焚（最长2.5小时）', '房间密码保护'].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-400"><span className="text-yellow-400">✓</span> {f}</div>
                ))}
              </div>
              <button
                onClick={() => setShowPricing(true)}
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-[#1a365d] font-bold py-3 rounded-xl text-sm transition-all"
              >
                ¥9.9起 · 立即订阅
              </button>
            </div>
          )}
        </div>

        {/* 我的高级聊天室 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-base">我的聊天室</h3>
            <button className="text-gray-600 text-xs hover:text-gray-400 transition-colors">管理全部 →</button>
          </div>

          {/* 表头 */}
          <div className="grid grid-cols-3 gap-3 mb-2 px-1">
            <span className="text-gray-600 text-xs">类型</span>
            <span className="text-gray-600 text-xs">房间号</span>
            <span className="text-gray-600 text-xs text-right">剩余时间</span>
          </div>

          {/* 活跃高级房间（创建 + 加入） */}
          {activeRooms.length > 0 && (
            <div className="space-y-2 mb-2">
              {activeRooms.map(r => {
                const remain = activeRoomRemainingMs(r)
                return (
                  <div key={r.id} className="bg-[#0a1628] border border-orange-400/20 rounded-xl px-4 py-3">
                    <div className="grid grid-cols-3 gap-3 items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">高级聊天室</span>
                        <span className="bg-orange-400/15 text-orange-300 text-xs px-2 py-0.5 rounded-full border border-orange-400/20">
                          活跃
                        </span>
                      </div>
                      <span className="text-gray-400 text-sm font-mono truncate">#{r.id}</span>
                      <div className="flex items-center justify-end gap-2">
                        <svg className="w-3.5 h-3.5 text-orange-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-orange-300 text-sm font-bold tabular-nums">{formatRemain(remain)}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={() => navigate(`/premium-chat?roomId=${r.id}&destroy=${r.destroySeconds}&password=${encodeURIComponent(r.password || '')}`)}
                        className="text-yellow-400 text-xs hover:text-yellow-300 font-medium transition-colors"
                      >
                        进入房间 →
                      </button>
                      <span className="text-gray-700 text-xs">{r.role === 'creator' ? '创建者' : '加入'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {activeRooms.length === 0 && (
            <p className="text-gray-700 text-sm text-center py-6">暂无活跃高级聊天室</p>
          )}
        </div>
      </div>
    </div>
  );
}
