export type OrderStatus = 'pending' | 'approved' | 'rejected' | 'paid'
export type PlanType = 'daily' | 'weekly' | 'monthly' | 'single' | 'enterprise' | 'enterprise_pro'

// DashboardPage / 订单列表页使用的记录格式
export interface OrderRecord {
  id: string
  order_no?: string
  user_email?: string
  user_nickname?: string
  plan_id?: PlanType
  plan_name?: string
  plan?: string          // 兼容旧版 mock
  amount: number
  date?: string           // 兼容旧版 mock (格式 YYYY-MM-DD)
  screenshot_url?: string
  status: OrderStatus
  admin_remark?: string
  created_at?: string
  updated_at?: string
}

export interface Order {
  id?: string
  order_no: string
  user_email: string
  user_nickname: string
  plan_id: string
  plan_name: string
  amount: number
  screenshot_base64?: string
  status: OrderStatus
  admin_remark?: string
  created_at?: string
  updated_at?: string
}

export interface PricingPlan {
  id: string
  name: string
  price: string | number
  priceUnit?: string
  roomCount: number
  duration: string
  type: string
  highlight?: boolean
  badge?: string
  features: string[]
}

export interface Feature {
  icon?: string
  title: string
  description: string
}

export interface Testimonial {
  name: string
  role: string
  content: string
  avatar?: string
}
