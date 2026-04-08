import { Link } from 'react-router-dom';

const footerLinks = {
  product: [
    { label: '功能介绍', path: '/#features' },
    { label: '定价方案', path: '/#pricing' },
    { label: '安全机制', path: '/#security' },
  ],
  legal: [
    { label: '用户协议', path: '/legal/terms' },
    { label: '隐私政策', path: '/legal/privacy' },
    { label: '免责声明', path: '/legal/disclaimer' },
  ],
  company: [
    { label: '关于我们', path: '/about' },
    { label: '联系我们', path: '/contact' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-[#050d1a] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-sm">T</div>
              <span className="text-lg font-bold text-white">Top<span className="text-yellow-400">Talk</span></span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed mb-4">
              高端商务私密沟通平台。<br />
              端到端加密，阅后即焚，<br />
              让每一次沟通都安全无痕。
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">产品</h4>
            <ul className="space-y-2.5">
              {footerLinks.product.map(l => (
                <li key={l.path}><a href={l.path} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">{l.label}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">法律</h4>
            <ul className="space-y-2.5">
              {footerLinks.legal.map(l => (
                <li key={l.path}><Link to={l.path} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">公司</h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map(l => (
                <li key={l.path}><a href={l.path} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">{l.label}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-600 text-xs">© 2025 TopTalk. 保留所有权利。高瑞商务私密沟通，零痕迹安全对话。</p>
          <div className="flex items-center gap-2 text-gray-600 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-500/80 animate-pulse" />
            所有系统正常运行
          </div>
        </div>
      </div>
    </footer>
  );
}
