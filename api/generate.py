"""
Vercel Serverless Function: 从 question-bank.json 抽取题目。

POST /api/generate  body: { type, difficulty?, count }
返回: { questions: [...] }
"""

import json
import os
import random

_bank_cache = None


def _load_bank():
    global _bank_cache
    if _bank_cache is not None:
        return _bank_cache
    base = os.path.dirname(os.path.abspath(__file__))
    bank_path = os.path.join(base, "..", "frontend", "src", "mock", "question-bank.json")
    try:
        with open(bank_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        _bank_cache = data.get("questions", [])
    except Exception:
        _bank_cache = []
    return _bank_cache


def handler(request):
    if request.method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors(), "body": ""}
    if request.method != "POST":
        return {"statusCode": 405, "headers": _cors(), "body": "method not allowed"}

    try:
        body = json.loads(request.get("body", "{}") or "{}")
    except Exception:
        body = []

    qtype = body.get("type", "single")
    difficulty = body.get("difficulty") or None
    count = min(int(body.get("count", 3)), 10)

    bank = _load_bank()
    pool = [q for q in bank if q.get("type") == qtype]
    if difficulty:
        pool = [q for q in pool if q.get("difficulty") == difficulty]

    random.shuffle(pool)
    picked = pool[:count]

    questions = []
    for i, q in enumerate(picked):
        questions.append({
            "id": f"llm-{random.randint(10**9, 10**10-1)}",
            "type": q["type"],
            "difficulty": q.get("difficulty", "medium"),
            "stem": q["stem"],
            "options": q.get("options"),
            "answer": q.get("answer", 0),
            "source": q.get("source", "llm"),
            "ocr_todos": [],
        })

    return {
        "statusCode": 200,
        "headers": {**_cors(), "Content-Type": "application/json"},
        "body": json.dumps({"questions": questions}, ensure_ascii=False),
    }


def _cors():
    return {
        "Access-Control-Allow-Origin": os.getenv("FRONTEND_ORIGIN", "*"),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }
