# zhikao — 智能考试平台

教师出题、组卷、发布 → 学生作答 → 自动判分。支持 **PDF 往届试卷导入 + 公式 OCR → LaTeX**。

## 功能

- 🤖 LLM 出题（按题型/难度从题库抽取）
- 📄 导入往届试卷（PDF / DOCX / TXT）
  - 前端 pdfjs 提取文字 + 检测公式区域
  - 公式图片 → Claude 视觉 API → LaTeX（KaTeX 渲染）
  - 自动过滤考试声明/密封线/分数表等噪声
- 📚 题库管理（搜索/筛选/手动建题）
- 📝 组卷发布
- 📊 学生答题 + 成绩汇总

## 本地开发

```bash
# 前端（Vite + Vue 3）
cd frontend
npm install
npm run dev   # http://localhost:3000
```

> 公式 OCR 需要后端边缘函数（见下方部署）。无 API Key 时，导入的题公式显示为占位符，可手动编辑为 LaTeX（`$...$` / `$$...$$`）。

## 部署（Vercel，一键分享）

本项目为**静态站点 + 无服务器边缘函数**，部署到 Vercel 后即可分享链接。

### 1. 推送代码到 GitHub

### 2. 导入到 Vercel

- 在 [vercel.com](https://vercel.com) → New Project → 选择你的 GitHub 仓库
- Framework Preset: **Vite**
- 无需修改构建设置（`vercel.json` 已配置好）

### 3. 配置环境变量（公式 OCR 必需）

在 Vercel 项目 → Settings → Environment Variables：

| 变量 | 说明 |
|------|------|
| `ANTHROPIC_API_KEY` | 从 [console.anthropic.com](https://console.anthropic.com) 获取 |

> 没有 API Key 也能部署，只是"导入试卷"的公式 OCR 不可用（文字提取和题型判断仍正常）。

### 4.  Deploy

Vercel 会自动构建并分配 `https://xxx.vercel.app` 链接，发给任何人即可使用。

## 项目结构

```
frontend/                 # Vue 3 SPA（静态构建到 dist/）
  src/
    api/                  # axios 实例 + API 函数
    utils/
      fileParser.js       # PDF 解析 + 公式区域检测/裁图
      questionSplitter.js # 文字 → 结构化题目 + LaTeX 回填
      renderMath.js       # KaTeX 渲染
    stores/question.js    # Pinia 题库 store
api/                      # Vercel Serverless Functions（Python）
  ocr.py                  # 公式图 → LaTeX（Claude 视觉）
  generate.py             # 从 question-bank.json 抽题
  requirements.txt        # anthropic SDK
vercel.json               # 路由 + 构建设定
```

## 公式 OCR 原理

```
PDF → pdfjs 文字层提取
    ↓ 检测到公式行（数学字体名 / Unicode 数学符号）
    ↓ 该行渲染为 PNG 图片
    → POST /api/ocr → Claude sonnet 识别 + haiku 核对 → LaTeX
    ↓ 回填到题干 __FORMULA_i__ 占位符
    → 前端 KaTeX 渲染
```

## 技术栈

- 前端：Vue 3 + Vite + Element Plus + Pinia + KaTeX + pdfjs-dist
- 边缘函数：Vercel Python Serverless + Anthropic SDK
- 数据：localStorage（题库）+ 静态 JSON（抽取池）
