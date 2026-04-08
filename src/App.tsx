import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import PersonalCenterPage from './pages/PersonalCenterPage'
import FreeRoomSelection from './pages/FreeRoomSelection'
import PaymentPage from './pages/PaymentPage'
import LegalPage from './pages/LegalPage'
import PremiumRoomSelection from './pages/PremiumRoomSelection'
import PremiumChatRoom from './pages/PremiumChatRoom'
import FreeChatRoom from './pages/FreeChatRoom'
import BankTransferPage from './pages/BankTransferPage'
import AdminOrdersPage from './pages/AdminOrdersPage'
import AdminPaymentsPage from './pages/AdminPaymentsPage'
import AdminLoginPage from './pages/AdminLoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { useEffect } from 'react'
import { syncSubscriptionFromApprovedOrder } from './lib/subscription'

// 订阅同步逻辑已抽到 src/lib/subscription.ts，避免各页状态不一致

export default function App() {
  useEffect(() => {
    // 页面加载时：检查已登录用户是否有已通过的订单
    const stored = localStorage.getItem('toptalk_user')
    if (stored) {
      try {
        const user = JSON.parse(stored)
        if (user.email) {
          syncSubscriptionFromApprovedOrder(user.email)
        }
      } catch {}
    }

    // 登录事件触发时：重新检查订阅
    const handler = () => {
      const s = localStorage.getItem('toptalk_user')
      if (s) {
        try {
          const u = JSON.parse(s)
          if (u.email) syncSubscriptionFromApprovedOrder(u.email)
        } catch {}
      }
    }
    window.addEventListener('toptalk_login', handler)
    return () => window.removeEventListener('toptalk_login', handler)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/personal-center" element={<PersonalCenterPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/legal/:type" element={<LegalPage />} />

        {/* 即时聊天室：选择页 → 聊天室内页 */}
        <Route path="/rooms" element={
          <ProtectedRoute>
            <FreeRoomSelection />
          </ProtectedRoute>
        } />
        <Route path="/free-chat" element={<FreeChatRoom />} />

        {/* 高级聊天室：选择页 → 聊天室内页 */}
        <Route path="/rooms-premium" element={<PremiumRoomSelection />} />
        <Route path="/premium-chat" element={<PremiumChatRoom />} />

        {/* 支付页面 */}
        <Route path="/bank-transfer" element={<BankTransferPage />} />
        <Route path="/admin/orders" element={<AdminOrdersPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/payments" element={<AdminPaymentsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
