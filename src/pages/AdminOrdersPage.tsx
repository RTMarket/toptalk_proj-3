import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import type { OrderRecord } from '../types';

type Tab = 'account' | 'orders' | 'rooms';

const ROOM_LIMITS: Record<string, string> = {
  free: '0 个', single: '1/1 个', daily: '1/1 个',
  weekly: '1/1 个', monthly: '1/1 个', enterprise: '5/5 个', enterprise_pro: '15/15 个',
};

function getStoredUser() {
  try {
    const raw = localStorage.getItem('toptalk_user');
    return raw ? JSON.parse(raw) : { nickname: '', email: '', plan: 'free' };
  } catch { return { nickname: '', email: '', plan: 'free' }; }
}

function getStoredPlan(): string {
  return localStorage.getItem('toptalk_plan') || 'free';
}

function getPlanExpiresAt(): string {
  return localStorage.getItem('toptalk_plan_expires') || '';
}

function isPlanExpired(expiresAt: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function getRemainingDays(expiresAt: string): number {
  if (!expiresAt || isPlanExpired(expiresAt)) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function formatDate(isoStr: string): string {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

const mockOrders: OrderRecord[] = [
  { id: 'ORD202501001', plan: '月卡', amount: 99, date: '2025-01-15', status: 'paid' },
  { id: 'ORD202501002', plan: '周卡', amount: 39, date: '2025-01-20', status: 'paid' },
];

const mockRooms = [
  { id: '847291', type: 'free' as const, name: '即时聊天室', createdAt: '2025-01-18 14:30' },
  { id: '293847', type: 'premium' as const, name: '高级聊天室', createdAt: '2025-01-19 10:00' },
];

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [renderKey, setRenderKey] = useState(0);

  const user = getStoredUser();
  const expiresAt = getPlanExpiresAt();
  const expired = isPlanExpired(expiresAt);
  const effectivePlan = expired ? 'free' : (getStoredPlan());
  const isPremium = effectivePlan !== 'free';
  const remainingDays = getRemainingDays(expiresAt);
  const roomsLimit = ROOM_LIMITS[effectivePlan] || '0 个';

  const PLAN_LABELS: Record<string, string> = {
    free: '免费版', single: '单次高级', daily: '日卡',
    weekly: '周卡', monthly: '月卡', enterprise: '企业版', enterprise_pro: '企业版 Pro',
  };
  const planLabel = PLAN_LABELS[effectivePlan] || effectivePlan;

  const nickname = user.nickname || user.email?.split('@')[0] || '用户';
  const firstChar = (nickname || '用')[0].toUpperCase();
  const todayStr = formatDate(new Date().toISOString());
  const registrationDate = todayStr;

  useEffect(() => {
    const handle = () => setRenderKey(k => k + 1);
    window.addEventListener('toptalk_login', handle);
    window.addEventListener('storage', handle);
    return () => {
      window.removeEventListener('toptalk_login', handle);
      window.removeEventListener('storage', handle);
    };
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'account', label: '账户信息' },
    { id: 'orders', label: '订单记录' },
    { id: 'rooms', label: '房间管理' },
  ];

  return (
    <div key={renderKey} className="min-h-screen bg-[#050d1a] text-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="flex flex-col md:flex-row gap-8">

          {/* Sidebar */}
          <aside className="md:w-56 flex-shrink-0">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sticky top-28">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-white/10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400/40 to-yellow-600/40 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {firstChar}
                </div>
                <div className="min-w-0 overflow-hidden">
                  <div className="text-white font-semibold text-sm truncate">{nickname}</div>
                  <div className="text-gray-500 text-xs truncate">{user.email || ''}</div>
                </div>
              </div>

              {/* Plan status */}
              <div className="bg-white/3 rounded-xl p-3 mb-4 text-center">
                <div className="text-xs text-gray-500 mb-1">当前套餐</div>
                <div className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${
                  expired
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : isPremium
                      ? 'bg-yellow-400/15 text-yellow-400 border border-yellow-400/30'
                      : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                }`}>{expired ? '已过期' : planLabel}</div>
                {!expired && isPremium && (
                  <div className="text-xs text-gray-700 mt-1">
                    {effectivePlan === 'daily' && '剩余约1天'}
                    {effectivePlan === 'weekly' && `剩余${remainingDays}天`}
                    {(getStoredPlan() === 'monthly' || getStoredPlan() === 'enterprise' || getStoredPlan() === 'enterprise_pro') && `剩余${remainingDays}天`}
                  </div>
                )}
                {expired && <div className="text-xs text-red-500 mt-1">请续费</div>}
              </div>

              <nav className="space-y-1">
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-yellow-400/10 text-yellow-300 border border-yellow-400/20'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}>{tab.label}</button>
                ))}
                <Link to="/rooms"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-yellow-400 bg-yellow-400/5 border border-yellow-400/20 hover:bg-yellow-400/10 transition-colors">
                  🚪 进入聊天室
                </Link>
              </nav>
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0">

            {activeTab === 'account' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">账户信息</h2>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
                    {[
                      { label: '昵称', value: nickname },
                      { label: '邮箱', value: user.email || '未设置' },
                      {
                        label: '当前套餐',
                        value: expired ? '已过期（免费版）' : planLabel,
                        badge: expired ? 'expired' : (isPremium ? 'active' : 'free'),
                      },
                      { label: '可用房间', value: roomsLimit },
                      {
                        label: '套餐到期',
                        value: expired
                          ? '已过期'
                          : getStoredPlan() === 'daily' ? '约1天' :
                            getStoredPlan() === 'weekly' ? `${remainingDays}天` :
                              getStoredPlan() === 'monthly' || getStoredPlan() === 'enterprise' || getStoredPlan() === 'enterprise_pro' ? `${remainingDays}天` :
                                '永久',
                        badge: expired ? 'expired' : undefined,
                      },
                      { label: '注册时间', value: registrationDate },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
                        <span className="text-gray-500 text-sm">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{item.value}</span>
                          {item.badge === 'active' && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">生效中</span>}
                          {item.badge === 'free' && <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">基础</span>}
                          {item.badge === 'expired' && <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">已过期</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {expired && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <p className="text-red-400 text-sm">您的套餐已过期，高级功能已暂停。请续费以继续使用。</p>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link to="/personal-center"
                      className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a365d] font-semibold px-5 py-2.5 rounded-lg text-sm hover:from-yellow-300 hover:to-yellow-400 transition-all">
                      {expired ? '去兑换邀请码' : (isPremium ? '去兑换邀请码' : '去兑换邀请码')}
                    </Link>
                    <button className="border border-white/20 text-white font-medium px-5 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors">
                      修改密码
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">订单记录</h2>
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        {['订单号', '套餐', '金额', '日期', '状态'].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-gray-500 text-xs font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mockOrders.map(order => (
                        <tr key={order.id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                          <td className="px-5 py-3.5 text-gray-400 text-sm font-mono">{order.id}</td>
                          <td className="px-5 py-3.5 text-white text-sm font-medium">{order.plan}</td>
                          <td className="px-5 py-3.5 text-yellow-400 text-sm font-semibold">¥{order.amount}</td>
                          <td className="px-5 py-3.5 text-gray-500 text-sm">{order.date}</td>
                          <td className="px-5 py-3.5"><span className="bg-green-500/15 text-green-400 text-xs px-2 py-0.5 rounded-full">已支付</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'rooms' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">我的聊天室</h2>
                  <Link to="/rooms"
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a365d] font-semibold px-5 py-2.5 rounded-lg text-sm hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-lg shadow-yellow-500/20 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    创建聊天室
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {mockRooms.map(room => (
                    <div key={room.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-yellow-400/30 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${room.type === 'free' ? 'bg-blue-500/15 text-blue-400' : 'bg-yellow-400/15 text-yellow-400'}`}>
                          {room.type === 'free' ? '即时' : '高级'}
                        </span>
                        <span className="text-gray-600 text-xs font-mono">#{room.id}</span>
                      </div>
                      <div className="text-white font-medium text-sm mb-1">{room.name}</div>
                      <div className="text-gray-600 text-xs mb-4">创建于 {room.createdAt}</div>
                      <button onClick={() => navigate(`/chat?roomId=${room.id}&type=${room.type}`)}
                        className="text-yellow-400 hover:text-yellow-300 text-sm font-medium transition-colors flex items-center gap-1">
                        进入房间 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
                {mockRooms.length === 0 && (
                  <div className="text-center py-16 bg-white/3 border border-white/10 rounded-2xl">
                    <div className="text-5xl mb-4">🚪</div>
                    <p className="text-gray-500 mb-4">还没有聊天室，快创建一个吧</p>
                    <Link to="/rooms" className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a365d] font-semibold px-6 py-3 rounded-xl text-sm">立即创建</Link>
                  </div>
                )}
                <div className="bg-white/3 border border-white/10 rounded-xl p-4">
                  <p className="text-gray-600 text-xs leading-relaxed">
                    💡 当前{planLabel}{expired ? '（已过期）' : ''}可创建{isPremium ? '1个高级聊天室' : '1个即时聊天室'}。
                    {!isPremium && ' 升级高级版解锁更多房间和功能。'}
                  </p>
                  {!isPremium && (
                    <Link to="/payment" className="inline-flex items-center gap-1 text-yellow-400 hover:text-yellow-300 text-xs font-medium mt-2 transition-colors">
                      升级高级版 →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
