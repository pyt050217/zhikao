from fastapi import APIRouter
from ..db import list_questions, batch_upsert
from ..models import QuestionBatchIn

router = APIRouter()


@router.get("/questions")
def get_questions():
    return list_questions()


@router.post("/questions/batch")
def create_questions(batch: QuestionBatchIn):
    # 入库前去掉 ocr_todos（内部字段，不存 DB）
    rows = [{k: v for k, v in q.dict().items() if k != "ocr_todos"} for q in batch.questions]
    n = batch_upsert(rows)
    return {"inserted": n}
