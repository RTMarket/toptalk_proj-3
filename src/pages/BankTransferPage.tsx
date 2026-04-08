import React, { useState } from 'react';

interface BankTransferPageProps {
  // 你可以根据需要添加 props
}

const BankTransferPage: React.FC<BankTransferPageProps> = () => {
  // 状态里加一个 email
  const [userEmail, setUserEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [base64, setBase64] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 处理截图上传
  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshot(file);
      // 转换为 base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setBase64(result.split(',')[1]); // 去掉 data:image/xxx;base64, 前缀
      };
      reader.readAsDataURL(file);
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!userEmail || !selectedPlan || !screenshot) {
      alert('请填写完整信息');
      return;
    }

    setIsSubmitting(true);

    try {
      const ext = screenshot.name.split('.').pop() || 'png';
      
      // 提交时把邮箱带上
      const response = await fetch('/api/submit-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          planId: selectedPlan, 
          userEmail, 
          screenshotBase64: base64, 
          screenshotExt: ext 
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert('提交成功！');
        // 重置表单
        setUserEmail('');
        setSelectedPlan('');
        setScreenshot(null);
        setBase64('');
      } else {
        alert('提交失败：' + (data.message || '未知错误'));
      }
    } catch (error) {
      console.error('提交失败:', error);
      alert('提交失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bank-transfer-page">
      <h1>银行转账</h1>
      
      {/* 选择套餐 */}
      <div className="form-group">
        <label>选择套餐：</label>
        <select 
          value={selectedPlan} 
          onChange={e => setSelectedPlan(e.target.value)}
        >
          <option value="">请选择</option>
          <option value="basic">基础版</option>
          <option value="pro">专业版</option>
          <option value="enterprise">企业版</option>
        </select>
      </div>

      {/* 上传截图那一步，加邮箱输入 */}
      <div className="form-group">
        <label>邮箱地址：</label>
        <input
          type="email"
          value={userEmail}
          onChange={e => setUserEmail(e.target.value)}
          placeholder="user@example.com"
        />
      </div>

      <div className="form-group">
        <label>上传转账截图：</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleScreenshotChange}
        />
        {screenshot && (
          <p className="file-name">已选择: {screenshot.name}</p>
        )}
      </div>

      <button 
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="submit-btn"
      >
        {isSubmitting ? '提交中...' : '提交'}
      </button>
    </div>
  );
};

export default BankTransferPage;
