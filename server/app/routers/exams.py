from fastapi import APIRouter
from ..db import list_exams, list_results

router = APIRouter()


@router.get("/exams")
def get_exams():
    return list_exams()


@router.get("/results/{exam_id}")
def get_results(exam_id: int):
    return list_results(exam_id)
