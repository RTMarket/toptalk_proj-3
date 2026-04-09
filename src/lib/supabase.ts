import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 注意：不要在模块加载时 throw，否则线上（如 Vercel 未配置 env）会直接白屏。
// 缺少配置时，Supabase 调用会失败，但应用其余页面仍可正常渲染。
export const supabaseConfigOk =
  !!supabaseUrl && !supabaseUrl.includes('placeholder') &&
  !!supabaseAnonKey && !supabaseAnonKey.includes('placeholder')

export const supabaseConfigHint =
  'Supabase 未正确配置：请在部署环境设置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（真实值），否则聊天室实时消息无法互通。'

export const supabase = createClient(
  supabaseUrl && !supabaseUrl.includes('placeholder') ? supabaseUrl : 'https://placeholder.supabase.co',
  supabaseAnonKey && !supabaseAnonKey.includes('placeholder') ? supabaseAnonKey : 'placeholder-anon-key'
)

export type Message = {
  id?: string
  room_id: string
  sender_id: string
  sender_name: string
  type: 'text' | 'file'
}

// ── 订单操作 ──────────────────────────────────────────

/** 生成唯一订单号 */
export function generateOrderNo(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rnd = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `TOP${ts}${rnd}`
}

/** 提交银行转账凭证订单 */
export async function submitTransferOrder(order: {
  user_email: string
  user_nickname: string
  plan_id: string
  plan_name: string
  amount: number
  screenshot_base64: string
}): Promise<{ success: boolean; order_no?: string; error?: string }> {
  const order_no = generateOrderNo()
  const { error } = await supabase.from('orders').insert({
    order_no,
    user_email: order.user_email,
    user_nickname: order.user_nickname,
    plan_id: order.plan_id,
    plan_name: order.plan_name,
    amount: order.amount,
    screenshot_base64: order.screenshot_base64,
    status: 'pending',
  })
  if (error) return { success: false, error: error.message }
  return { success: true, order_no }
}

/** 获取全部订单（Admin 用，按时间倒序） */
export async function fetchAllOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return { data: [], error }
  return { data: data ?? [], error: null }
}

/** 更新订单状态（通过/拒绝） */
export async function updateOrderStatus(
  order_no: string,
  status: 'approved' | 'rejected',
  admin_remark?: string
) {
  return supabase
    .from('orders')
    .update({ status, admin_remark: admin_remark ?? null, updated_at: new Date().toISOString() })
    .eq('order_no', order_no)
}

/** 获取用户最新通过的订单 */
export async function fetchApprovedOrder(email: string) {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('user_email', email)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data
}
