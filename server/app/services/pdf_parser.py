"""
PDF / DOCX / TXT 解析 + 公式区域检测 + 裁图。

输出：
{
  "text": str,                         # 全文文字（公式区域用占位符 __FORMULA_i__ 替代）
  "formula_regions": [
    {"page": int, "rect": [x0,y0,x1,y1], "image_bytes": bytes(PNG)}
  ]
}
"""

import io
import fitz  # pymuppy

# 启发式：这些字体名通常用于数学公式
MATH_FONT_SUBSTR = (
    "math", "cmsy", "cmmi", "cmr", "symbol", "asana", "latin modern",
    "euler", "stmary", "msam", "msbm", "txsys", "pxsy", "fontmath",
)

# 数学相关 Unicode 块里的常见字符（用于字符级启发式）
MATH_CHARS = set(
    "∑∏∫∂√∞≈≠≤≥±×÷∈∉⊂⊃∪∩∧∨¬⇒⇔∀∃∅∇∠⊥∥"
    "αβγδεζηθικλμνξπρστυφχψω"
    "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ"
    "′″‴⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎"
    "ℕℤℚℝℂℍⅈⅉ"
    "→←↑↓↔↕⇒⇐⇑⇓⇔"
    "≤≥≪≫≮≯≦≧≨≩"
    "±∓⋅∗∘∙"
    "⃗⃐⃑"
)


def _is_math_font(font_name: str) -> bool:
    low = font_name.lower()
    return any(sub in low for sub in MATH_FONT_SUBSTR)


def _span_math_score(span: dict) -> float:
    """给一个文字 span 打‘公式嫌疑分’。"""
    score = 0.0
    font = span.get("font", "")
    text = span.get("text", "")
    if _is_math_font(font):
        score += 2.0
    if text:
        math_chars = sum(1 for ch in text if ch in MATH_CHARS)
        ratio = math_chars / len(text)
        if ratio > 0.3:
            score += 3.0
        elif ratio > 0.1:
            score += 1.0
        # 数学 Unicode 块（U+1D400–U+1D7FF Alphanumeric Symbols）
        if any(0x1D400 <= ord(ch) <= 0x1D7FF for ch in text):
            score += 2.0
    return score


def parse_pdf(file_bytes: bytes) -> dict:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    all_lines = []          # 每页的文字行
    formula_regions = []    # 公式区域
    formula_idx = 0

    for page_no in range(len(doc)):
        page = doc[page_no]
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        page_lines = []

        for block in blocks:
            if block.get("type") != 0:  # 跳过图片块
                continue
            for line in block.get("lines", []):
                line_text_parts = []
                line_spans = line.get("spans", [])
                if not line_spans:
                    continue

                # 判断该行是否为公式行：多数 span 命中公式启发式
                math_span_count = sum(1 for s in line_spans if _span_math_score(s) >= 2.0)
                is_formula_line = math_span_count > 0 and math_span_count >= len(line_spans) * 0.5

                if is_formula_line:
                    # 用占位符替代，后续 math-ocr 回填
                    placeholder = f"__FORMULA_{formula_idx}__"
                    line_text_parts.append(placeholder)
                    # 该行 bbox 作为公式区域
                    x0 = min(s["bbox"][0] for s in line_spans)
                    y0 = min(s["bbox"][1] for s in line_spans)
                    x1 = max(s["bbox"][2] for s in line_spans)
                    y1 = max(s["bbox"][3] for s in line_spans)
                    # 扩展一点边距
                    margin = 4
                    rect = fitz.Rect(
                        max(0, x0 - margin), max(0, y0 - margin),
                        min(page.rect.width, x1 + margin), min(page.rect.height, y1 + margin)
                    )
                    if rect.width > 10 and rect.height > 5:
                        pix = page.get_pixmap(clip=rect, dpi=200)
                        image_bytes = pix.tobytes("png")
                        formula_regions.append({
                            "page": page_no,
                            "rect": [rect.x0, rect.y0, rect.x1, rect.y1],
                            "image_bytes": image_bytes,
                        })
                        formula_idx += 1
                else:
                    for span in line_spans:
                        line_text_parts.append(span.get("text", ""))

                page_lines.append("".join(line_text_parts))

            page_lines.append("")  # 块间空行

        all_lines.extend(page_lines)
        all_lines.append("")  # 页间空行

    return {
        "text": "\n".join(all_lines),
        "formula_regions": formula_regions,
    }


def parse_docx(file_bytes: bytes) -> dict:
    try:
        import mammoth
    except ImportError:
        raise RuntimeError("未安装 mammoth，DOCX 解析不可用")
    result = mammoth.extractRawText(io.BytesIO(file_bytes))
    return {"text": result.value, "formula_regions": []}


def parse_txt(file_bytes: bytes) -> dict:
    text = file_bytes.decode("utf-8", errors="replace")
    return {"text": text, "formula_regions": []}


def parse_document(filename: str, file_bytes: bytes) -> dict:
    low = filename.lower()
    if low.endswith(".pdf"):
        return parse_pdf(file_bytes)
    if low.endswith(".docx"):
        return parse_docx(file_bytes)
    if low.endswith(".txt"):
        return parse_txt(file_bytes)
    raise ValueError(f"不支持的文件格式: {filename}（支持 PDF / DOCX / TXT）")
