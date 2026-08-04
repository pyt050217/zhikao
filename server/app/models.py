from pydantic import BaseModel
from typing import Literal, Optional, Union

QuestionType = Literal["single", "multiple", "judge", "blank", "essay"]
Difficulty = Literal["easy", "medium", "hard"]
Source = Literal["llm", "manual", "import"]


class Question(BaseModel):
    id: str
    type: QuestionType
    difficulty: Difficulty
    stem: str
    options: Optional[list[str]] = None
    answer: Union[int, list[int], str] = 0
    source: Source = "import"
    ocr_todos: list[str] = []  # 存疑的公式说明，教师复核用


class QuestionBatchIn(BaseModel):
    questions: list[Question]


class GenerateIn(BaseModel):
    type: QuestionType
    difficulty: Optional[Difficulty] = None
    count: int = 3
