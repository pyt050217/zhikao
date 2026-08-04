---
name: math-ocr
description: 数学公式图像→LaTeX 智能识别智能体。当 PDF/扫描卷/截图中的数学公式是"图像"而非可选文字（pdfjs 提取出乱码/碎片）时，把公式区域裁成图片，调用视觉 LLM（Read 工具 / Claude 视觉）逐块识别为 LaTeX，再经"核对子代理"校验后回填到题目题干/选项。可被 exam-maker 技能在步骤 1 调用，也可独立用于修复已导入题目的公式。当用户要求"识别公式/公式转 LaTeX/数学 OCR/把图片公式转成可渲染的 LaTeX"时使用。
---

# 数学公式图像 OCR（公式图 → 可渲染 LaTeX）

面向**图像形式的数学公式**（扫描卷、拍照、PDF 中公式是图片而非文字）的智能识别智能体。核心承诺：

- **图像公式 → LaTeX**：把公式区域截图，用视觉 LLM 转成标准 LaTeX（行内 `$...$` / 行间 `$$...$$`），可直接被 KaTeX/MathJax 渲染。
- **结构保持**：上下标、分式 `\frac`、根式 `\sqrt`、积分/求和上下限、矩阵 `\begin{matrix}`、希腊字母、正负号等忠实还原。
- **不确定即标注**：模糊/手写/歧义处标注 `% TODO 存疑: <说明>` 并交教师，**不臆造**。
- **核对闭环**：每批识别后派**核对子代理**把 LaTeX 渲染结果与原图比对，FAIL 就重识或标存疑。
- **输出即用**：LaTeX 字符串可直接写入题库 schema 的 `stem` / `options`，前端 KaTeX 即时渲染。

> 这是一个**可被 exam-maker 调用的子技能**：exam-maker 步骤 1 在 PDF→LaTeX 时，凡遇到图像公式就转给本技能；也可独立调用，对已导入题库中"公式显示为乱码/碎片"的题目做修复。

## 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `FORMULA_IMAGES` | 空（由调用方传入） | 公式图片：本地路径 / 数据 URL / PDF 页码+区域，一份或多份。 |
| `CONTEXT` | 空 | 公式所在题干的文字上下文（帮助 LLM 推断符号含义，如 "该题讨论导数"）。 |
| `OUTPUT_MODE` | `inline` | 输出 LaTeX 模式：`inline`（默认，输出 `$...$`）/ `raw`（纯 LaTeX，无 `$` 包裹）/ `display`（输出 `$$...$$`）。 |
| `LANG` | `zh` | 题干语言，影响输出注释与教师提示语言。 |
| `WORKDIR` | 调用方目录 | 中间产物（识别结果、核对日志）写入 `exam-build/math-ocr/`。 |

LaTeX 模式约定（与前端 KaTeX 渲染一致）：
- `inline` → `$...$`，用于题干行内公式。
- `display` → `$$...$$`，用于独立成行的公式。
- `raw` → 纯 LaTeX 片段（如 `\frac{a}{b}`），由调用方自行包裹。

## 工作流程

**步骤 0：接收公式图片 + 上下文。** 确认 `FORMULA_IMAGES` 列表；如有 `CONTEXT` 一并记录（帮助消歧，比如 "Σ" 在级数里是求和、在统计里可能是标准差）。建 `exam-build/math-ocr/`。

**步骤 1：逐图识别 → LaTeX（启动子代理，识别 + 核对）。** 对每张/每块公式图片：
- 派**识别子代理**：把图片交给视觉 LLM，要求输出 LaTeX（提示词模板见 `references/math-ocr-prompts.md`）。识别要点：
  - 先**定结构**：分式/根式/积分/矩阵/上下标层级，再填符号。
  - 常见符号映射：`α\beta\gamma\delta\varepsilon\theta\lambda\mu\pi\sigma\phi\omega\Gamma\Delta\Theta\Lambda\Pi\Sigma\Phi\Omega`、`\int\sum\prod\lim\log\ln\sin\cos\tan\leq\geq\neq\approx\in\subset\forall\exists\rightarrow\leftrightarrow`、`\mathbb{R N Z Q C}`、`\vec{..}\hat{..}\bar{..}`。
  - 矩阵/行列式用 `\begin{matrix}..\end{matrix}` / `\begin{vmatrix}..\end{vmatrix}`，行间 `\\`，列间 `&`。
  - 多义或模糊处**不猜**，输出 `% TODO 存疑: <说明>`。
- 派**核对子代理**：把原图 + 识别出的 LaTeX 一起给它，要求：
  - 用 KaTeX/MathJax 渲染（或在脑中"渲染"）后逐项比对：符号、上下标、正负号、括号层级、矩阵行列数。
  - 列出差异；确认 PASS 或给出修正 LaTeX；仍不确定就标 `% TODO 存疑` 交教师。
- 通过核对的 LaTeX 写入 `exam-build/math-ocr/results.jsonl`（每行：`{"src": "<图片名/区域>", "latex": "$...$", "status": "PASS|TODO"}`）。

**步骤 2：回填 / 交付。**
- 若被 exam-maker 调用：把 LaTeX 回填到对应题目的 `stem` / `options`，替换掉乱码/碎片文本。
- 若独立调用：输出 LaTeX 列表（按 `OUTPUT_MODE` 包裹），调用方写入题库。
- 汇总 `TODO` 数量，**标给教师复核**（`% TODO 存疑` 的项必须人工确认）。

## 质量红线（交付前自检）

- [ ] **结构**：分式、根式、积分限、矩阵行列数与原图一致；
- [ ] **符号**：希腊字母、运算符、关系符无错认（尤其 `×` 与 `x`、`·` 与 `.`、`l` 与 `1` 与 `|`、`O` 与 `0`）；
- [ ] **上下标**：`x^2` vs `x2`、`a_{n+1}` vs `an+1` 位置正确；
- [ ] **括号层级**：`\left( \right)` 配对、矩阵分隔符完整；
- [ ] **可渲染**：LaTeX 能在 KaTeX 编译通过（无未闭合 `$`、未定义宏）；
- [ ] **不确定已标注**：模糊/手写处有 `% TODO 存疑`，未臆造；
- [ ] **教师复核**：`TODO` 项已列出交教师，未擅自回填。

## 注意

- **优先用 Read 工具视觉识读**：Claude 的 Read 工具能"看"图片，是本技能的主力识别通道；无需额外装 tesseract/Mathpix（但可选用）。
- **长公式分片**：超宽公式（如长矩阵、长方程组）按等号/逗号处切分识别，再拼回，避免单次视觉窗口识别不全。
- **与 exam-maker 协作**：exam-maker 步骤 1 先跑 pdfjs 文字提取；对"公式区域"（提取结果为乱码/Unicode 碎片/明显缺符）再调本技能做图像 OCR，二者拼接成完整题面。
- **前端渲染约定**：输出 LaTeX 必须与 KaTeX 兼容（KaTeX 支持的命令见 `https://katex.org/docs/supported.html`）；避免 `\mathscr`、`\bm` 等 KaTeX 需额外配置的命令，教师端默认配置下应直接渲染。
- **子代理提示词模板**：见 `references/math-ocr-prompts.md`（识别模板 + 核对模板）。
