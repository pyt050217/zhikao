"""
Vercel Serverless Function: LLM 智能出题。

POST /api/generate  body: { subject, topic?, type, difficulty?, count }
  subject: "linear_algebra" | "calculus"
  topic:   可选，具体专题（如 "matrix" "eigenvalue" "limit" "integral"）
  type:    "single" | "multiple" | "judge" | "blank" | "essay"
  difficulty: "easy" | "medium" | "hard"
  count:   1-5

返回: { questions: [...] }

调用 Claude (haiku) 生成结构化 JSON 题目。
使用 few-shot 示例（从题库抽取同科目题目）约束输出范围和格式。
"""

import json
import os
import random
import re

try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None

# ── 模型配置 ──────────────────────────────────────────────────────
MODEL = "claude-haiku-4-20250514"
MAX_TOKENS = 2048

# ── 题库路径（Vercel 部署时与 api/ 同级）─────────────────────────
_bank_cache = None

def _load_bank():
    """加载题库，按 subject 索引。"""
    global _bank_cache
    if _bank_cache is not None:
        return _bank_cache
    base = os.path.dirname(os.path.abspath(__file__))
    bank_path = os.path.join(base, "..", "frontend", "src", "mock", "question-bank.json")
    try:
        with open(bank_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # 按 subject 索引
        by_subject = {}
        for q in data.get("questions", []):
            subj = q.get("subject", "unknown")
            if subj not in by_subject:
                by_subject[subj] = []
            by_subject[subj].append(q)
        _bank_cache = by_subject
    except Exception:
        _bank_cache = {}
    return _bank_cache


def _get_few_shot_examples(subject, topic, n=2):
    """从题库抽取 n 道同科目（优先同专题）的题目作为 few-shot 示例。"""
    bank = _load_bank()
    subject_questions = bank.get(subject, [])
    if not subject_questions:
        return []

    # 优先同专题
    if topic:
        same_topic = [q for q in subject_questions if q.get("topic") == topic]
        if len(same_topic) >= n:
            return random.sample(same_topic, n)

    # 不够则从同科目补充
    if len(subject_questions) >= n:
        return random.sample(subject_questions, n)
    return subject_questions


def _format_example(q):
    """将题库题目格式化为 few-shot 示例字符串（JSON 格式，单反斜杠）。"""
    # 用 json.dumps 确保 LaTeX 单反斜杠正确转义为双反斜杠
    example = {
        "type": q.get("type", "single"),
        "difficulty": q.get("difficulty", "medium"),
        "stem": q.get("stem", ""),
        "options": q.get("options") if q.get("options") else None,
        "answer": q.get("answer", 0),
        "explanation": q.get("explanation", "参见相关知识点"),
    }
    return json.dumps(example, ensure_ascii=False, indent=2)


# ── 学科配置 ──────────────────────────────────────────────────────
SUBJECTS = {
    "linear_algebra": {
        "label": "线性代数",
        "knowledge_scope": "矩阵运算、行列式、向量空间、线性变换、特征值与特征向量、线性方程组",
        "forbidden_topics": "化学、物理、生物、语文、英语、历史、地理等任何其他学科",
        "latex_examples": r"矩阵 $\begin{pmatrix}1&2\\3&4\end{pmatrix}$、行列式 $\det(A)$、特征值 $\lambda$、向量 $\vec{v}$、线性方程组",
        "topics": [
            {"key": "matrix", "label": "矩阵运算"},
            {"key": "determinant", "label": "行列式"},
            {"key": "vector_space", "label": "向量空间"},
            {"key": "linear_transform", "label": "线性变换"},
            {"key": "eigenvalue", "label": "特征值与特征向量"},
            {"key": "linear_system", "label": "线性方程组"},
        ],
    },
    "calculus": {
        "label": "微积分",
        "knowledge_scope": "极限与连续、导数与微分、不定积分与定积分、级数、多元函数微分、常微分方程",
        "forbidden_topics": "化学、物理、生物、语文、英语、历史、地理等任何其他学科",
        "latex_examples": r"极限 $\lim_{x\to 0}$、导数 $f'(x)$、积分 $\int_0^1 f(x)\,dx$、级数 $\sum_{n=1}^{\infty}$、偏导 $\frac{\partial f}{\partial x}$",
        "topics": [
            {"key": "limit", "label": "极限与连续"},
            {"key": "derivative", "label": "导数与微分"},
            {"key": "integral", "label": "不定积分与定积分"},
            {"key": "series", "label": "级数"},
            {"key": "multivar", "label": "多元函数微分"},
            {"key": "ode", "label": "常微分方程"},
        ],
    },
}

TYPE_LABELS = {
    "single": "单选题（4 选 1）",
    "multiple": "多选题（多个正确选项）",
    "judge": "判断题",
    "blank": "填空题",
    "essay": "简答题",
}

DIFFICULTY_LABELS = {"easy": "简单", "medium": "中等", "hard": "困难", "": "中等"}


def _client():
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        raise RuntimeError("未配置 ANTHROPIC_API_KEY")
    return Anthropic(api_key=key)


def _build_prompt(subject, topic, qtype, difficulty, count):
    """构建带 few-shot 示例的 prompt。"""
    cfg = SUBJECTS[subject]
    topic_label = "综合"
    if topic:
        for t in cfg["topics"]:
            if t["key"] == topic:
                topic_label = t["label"]
                break

    # 获取 few-shot 示例
    examples = _get_few_shot_examples(subject, topic, n=2)
    examples_text = ""
    if examples:
        examples_str = "\n".join(_format_example(ex) for ex in examples)
        examples_text = f"""
【参考示例】以下是{ cfg['label'] }的题目格式范例，请参照此格式和难度：
{examples_str}
"""

    return (
        f"你是一名**{cfg['label']}**课程教师。请生成 {count} 道{difficulty_label}难度的{topic_label}题目。\n\n"
        f"【严格约束】\n"
        f"- 题目内容**必须且仅限**于{cfg['label']}的知识范围：{cfg['knowledge_scope']}\n"
        f"- **严禁**出现{cfg['forbidden_topics']}的内容\n"
        f"- 如果用户选择了某个专题，请严格围绕该专题出题\n\n"
        f"【题型要求】{type_label}\n"
        f"【输出格式】严格 JSON，不要任何解释文字：\n"
        "{{\n"
        '  "questions": [\n'
        "    {{\n"
        f'      "type": "{qtype}",\n'
        f'      "difficulty": "{difficulty}",\n'
        '      "stem": "题干（LaTeX 公式用 $...$ 包裹）",\n'
        '      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],\n'
        '      "answer": 1,\n'
        '      "explanation": "简要解析"\n'
        "    }}\n"
        "  ]\n"
        "}}\n\n"
        f"【格式规则】\n"
        f"- 选择题 options 为 4 项数组，answer 为正确选项索引 (0-3)\n"
        f"- 填空题 options 为 null，answer 为字符串答案\n"
        f"- 判断题 options 为 [\"正确\", \"错误\"]，answer 为 0 或 1\n"
        f"- 简答题 options 为 null，answer 为参考答案文本\n"
        f"- 数学符号用 LaTeX：{cfg['latex_examples']}\n"
        f"- **重要：JSON 字符串中的反斜杠必须双写**（如 `\\\\begin{{pmatrix}}`、`\\\\int`、`\\\\frac{{a}}{{b}}`），否则 JSON 解析会失败\n"
        f"{examples_text}\n"
        f"确保题目正确、数据自洽、难度适当。**仅输出 JSON，不要任何额外文字**。"
    ).format(
        difficulty_label=DIFFICULTY_LABELS.get(difficulty, "中等"),
    )


def _parse_response(text):
    """从 Claude 输出中解析 JSON。"""
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return None


def _normalize_question(raw, subject, index):
    """将 Claude 输出的原始题目归一化为前端期望格式。"""
    qtype = raw.get("type", "single")
    options = raw.get("options")
    answer = raw.get("answer", 0)

    if qtype == "multiple" and isinstance(answer, str):
        nums = re.findall(r'\d+', answer)
        answer = [int(n) for n in nums]

    return {
        "id": f"llm-{random.randint(10**9, 10**10-1)}",
        "subject": subject,
        "type": qtype,
        "difficulty": raw.get("difficulty", "medium"),
        "stem": raw.get("stem", "").strip(),
        "options": options if options else None,
        "answer": answer,
        "source": "llm",
        "_explanation": raw.get("explanation", ""),
    }


def generate_llm(subject, topic, qtype, difficulty, count):
    """调用 Claude API 生成题目。"""
    client = _client()
    prompt = _build_prompt(subject, topic, qtype, difficulty, count)

    resp = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(
        getattr(b, "text", "") for b in resp.content if hasattr(b, "text")
    ).strip()

    data = _parse_response(text)
    if not data or not data.get("questions"):
        raise RuntimeError("LLM 输出解析失败")

    questions = [_normalize_question(q, subject, i) for i, q in enumerate(data["questions"])]
    return questions[:count]


# ── Vercel handler ────────────────────────────────────────────────
def handler(request):
    if request.method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors(), "body": ""}
    if request.method != "POST":
        return {"statusCode": 405, "headers": _cors(), "body": "method not allowed"}

    try:
        body = json.loads(request.get("body", "{}") or "{}")
    except Exception:
        return {"statusCode": 400, "headers": _cors(), "body": json.dumps({"error": "invalid json"})}

    subject = body.get("subject", "")
    if subject not in SUBJECTS:
        return {"statusCode": 400, "headers": _cors(),
                "body": json.dumps({"error": f"不支持的学科: {subject}"})}

    topic = body.get("topic") or ""
    qtype = body.get("type", "single")
    difficulty = body.get("difficulty") or "medium"
    count = min(max(int(body.get("count", 3)), 1), 5)

    if Anthropic is None:
        return {"statusCode": 500, "headers": _cors(),
                "body": json.dumps({"error": "anthropic SDK 未安装"})}

    try:
        questions = generate_llm(subject, topic, qtype, difficulty, count)
        return {
            "statusCode": 200,
            "headers": {**_cors(), "Content-Type": "application/json"},
            "body": json.dumps({"questions": questions}, ensure_ascii=False),
        }
    except Exception as e:
        return {"statusCode": 500, "headers": _cors(),
                "body": json.dumps({"error": str(e)})}


def _cors():
    return {
        "Access-Control-Allow-Origin": os.getenv("FRONTEND_ORIGIN", "*"),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }
