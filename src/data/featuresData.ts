import type { Feature, Testimonial } from '../types';

export const features: Feature[] = [
  {
    icon: '🔒',
    title: '端到端加密',
    description: '采用业界领先的加密算法，确保只有通信双方可以读取消息内容，真正的私密通信。',
  },
  {
    icon: '🔥',
    title: '阅后即焚',
    description: '消息在预设时间后自动销毁，不留任何痕迹。销毁时间从15秒到2.5小时自由选择。',
  },
  {
    icon: '📁',
    title: '安全文件传输',
    description: '支持图片、PDF、Office文档等多种格式，发送者可控制下载权限，确保文件不外泄。',
  },
  {
    icon: '🔑',
    title: '房间密码保护',
    description: '高级聊天室采用4位数字密码保护，仅限授权用户进入，防止未授权访问。',
  },
  {
    icon: '📱',
    title: 'PWA移动适配',
    description: '无需下载APP，一键添加到主屏幕，离线可用，支持消息推送通知，随时随地沟通。',
  },
  {
    icon: '⚡',
    title: '实时同步',
    description: '300ms轮询间隔，多设备实时同步，确保消息即时到达，不丢失任何重要信息。',
  },
];

export const securityFeatures = [
  {
    title: '零存储架构',
    description: '消息不落地本地服务器，数据仅存在于通信双方的设备中，真正实现无痕沟通。',
  },
  {
    title: 'AI内容审核',
    description: '集成阿里云/腾讯云AI审核，智能识别违规内容，构建安全健康的沟通环境。',
  },
  {
    title: '合规可追溯',
    description: '邮箱实名绑定，违法可追责，平衡隐私保护与合规要求，满足企业审计需求。',
  },
  {
    title: '独立聊天室',
    description: '无组织架构绑定，临时即用即走，避免商业信息被钉钉/企业微信等平台留存。',
  },
];

export const scenarios = [
  {
    emoji: '💼',
    title: '商务谈判',
    description: '敏感价格、合同条款的临时沟通，交易完成后即时销毁，不留证据不留痕。',
  },
  {
    emoji: '🛡️',
    title: '防飞单管理',
    description: '销售团队保护客户资源的首选，防止私下加客户微信，截断飞单源头。',
  },
  {
    emoji: '🤝',
    title: '项目外包协作',
    description: '与外包团队的技术细节沟通，技术方案不外泄，项目结束即清理。',
  },
  {
    emoji: '💰',
    title: '投资洽谈',
    description: '融资条款、估值信息的保密交流，适合投资人、创业者、高管之间的私密对话。',
  },
];

export const testimonials: Testimonial[] = [
  {
    name: '张总',
    role: '某科技公司 CEO',
    content: 'TopTalk 完美解决了我们商务谈判的私密需求，加密+阅后即焚让我们放心交流敏感条款。',
    avatar: '👨‍💼',
  },
  {
    name: '李经理',
    role: '某投资机构 投资总监',
    content: '用 TopTalk 和创业者谈 TS，再也不用担心信息泄露。高端专业，很有安全感。',
    avatar: '👩‍💼',
  },
  {
    name: '王总监',
    role: '某咨询公司 合伙人',
    content: '防飞单神器！销售团队管理必备，客户资源得到有效保护，团队协作更规范。',
    avatar: '👨‍💻',
  },
];
