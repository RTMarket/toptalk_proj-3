import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { accountLogout } from '../../lib/accountApi';

interface NavUser {
  nickname: string;
  email: string;
  plan: string;
}

const planLabels: Record<string, string> = {
  free: '免费版',
  single: '单次高级',
  daily: '日卡',
  weekly: '周卡',
  monthly: '月卡',
  enterprise: '企业版',
  enterprise_pro: '企业版 Pro',
};

const planColors: Record<string, string> = {
  free: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  default: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
};

export default function Navbar({ hideAuth = false }: { hideAuth?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  const [user, setUser] = useState<NavUser | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const loadUser = () => {
      const stored = localStorage.getItem('toptalk_user');
      const plan = localStorage.getItem('toptalk_plan') || 'free';
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setUser({ ...parsed, plan });
        } catch {
          setUser({ nickname: '用户', email: stored, plan });
        }
      } else {
        setUser(null);
      }
    };
    loadUser();
    window.addEventListener('storage', loadUser);
    // Listen for custom login event (SPA cross-tab)
    window.addEventListener('toptalk_login', loadUser);
    return () => {
      window.removeEventListener('storage', loadUser);
      window.removeEventListener('toptalk_login', loadUser);
    };
  }, []);

  const handleLogout = () => {
    accountLogout().finally(() => {
      localStorage.removeItem('toptalk_user');
      localStorage.removeItem('toptalk_plan');
      setUser(null);
      navigate('/');
      setUserMenuOpen(false);
    })
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-[#0a1628]/95 backdrop-blur-md shadow-2xl border-b border-white/5' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:shadow-yellow-500/30 transition-all duration-300">
              T
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Top<span className="text-yellow-400">Talk</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="/#features" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm font-medium">
              功能
            </a>
            <a href="/#pricing" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm font-medium">
              定价
            </a>
            <a href="/#security" className="text-gray-300 hover:text-white transition-colors duration-200 text-sm font-medium">
              安全
            </a>
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {/* User plan badge */}
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${planColors[user.plan] || planColors.default}`}>
                  {planLabels[user.plan] || user.plan}
                </span>

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2 transition-all duration-200"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400/40 to-yellow-600/40 flex items-center justify-center text-white text-xs font-bold">
                      {user.nickname?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-white text-sm font-medium">{user.nickname}</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-56 bg-[#0d2044] border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
                        {/* User info header */}
                        <div className="px-4 py-3 border-b border-white/5 mb-1">
                          <div className="text-white font-semibold text-sm">{user.nickname}</div>
                          <div className="text-gray-500 text-xs mt-0.5">{user.email}</div>
                        </div>
                        <Link
                          to="/rooms"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-gray-300 hover:bg-white/5 hover:text-white text-sm transition-colors"
                        >
                          <span>🚪</span> 聊天室
                        </Link>
                        <Link
                          to="/personal-center"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-gray-300 hover:bg-white/5 hover:text-white text-sm transition-colors"
                        >
                          <span>👤</span> 个人中心
                        </Link>
                        <Link
                          to="/personal-center"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-gray-300 hover:bg-white/5 hover:text-white text-sm transition-colors"
                        >
                          <span>💳</span> 升级套餐
                        </Link>
                        <div className="border-t border-white/5 mt-1 pt-1" />
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-gray-500 hover:bg-white/5 hover:text-red-400 text-sm transition-colors"
                        >
                          <span>🚪</span> 退出登录
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : !hideAuth ? (
              <>
                <Link to="/login" className="text-gray-300 hover:text-white transition-colors text-sm font-medium px-4 py-2">
                  登录
                </Link>
                <Link
                  to="/register"
                  className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a365d] font-semibold text-sm px-5 py-2 rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all duration-300 shadow-lg hover:shadow-yellow-500/25"
                >
                  免费试用
                </Link>
              </>
            ) : null}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-[#0a1628]/98 backdrop-blur-lg border-t border-white/10 py-4 px-4 space-y-2">
            {[
              { label: '功能', href: '/#features' },
              { label: '定价', href: '/#pricing' },
              { label: '安全', href: '/#security' },
            ].map(link => (
              <a key={link.href} href={link.href} className="block text-gray-300 hover:text-white py-2 text-sm" onClick={() => setMenuOpen(false)}>
                {link.label}
              </a>
            ))}
            {user ? (
              <>
                <div className="flex items-center gap-3 py-2 border-t border-white/10 mt-2 pt-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400/40 to-yellow-600/40 flex items-center justify-center text-white text-sm font-bold">
                    {user.nickname?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">{user.nickname}</div>
                    <div className="text-gray-600 text-xs">{planLabels[user.plan] || user.plan}</div>
                  </div>
                </div>
                <Link to="/rooms" onClick={() => setMenuOpen(false)} className="block text-gray-300 hover:text-white py-2 text-sm">🚪 聊天室</Link>
                <Link to="/personal-center" onClick={() => setMenuOpen(false)} className="block text-gray-300 hover:text-white py-2 text-sm">👤 个人中心</Link>
                <Link to="/personal-center" onClick={() => setMenuOpen(false)} className="block text-gray-300 hover:text-white py-2 text-sm">💳 升级套餐</Link>
                <button onClick={handleLogout} className="block text-gray-600 hover:text-red-400 py-2 text-sm w-full text-left">🚪 退出登录</button>
              </>
            ) : !hideAuth ? (
              <div className="flex gap-3 pt-3 border-t border-white/10 mt-2">
                <Link to="/login" className="flex-1 text-center py-2 text-gray-300 text-sm border border-white/20 rounded-lg">
                  登录
                </Link>
                <Link to="/register" className="flex-1 text-center py-2 bg-yellow-400 text-[#1a365d] font-semibold text-sm rounded-lg">
                  免费试用
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </nav>
  );
}
