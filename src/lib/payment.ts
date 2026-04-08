// 支付相关工具函数 + 套餐配置

export interface Plan {
  id: string
  label: string
  price: number
  period: string
  features: string[]
  highlight?: boolean
}

export const PLAN_LIST: Plan[] = [
  {
    id: 'daily',
    label: '日卡',
    price: 9.9,
    period: '1天',
    features: ['24小时畅聊', '支持4人同时在线', '基础消息记录'],
  },
  {
    id: 'weekly',
    label: '周卡',
    price: 29.9,
    period: '7天',
    features: ['7天畅聊', '支持8人同时在线', '消息记录保存7天', '文件传输'],
  },
  {
    id: 'monthly',
    label: '月卡',
    price: 69.9,
    period: '30天',
    features: ['30天畅聊', '支持16人同时在线', '消息记录保存30天', '文件传输', '优先客服支持'],
    highlight: true,
  },
  {
    id: 'quarterly',
    label: '季卡',
    price: 169.9,
    period: '90天',
    features: ['90天畅聊', '支持32人同时在线', '消息记录永久保存', '大文件传输', '专属客服', '自定义房间主题'],
  },
  {
    id: 'yearly',
    label: '年卡',
    price: 499.9,
    period: '365天',
    features: ['全年畅聊', '支持100人同时在线', '消息记录永久保存', '超大文件传输', 'VIP专属客服', '自定义房间主题', 'API接口访问'],
  },
]

/**
 * 根据套餐ID获取套餐信息
 * @param planId 套餐ID
 * @returns 套餐信息或undefined
 */
export function getPlanById(planId: string): Plan | undefined {
  return PLAN_LIST.find(plan => plan.id === planId)
}

/**
 * 格式化价格显示
 * @param price 价格
 * @returns 格式化后的价格字符串
 */
export function formatPrice(price: number): string {
  return `¥${price.toFixed(2)}`
}

/**
 * 计算日均价格
 * @param plan 套餐信息
 * @returns 日均价格
 */
export function calculateDailyPrice(plan: Plan): number {
  const periodMap: Record<string, number> = {
    '1天': 1,
    '7天': 7,
    '30天': 30,
    '90天': 90,
    '365天': 365,
  }
  const days = periodMap[plan.period] || 1
  return plan.price / days
}

/**
 * 获取推荐套餐（高亮显示的套餐）
 * @returns 推荐套餐
 */
export function getRecommendedPlan(): Plan | undefined {
  return PLAN_LIST.find(plan => plan.highlight) || PLAN_LIST[2]
}

/**
 * 比较套餐性价比（计算节省百分比）
 * @param targetPlan 目标套餐
 * @param basePlan 基准套餐（默认为日卡）
 * @returns 节省百分比
 */
export function calculateSavings(targetPlan: Plan, basePlan: Plan = PLAN_LIST[0]): number {
  const targetDaily = calculateDailyPrice(targetPlan)
  const baseDaily = calculateDailyPrice(basePlan)
  const savings = ((baseDaily - targetDaily) / baseDaily) * 100
  return Math.round(savings)
}

/**
 * 生成订单号
 * @returns 唯一订单号
 */
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ORD${timestamp}${random}`
}

/**
 * 支付方式枚举
 */
export enum PaymentMethod {
  WECHAT = 'wechat',
  ALIPAY = 'alipay',
  CARD = 'card',
}

/**
 * 支付状态枚举
 */
export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * 订单信息接口
 */
export interface Order {
  id: string
  planId: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  createdAt: number
  paidAt?: number
}

// 占位函数 — 真实支付宝支付需替换为实际接口
export async function createAlipayOrder(planId: string, planName: string, amount: number): Promise<{ error?: string; qrCode?: string; outTradeNo?: string }> {
  return { error: '支付功能待配置', qrCode: '', outTradeNo: '' }
}

export async function queryPayStatus(tradeNo: string, planId: string): Promise<{ status: string }> {
  return { status: 'PENDING' }
}
