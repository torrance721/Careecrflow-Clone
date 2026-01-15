# JobH Chrome Extension 测试指南

## 安装步骤

### 1. 下载 Extension
下载 `chrome-extension.zip` 文件并解压到本地文件夹。

### 2. 加载到 Chrome
1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择解压后的 `chrome-extension` 文件夹
6. Extension 安装成功后会显示在扩展列表中

### 3. 配置 API 地址（可选）
Extension 已预配置连接到 UHired API。如需修改：
1. 点击 Extension 图标打开弹窗
2. 在设置中输入新的 API 地址

---

## 测试用例

### 测试 1: LinkedIn 职位保存

**步骤：**
1. 访问 LinkedIn 职位页面，例如：
   - https://www.linkedin.com/jobs/search/?keywords=software%20engineer
2. 点击任意职位查看详情
3. 点击 Extension 图标
4. 点击 **Save Job** 按钮

**预期结果：**
- 职位标题、公司、地点正确显示
- 点击保存后显示 "Job saved successfully"
- 职位出现在 UHired Job Tracker 中

---

### 测试 2: Indeed 职位保存

**步骤：**
1. 访问 Indeed 职位页面：
   - https://www.indeed.com/jobs?q=software+engineer
2. 点击任意职位查看详情
3. 点击 Extension 图标
4. 点击 **Save Job** 按钮

**预期结果：**
- 职位信息正确提取
- 保存成功

---

### 测试 3: Glassdoor 职位保存

**步骤：**
1. 访问 Glassdoor 职位页面：
   - https://www.glassdoor.com/Job/software-engineer-jobs-SRCH_KO0,17.htm
2. 点击任意职位查看详情
3. 点击 Extension 图标
4. 点击 **Save Job** 按钮

**预期结果：**
- 职位信息正确提取
- 保存成功

---

### 测试 4: LinkedIn Profile 评分

**步骤：**
1. 登录 LinkedIn
2. 访问自己的 Profile 页面
3. 点击 Extension 图标
4. 点击 **Score Profile** 按钮

**预期结果：**
- 显示 0-100 分的评分
- 显示各维度得分（头像、标题、简介、经历、教育、技能、人脉、推荐）
- 显示改进建议

---

## 评分标准

| 维度 | 最高分 | 评分标准 |
|-----|--------|---------|
| 头像 | 10 | 有专业头像 = 10分 |
| 标题 | 15 | ≥100字符 = 15分, ≥50字符 = 10分, ≥20字符 = 5分 |
| 简介 | 15 | ≥500字符 = 15分, ≥200字符 = 10分, ≥100字符 = 5分 |
| 工作经历 | 20 | ≥5条 = 20分, ≥3条 = 15分, ≥1条 = 10分 |
| 教育背景 | 10 | ≥1条 = 10分 |
| 技能 | 10 | ≥10个 = 10分, ≥5个 = 7分, ≥1个 = 3分 |
| 人脉 | 10 | ≥500 = 10分, ≥200 = 7分, ≥50 = 4分 |
| 推荐 | 10 | ≥5条 = 10分, ≥2条 = 6分, ≥1条 = 3分 |
| **总分** | **100** | |

---

## 常见问题

### Q: 保存职位时显示 "Please log in first"
**A:** 需要先在 UHired 网站登录，然后刷新 Extension。

### Q: 职位信息提取不完整
**A:** 网站 DOM 结构可能已更新，请反馈给开发团队更新选择器。

### Q: Extension 图标显示灰色
**A:** 当前页面不是支持的职位网站（LinkedIn/Indeed/Glassdoor）。

---

## 反馈

如遇到问题，请记录：
1. 浏览器版本
2. 问题页面 URL
3. 错误信息截图
4. 控制台日志（F12 → Console）

发送至开发团队进行修复。
