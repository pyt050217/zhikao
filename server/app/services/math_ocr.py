"""
math-ocr 服务：公式图片 → LaTeX。

编排两个 Claude 调用：
  1. 识别（claude-sonnet-4-20250514）：看图输出 LaTeX
  2. 核对（claude-haiku-4-20250514）：独立比对，PASS / 修正 / TODO

遵循 .claude/skills/math-ocr.md 与 .claude/references/math-ocr-prompts.md。
"""

import base64
import logging
from ..config import ANTHROPIC_API_KEY

log = logging.getLogger(__name__)

MODEL_IDENTIFY = "claude-sonnet-4-20250514"
MODEL_VERIFY = "claude-haiku-4-20250514"

# 与前端 renderMath 一致的包裹约定
WRAP_INLINE = lambda core: f"${core}$"


def _client():
    from anthropic import Anthropic
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("未配置 ANTHROPIC_API_KEY")
    return Anthropic(api_key=ANTHROPIC_API_KEY)


RECOGNIZE_PROMPT = """你是一名数学公式 OCR 专家。这张图片包含一个数学公式（或公式组）。请把它转成标准 LaTeX。

要求：
- 先定结构（分式/根式/积分/求和/矩阵/上下标的层级），再填符号。
- 行内公式用 $...$，独立成行用 $$...$$。
- 矩阵用 \\begin{matrix}..\\end{matrix} / \\begin{vmatrix}..\\end{vmatrix}，行间 \\\\，列间 &。
- 常见映射：α\\alpha β\\beta ∑\\sum ∫\\int √\\sqrt ≤\\leq ≥\\geq ∞\\infty ∈\\in →\\rightarrow ℝ\\mathbb{R} 向量\\vec{x}。
- 手写/模糊/多义处不猜，在该位置输出 % TODO 存疑: <原因>。
- 题干上下文（若有）：{context} —— 用它推断符号含义。

输出：仅 LaTeX 字符串（含 $ 包裹），不要任何解释文字。"""


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


def _image_block(image_bytes: bytes) -> dict:
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": "image/png", "data": b64},
    }


def recognize(image_bytes: bytes, context: str = "") -> str:
    """识别单张公式图 → LaTeX 字符串（含 $ 包裹）。"""
    client = _client()
    prompt = RECOGNIZE_PROMPT.format(context=context or "无")
    resp = client.messages.create(
        model=MODEL_IDENTIFY,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [_image_block(image_bytes), {"type": "text", "text": prompt}],
        }],
    )
    text = "".join(getattr(b, "text", "") for b in resp.content if hasattr(b, "text"))
    return text.strip()


def verify(image_bytes: bytes, latex: str) -> tuple[str, str]:
    """核对 LaTeX ↔ 原图。返回 (status, final_latex)。
    status: "PASS" | "TODO" """
    client = _client()
    prompt = VERIFY_PROMPT.format(latex=latex)
    resp = client.messages.create(
        model=MODEL_VERIFY,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [_image_block(image_bytes), {"type": "text", "text": prompt}],
        }],
    )
    text = "".join(getattr(b, "text", "") for b in resp.content if hasattr(b, "text")).strip()

    if text.startswith("PASS:"):
        return "PASS", text[len("PASS:"):].strip()
    if text.startswith("FIX:"):
        return "PASS", text[len("FIX:"):].strip()
    if text.startswith("TODO:"):
        # 保留原始 LaTeX，标记存疑
        return "TODO", f"{latex}  % TODO 存疑: {text[len('TODO:'):].strip()}"
    # 无法解析核对回复，保守返回 TODO
    return "TODO", f"{latex}  % TODO 存疑: 核对模型回复无法解析"


def recognize_and_verify(image_bytes: bytes, context: str = "") -> dict:
    """完整流程：识别 + 核对。返回 {latex, status, raw_recognize}。"""
    try:
        raw = recognize(image_bytes, context)
    except Exception as e:
        log.error("math-ocr recognize 失败: %s", e)
        return {"latex": "", "status": "ERROR", "raw_recognize": "", "error": str(e)}

    # 去掉可能的 $ 包裹，核对后再统一包裹
    core = raw.strip()
    if core.startswith("$$") and core.endswith("$$"):
        core = core[2:-2].strip()
        display_mode = True
    elif core.startswith("$") and core.endswith("$"):
        core = core[1:-1].strip()
        display_mode = False
    else:
        display_mode = False

    try:
        status, final_core = verify(image_bytes, core)
    except Exception as e:
        log.error("math-ocr verify 失败: %s", e)
        status, final_core = "TODO", core

    # 统一用行内 $...$ 包裹（与前端 renderMath 一致）
    final = f"$${final_core}$$" if display_mode else f"${final_core}$"
    return {"latex": final, "status": status, "raw_recognize": raw}
