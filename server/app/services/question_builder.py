"""
把解析后的文字（含 __FORMULA_i__ 占位符）+ OCR 回填的 LaTeX → 结构化题目。

复用前端 questionSplitter 的题型判断逻辑（搬到 Python）。
"""

import re
import uuid
from typing import Optional

# 题号切分：支持 "1." "1、" "1）" "(1)" "一、" 等
STEM_SPLIT_RE = re.compile(
    r"(?=(?:^|\n)\s*(?:\d+[.、)）]|[一二三四五六七八九十]+[、.])[\s\S])"
)

# 噪声行首（考试声明/密封线/分数表等）
NOISE_LINE_START_RE = re.compile(
    r"^(?:注意事项|考试说明|答卷说明|考前须知|说明[：:]|"
    r"密封线|密\s*封\s*线|"
    r"姓名|班级|学号|考号|座号|准考证|"
    r"得分|评卷人|阅卷人|核分人|总分|满分|"
    r"考试时间|考试时限|时长|分钟|命题人|审核人|"
    r"同学们|提示你|请你|务必|认真|仔细|书写|答卷前|交卷|考试结束|"
    r"信号发出)\s*[：:]?",
    re.IGNORECASE,
)

# 章节标题
SECTION_HEADER_RE = re.compile(
    r"(?:每小题|每题|共|小题|总分|满分).{0,4}(?:分|题)|"
    r"^(?:一|二|三|四|五|六|七|八|九|十)[、.]\s*(?:选择|填空|判断|解答|简答|计算|论述|作文|阅读|写作)",
    re.IGNORECASE,
)

# 考试标题
EXAM_TITLE_RE = re.compile(
    r"^\s*\d{4}[-/年]\d{1,2}.{0,30}(?:期末|期中|月考|模拟|统考|真题)|"
    r"^(?:初三|高三|初二|高二|九年级|高[一二三]).{0,20}(?:期末|期中)",
    re.IGNORECASE,
)

# 装饰线 / 页码
DECORATION_RE = re.compile(
    r"^[—\-_=~＊*＊\s]{3,}$|^\s*第\s*\d+\s*页\s*(?:[/\\]\s*)?共?\s*\d*\s*页?\s*$|"
    r"^\s*-\s*\d+\s*-\s*$|^\s*\d+\s*/\s*\d+\s*$"
)

# 选项行
OPTION_RE = re.compile(r"^\s*([A-H])[.、)）]\s*(.+)$")

# 判断题
JUDGE_STATEMENT_RE = re.compile(r"[。．]$")
ESSAY_PROMPT_RE = re.compile(r"请|简述|分析|论述|解释|说明|描述|回答|你认为|谈谈|试述")
BLANK_RE = re.compile(r"_{2,}|（\s*　?\s*）|\(\s*　?\s*\)")


def _clean_block(block: str) -> str:
    return (block
            .replace("\n", " ")
            .strip())


def _strip_number_prefix(text: str) -> str:
    text = re.sub(r"^\s*\d+[.、)）]\s*", "", text)
    text = re.sub(r"^\s*[一二三四五六七八九十]+[、.]\s*", "", text)
    text = re.sub(r"^\s*[(（]\d+[)）]\s*", "", text)
    return text.strip()


def is_noise(block: str) -> bool:
    if not block:
        return True
    first_line = block.split("\n")[0].strip()
    if NOISE_LINE_START_RE.match(first_line):
        return True
    if SECTION_HEADER_RE.search(block):
        return True
    if NOISE_CONTENT_RE.search(block):
        return True
    if EXAM_TITLE_RE.match(first_line):
        return True
    if len(block) < 4:
        return True
    if re.match(r"^[\d\s.、,，]+$", block):
        return True
    if re.match(r"^\s*[A-H]\s*$", block):
        return True
    return False


NOISE_CONTENT_RE = re.compile(
    r"答卷前|密封线|姓名[:：]|班级[:：]|学号[:：]|考号[:：]|"
    r"命题人|审核人|学年|学期|试卷\s*[AB]卷|考试\s*时间|"
    r"满分\s*\d+|共\s*\d+\s*页|第\s*\d+\s*页"
)


def _classify(lines: list) -> tuple:
    """判断题型，返回 (type, options, answer)。"""
    option_lines = []
    stem_lines = []
    for line in lines:
        m = OPTION_RE.match(line)
        if m and len(option_lines) < 8:
            option_lines.append(m[2].strip())
        else:
            stem_lines.append(line)

    stem = _strip_number_prefix(" ".join(stem_lines).strip())

    if len(option_lines) >= 2:
        return "single", option_lines, 0
    if BLANK_RE.search(stem):
        return "blank", None, "（待填）"
    if (len(stem) < 25 and "？" not in stem and "?" not in stem
            and not ESSAY_PROMPT_RE.search(stem) and JUDGE_STATEMENT_RE.search(stem)):
        return "judge", ["正确", "错误"], 0
    return "essay", None, ""


def _preprocess(text: str) -> str:
    """预处理：去掉装饰线和噪声行。"""
    lines = text.split("\n")
    kept = []
    for line in lines:
        t = line.strip()
        if DECORATION_RE.match(t):
            continue
        if NOISE_LINE_START_RE.match(t):
            continue
        kept.append(t)
    return "\n".join(kept)


def build_questions(text: str, formula_latex: Optional[dict] = None) -> list:
    """
    主入口。
    formula_latex: {formula_index: latex_string}，用于回填 __FORMULA_i__ 占位符。
    """
    formula_latex = formula_latex or {}

    # 1. 回填公式占位符
    processed = text
    for idx, latex in formula_latex.items():
        processed = processed.replace(f"__FORMULA_{idx}__", latex)

    # 2. 预处理（去噪声行）
    processed = _preprocess(processed)

    # 3. 按题号切分
    blocks = STEM_SPLIT_RE.split(processed)
    blocks = [b.strip() for b in blocks if len(b.strip()) > 2]
    blocks = [b for b in blocks if not is_noise(b)]

    if not blocks:
        # 兜底：整份作为一道题
        blocks = [processed]

    questions = []
    for i, block in enumerate(blocks):
        block_text = _clean_block(block)
        lines = [l.strip() for l in block_text.split(" ") if l.strip()]
        qtype, options, answer = _classify(lines)
        stem = _strip_number_prefix(block_text)
        if not stem:
            continue
        questions.append({
            "id": f"import-{uuid.uuid4().hex[:8]}-{i}",
            "type": qtype,
            "difficulty": "medium",  # 默认中等，教师可改
            "stem": stem,
            "options": options,
            "answer": answer,
            "source": "import",
        })

    return questions
