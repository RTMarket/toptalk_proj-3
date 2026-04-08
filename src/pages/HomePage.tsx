import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { features, scenarios, testimonials, securityFeatures } from '../data/featuresData';
import { pricingPlans } from '../data/pricingData';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#050d1a] text-white overflow-x-hidden">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDM0di0yaC0ydjJoLTJ2LTJoLTJ2NGgydi0yaDJ2MmgtMnoiLz48L2c+PC9nPjwvc3ZnPg==')]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 text-center pt-24 pb-20">
          {/* Version Badge */}
          <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-5 py-2 mb-10">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-yellow-300 text-base font-medium tracking-wide">V22 全新版本 · 端到端加密通信</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white leading-tight mb-8 tracking-tight">
            高端商务私密沟通<br />
            <span className="bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              零痕迹 · 安全对话
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-gray-400 text-xl md:text-2xl max-w-4xl mx-auto mb-14 leading-loose tracking-wide">
            TopTalk 采用端到端加密技术，消息阅后即焚，零存储架构，<br className="hidden md:block" />
            专为商务精英打造的私密沟通平台，让每一次对话都安全无痕。
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center mb-20">
            <Link to="/register" className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a365d] font-bold px-10 py-5 rounded-xl text-xl hover:from-yellow-300 hover:to-yellow-400 transition-all duration-300 shadow-2xl shadow-yellow-500/20 hover:-translate-y-1 w-full sm:w-auto">
              免费开始使用
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
            <a href="#features" className="inline-flex items-center justify-center gap-3 border-2 border-white/30 text-white font-semibold px-10 py-5 rounded-xl text-xl hover:bg-white/10 hover:border-white/50 transition-all duration-300 w-full sm:w-auto">
              了解更多
            </a>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { value: '0', label: '消息留存' },
              { value: '256bit', label: '加密标准' },
              { value: '2.5h', label: '最长销毁' }
            ].map((s) => (
              <div key={s.label} className="text-center p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-3xl md:text-4xl font-bold text-yellow-400 mb-3">{s.value}</div>
                <div className="text-gray-400 text-sm md:text-base tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-gray-500">
          <div className="w-6 h-10 border-2 border-gray-600 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-gray-500 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-24 md:py-32 bg-[#071020]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">适用场景</h2>
            <p className="text-gray-400 text-xl max-w-2xl mx-auto leading-relaxed">专为高价值沟通场景设计，满足商务精英的私密沟通需求</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {scenarios.map((s) => (
              <div key={s.title} className="bg-white/5 border border-white/15 rounded-3xl p-8 hover:border-yellow-400/40 hover:bg-white/10 transition-all duration-300 group cursor-pointer">
                <div className="text-5xl mb-6">{s.emoji}</div>
                <h3 className="text-white font-bold text-xl mb-4 group-hover:text-yellow-300 transition-colors tracking-wide">{s.title}</h3>
                <p className="text-gray-500 text-base leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <div className="inline-block bg-yellow-400/10 border border-yellow-400/25 rounded-full px-5 py-2 mb-6">
              <span className="text-yellow-300 text-base font-medium tracking-wide">核心功能</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">安全通讯，一次到位</h2>
            <p className="text-gray-400 text-xl max-w-3xl mx-auto leading-relaxed">从加密传输到阅后即焚，每一个功能都围绕"安全"和"私密"打造</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {features.map((f) => (
              <div key={f.title} className="bg-white/5 border border-white/10 rounded-3xl p-8 hover:border-yellow-400/40 hover:bg-white/10 transition-all duration-300 group">
                <div className="text-5xl mb-6">{f.icon}</div>
                <h3 className="text-white font-bold text-xl mb-4 group-hover:text-yellow-300 transition-colors tracking-wide">{f.title}</h3>
                <p className="text-gray-500 text-base leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 md:py-32 bg-[#071020]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <div className="inline-block bg-yellow-400/10 border border-yellow-400/25 rounded-full px-5 py-2 mb-6">
              <span className="text-yellow-300 text-base font-medium tracking-wide">定价方案</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">灵活选择，按需付费</h2>
            <p className="text-gray-400 text-xl max-w-2xl mx-auto leading-relaxed">从免费版到企业版，总有一款适合您的沟通需求</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {pricingPlans.map((plan) => (
              <div key={plan.id} className={`relative rounded-3xl p-8 border transition-all duration-300 hover:-translate-y-2 ${
                plan.highlight
                  ? 'bg-gradient-to-b from-yellow-400/15 to-[#0a1628] border-yellow-400/50 shadow-xl shadow-yellow-500/15'
                  : 'bg-white/5 border-white/15 hover:border-yellow-400/40'
              }`}>
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-[#1a365d] text-sm font-bold px-5 py-2 rounded-full">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-white font-bold text-2xl mb-3">{plan.name}</h3>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-extrabold text-yellow-400">{plan.price}</span>
                    {plan.priceUnit && <span className="text-gray-500 text-base">{plan.priceUnit}</span>}
                  </div>
                  <p className="text-gray-500 text-sm">有效期：{plan.duration}</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-base">
                      <span className="text-yellow-400 mt-0.5 flex-shrink-0 text-lg">✓</span>
                      <span className="text-gray-400 leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/register" className={`block text-center py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                  plan.highlight
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a365d] hover:from-yellow-300 hover:to-yellow-400'
                    : 'border-2 border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/15'
                }`}>
                  {plan.price === '免费' ? '免费试用' : '立即购买'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <div className="inline-block bg-yellow-400/10 border border-yellow-400/25 rounded-full px-5 py-2 mb-6">
              <span className="text-yellow-300 text-base font-medium tracking-wide">安全机制</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">军工级安全防护</h2>
            <p className="text-gray-400 text-xl max-w-3xl mx-auto leading-relaxed">多重安全机制，确保您的每一次沟通都固若金汤</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-10">
            {securityFeatures.map((s) => (
              <div key={s.title} className="flex gap-6 p-8 bg-white/5 border border-white/10 rounded-3xl hover:border-yellow-400/40 transition-all duration-300">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-yellow-400/15 border border-yellow-400/25 flex items-center justify-center">
                  <svg className="w-7 h-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold text-xl mb-3 tracking-wide">{s.title}</h3>
                  <p className="text-gray-500 text-base leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 md:py-32 bg-[#071020]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">用户评价</h2>
            <p className="text-gray-400 text-xl">听听商务精英们怎么说</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white/5 border border-white/10 rounded-3xl p-8 hover:border-yellow-400/30 transition-all duration-300">
                <div className="flex gap-1 text-yellow-400 text-xl mb-6">★★★★★</div>
                <p className="text-gray-300 text-lg leading-relaxed mb-8">"{t.content}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400/40 to-yellow-600/40 flex items-center justify-center text-2xl">{t.avatar}</div>
                  <div>
                    <div className="text-white font-bold text-lg">{t.name}</div>
                    <div className="text-gray-500 text-sm">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <div className="bg-gradient-to-br from-yellow-400/10 to-blue-500/5 border border-yellow-400/25 rounded-3xl p-12 md:p-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">准备好开始安全沟通了吗？</h2>
            <p className="text-gray-400 text-xl mb-12 max-w-2xl mx-auto leading-relaxed">免费注册，立即体验高端商务私密沟通。无需信用卡，即开即用。</p>

            <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
              <Link to="/register" className="inline-flex items-center gap-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a365d] font-bold px-12 py-5 rounded-xl text-xl hover:from-yellow-300 hover:to-yellow-400 transition-all duration-300 shadow-2xl shadow-yellow-500/20 hover:-translate-y-1 w-full sm:w-auto">
                立即免费试用
              </Link>
              <Link to="/rooms-premium" className="inline-flex items-center gap-3 border-2 border-amber-400/50 text-amber-400 hover:bg-amber-400/15 font-bold px-10 py-5 rounded-xl text-xl transition-all duration-300 w-full sm:w-auto">
                🔐 高级聊天室
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
