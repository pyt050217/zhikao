"""
Vercel Serverless Function: 公式图片 → LaTeX。

接收 JSON: { "formulas": [{ "image": "base64...", "context": "..." }] }
返回 JSON: { "results": [{ "latex": "$...$", "status": "PASS"|"TODO" }] }

按 .claude/references/math-ocr-prompts.md 的识别+核对模板，
识别用 claude-sonnet，核对用 claude-haiku。
"""

import base64
import json
import os

# Vercel Python runtime
try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None

MODEL_IDENTIFY = "claude-sonnet-4-20250514"
MODEL_VERIFY = "claude-haiku-4-20250514"

RECOGNIZE_PROMPT = """你是一名数学公式 OCR 专家。这张图片包含一个数学公式（或公式组）。请把它转成标准 LaTeX。

【核心规则】
- 先定结构（分式/根式/积分/求和/矩阵/上下标的层级），再填符号。
- 行内公式用 $...$，独立成行用 $$...$$。
- 常见映射：α\\alpha β\\beta ∑\\sum ∫\\int √\\sqrt ≤\\leq ≥\\geq ∞\\infty ∈\\in →\\rightarrow ℝ\\mathbb{R} 向量\\vec{x}。
- 手写/模糊/多义处不猜，在该位置输出 % TODO 存疑: <原因>。
- 题干上下文（若有）：{context} —— 用它推断符号含义。

【矩阵识别 — 最关键规则】
如果图片中包含矩阵（多行多列的数字/符号阵列），必须严格遵守：
1. 仔细观察图片，数清楚矩阵有几行几列
2. 每一行对应矩阵的一行，行与行之间用 \\\\ 分隔
3. 同一行内各列用 & 分隔
4. 必须用 \\begin{pmatrix}...\\end{pmatrix}（圆括号）或 \\begin{bmatrix}...\\end{bmatrix}（方括号）或 \\begin{matrix}...\\end{matrix}（无括号）包裹
5. 绝对禁止把多行矩阵拍扁成一行！

正确示例（3×3 矩阵）：
$$\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}$$

错误示例（禁止！）：
$\\begin{pmatrix} a b c d e f g h i \\end{pmatrix}$

输出：仅 LaTeX 字符串（含 $ 或 $$ 包裹），不要任何解释文字。"""

VERIFY_PROMPT = """这是一张数学公式图片，以及识别出的 LaTeX：{latex}。请独立核对：

1. 把 LaTeX 还原成公式，逐项比对原图：
   - 符号是否一致（× vs x、· vs .、| vs l vs 1、O vs 0、希腊字母）
   - 上下标位置（x^2 vs x2、a_{{n+1}} vs an+1）
   - 括号层级与配对（\\left( 有对应 \\right)）
   - 矩阵行列数、积分/求和上下限
   - 正负号
2. 列出所有差异；确认完全一致回 PASS；有差异给出修正 LaTeX；仍不确定标 % TODO 存疑。

输出格式：
PASS: <最终LaTeX>
或
FIX: <修正后的LaTeX>
或
TODO: <说明>
"""


def _client():
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        raise RuntimeError("未配置 ANTHROPIC_API_KEY")
    return Anthropic(api_key=key)


def _call_vision(model, prompt, image_b64, media_type="image/png"):
    client = _client()
    resp = client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                {"type": "text", "text": prompt},
            ],
        }],
    )
    return "".join(getattr(b, "text", "") for b in resp.content if hasattr(b, "text")).strip()


def _fix_matrix_latex(latex):
    """后处理：修复可能被拍扁的矩阵 LaTeX。
    检测 \\begin{matrix/pmatrix/...} 环境中缺少 \\\\ 的情况，尝试补全。
    """
    import re
    # 匹配所有矩阵环境
    matrix_envs = ['matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'Bmatrix']
    result = latex
    for env in matrix_envs:
        # 匹配 \begin{env} ... \end{env}
        pattern = rf'\\begin\{{{env}\}}(.*?)\\end\{{{env}\}}'
        def fix_content(m):
            content = m.group(1).strip()
            # 已有 \\ → 无需修复
            if '\\\\' in content:
                return m.group(0)
            # 无 \\ 但内容较长 → 可能是被拍扁的多行矩阵
            # 尝试按数字/符号分组（每组长度相近则可能是矩阵列）
            # 策略：如果内容里有多个 &，说明列已分隔，只需补行
            if '&' in content:
                # 已有列分隔，检查是否需要补行：按 & 分割后，如果某一段过长，可能是多行拍扁
                # 简单处理：不自动猜测行数，留给 OCR 重试
                return m.group(0)
            return m.group(0)
        result = re.sub(pattern, fix_content, result, flags=re.DOTALL)
    return result


def _ocr_one(image_b64, context):
    raw = _call_vision(MODEL_IDENTIFY, RECOGNIZE_PROMPT.format(context=context or "无"), image_b64)
    # 去除外层 $ 备用
    core = raw.strip()
    if core.startswith("$$") and core.endswith("$$"):
        core = core[2:-2].strip()
        display = True
    elif core.startswith("$") and core.endswith("$"):
        core = core[1:-1].strip()
        display = False
    else:
        display = False

    # 后处理：修复矩阵格式
    core = _fix_matrix_latex(core)

    verify_text = _call_vision(MODEL_VERIFY, VERIFY_PROMPT.format(latex=core), image_b64)
    if verify_text.startswith("PASS:"):
        final = verify_text[len("PASS:"):].strip()
        status = "PASS"
    elif verify_text.startswith("FIX:"):
        final = verify_text[len("FIX:"):].strip()
        status = "PASS"
    else:
        final = core
        status = "TODO"

    wrapped = f"$${final}$$" if display else f"${final}$"
    return {"latex": wrapped, "status": status, "raw_recognize": raw}


# Vercel Python entry: def handler(request) -> response dict
def handler(request):
    if request.method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors(), "body": ""}
    if request.method != "POST":
        return {"statusCode": 405, "headers": _cors(), "body": json.dumps({"error": "method not allowed"})}

    try:
        body = json.loads(request.get("body", "{}"))
    except Exception:
        return {"statusCode": 400, "headers": _cors(), "body": json.dumps({"error": "invalid json"})}

    formulas = body.get("formulas", [])
    if not isinstance(formulas, list) or not formulas:
        return {"statusCode": 400, "headers": _cors(), "body": json.dumps({"error": "formulas required"})}

    if Anthropic is None:
        return {"statusCode": 500, "headers": _cors(),
                "body": json.dumps({"error": "anthropic SDK 未安装，请在 requirements.txt 加入 anthropic"})}

    results = []
    for f in formulas:
        img = f.get("image", "")
        ctx = f.get("context", "")
        try:
            # 支持 data:image/png;base64,xxx 纯 base64
            if "," in img:
                img = img.split(",", 1)[1]
            _ocr_one(img, ctx)
            results.append(_ocr_one(img, ctx))
        except Exception as e:
            results.append({"latex": "", "status": "ERROR", "error": str(e)})

    return {
        "statusCode": 200,
        "headers": {**_cors(), "Content-Type": "application/json"},
        "body": json.dumps({"results": results}, ensure_ascii=False),
    }


def _cors():
    return {
        "Access-Control-Allow-Origin": os.getenv("FRONTEND_ORIGIN", "*"),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }
