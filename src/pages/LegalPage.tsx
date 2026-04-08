import Navbar from "../components/layout/Navbar"
import Footer from "../components/layout/Footer"
import { useParams } from "react-router-dom"

const content: Record<string, { title: string; content: string[] }> = {
  terms: {
    title: "用户协议",
    content: [
      "TopTalk 是一款安全即时通讯平台，为用户提供端到端加密的消息传输服务。使用本服务即表示您同意以下条款。",
      "1. 服务描述：TopTalk 提供阅后即焚、端到端加密的即时通讯服务。消息在预设时间后自动销毁，平台不保留消息内容。",
      "2. 使用规范：您同意不会利用本服务从事任何违法活动，包括但不限于传播违法信息、诈骗、钓鱼、色情、赌博、毒品相关内容。",
      "3. 账户安全：您有责任保护账户凭证的安全，对账户下所有活动负全部责任。",
      "4. 隐私保护：您的通讯内容采用端到端加密，平台无法解密。我们根据适用法律保留必要的合规数据。",
      "5. 知识产权：TopTalk 的所有内容和材料，包括但不限于标志、设计、代码，均为我们的财产。",
      "6. 服务变更：我们保留随时修改或中断服务的权利，并会提前通知用户。",
      "7. 免责声明：因不可抗力或第三方原因导致的服务中断，我们不承担责任。",
    ]
  },
  privacy: {
    title: "隐私政策",
    content: [
      "TopTalk 高度重视用户隐私保护，承诺尊重和保护您的个人信息。",
      "1. 信息收集：我们仅收集为您提供服务所必需的信息，包括邮箱地址（用于账户验证）和使用统计数据。",
      "2. 端到端加密：您的消息内容采用端到端加密技术，平台服务器无法解密您的通信内容。",
      "3. 数据存储：消息内容不在服务器长期存储，阅后即焚功能确保消息在预设时间后自动销毁。",
      "4. 文件处理：您上传的文件仅在传输期间临时存储，传输完成后即删除。",
      "5. 合规保留：根据适用法律，在必要时我们会保留最少的合规数据。",
      "6. 第三方披露：未经您的同意，我们不会向第三方披露您的个人信息，法定要求除外。",
      "7. 您的权利：您有权随时访问、修改或删除您的个人数据。",
    ]
  },
  disclaimer: {
    title: "免责声明",
    content: [
      "使用 TopTalk 服务即表示您理解并同意以下免责声明。",
      "1. 服务「按原样」提供：我们不对服务的持续性、无错误性或准确性做任何保证。",
      "2. 消息销毁：虽然我们设计了阅后即焚功能，但无法保证消息在所有情况下都能被完全销毁。",
      "3. 合规责任：用户需对自身使用本服务的行为负全部责任，确保符合当地法律法规。",
      "4. 设备安全：消息在接收方设备上的安全性取决于用户的设备安全措施。",
      "5. 第三方链接：本服务可能包含第三方网站链接，我们不对第三方行为负责。",
      "6. 不可抗力：在遭受网络攻击、系统故障或不可抗力事件时，服务可能中断。",
      "7. 赔偿：如果您因不当使用本服务导致我们遭受损失，您同意赔偿我们的损失。",
    ]
  }
}

export default function LegalPage() {
  const { type } = useParams<{ type: string }>()
  const page = content[type || "terms"] || content.terms

  return (
    <div className="min-h-screen bg-[#050d1a] text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-3xl font-bold text-white mb-8">{page.title}</h1>
        <div className="space-y-6">
          {page.content.map((para, i) => (
            <p key={i} className="text-gray-400 leading-relaxed text-sm">{para}</p>
          ))}
        </div>
        <div className="mt-8 pt-6 border-t border-white/10">
          <a href="/" className="text-yellow-400 hover:text-yellow-300 text-sm transition-colors">← 返回首页</a>
        </div>
      </div>
      <Footer />
    </div>
  )
}
