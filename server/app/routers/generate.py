import random
from fastapi import APIRouter
from ..db import list_questions, list_pool
from ..models import GenerateIn

router = APIRouter()


@router.post("/generate")
def generate(payload: GenerateIn):
    # 从抽取池取题，按用户题库 stem 去重
    pool = list_pool()
    user_stems = {q["stem"] for q in list_questions()}

    candidates = [q for q in pool if q["type"] == payload.type
                  and q["stem"] not in user_stems]
    if payload.difficulty:
        candidates = [q for q in candidates if q["difficulty"] == payload.difficulty]

    random.shuffle(candidates)
    picked = candidates[: payload.count]
    return [{**q, "id": f"llm-{random.randint(10**9,10**10-1)}", "ocr_todos": []} for q in picked]
