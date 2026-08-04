import json
import sqlite3
from contextlib import contextmanager
from .config import DATABASE_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    stem TEXT NOT NULL,
    options TEXT,          -- JSON array or NULL
    answer TEXT NOT NULL,  -- JSON: int / array / string
    source TEXT NOT NULL DEFAULT 'import',
    pool INTEGER NOT NULL DEFAULT 0   -- 0=用户题库, 1=抽取池(不含在GET /questions里)
);
CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    duration INTEGER NOT NULL,
    total_score INTEGER NOT NULL,
    question_ids TEXT NOT NULL,  -- JSON array
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    student_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    submitted_at TEXT,
    answers TEXT NOT NULL  -- JSON array
);
"""


@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA)
        _seed_if_empty(conn)


def _q_to_row(q: dict) -> tuple:
    return (
        str(q["id"]),
        q["type"],
        q["difficulty"],
        q["stem"],
        json.dumps(q.get("options"), ensure_ascii=False) if q.get("options") is not None else None,
        json.dumps(q.get("answer", 0), ensure_ascii=False),
        q.get("source", "import"),
        1 if q.get("pool") else 0,
    )


def _row_to_q(row: sqlite3.Row) -> dict:
    options = json.loads(row["options"]) if row["options"] else None
    answer = json.loads(row["answer"])
    return {
        "id": row["id"],
        "type": row["type"],
        "difficulty": row["difficulty"],
        "stem": row["stem"],
        "options": options,
        "answer": answer,
        "source": row["source"],
        "ocr_todos": [],
    }


def _seed_if_empty(conn: sqlite3.Connection):
    cur = conn.execute("SELECT COUNT(*) AS n FROM questions")
    if cur.fetchone()["n"] > 0:
        return
    # 用户题库种子（pool=0）— 与前端 mock/data.js 一致
    seeds = [
        {"id": "seed-1", "type": "single", "difficulty": "easy",
         "stem": "1 + 1 = ?", "options": ["1", "2", "3", "4"], "answer": 1, "source": "llm"},
        {"id": "seed-2", "type": "multiple", "difficulty": "medium",
         "stem": "以下哪些是唐代诗人？（多选）", "options": ["李白", "杜甫", "苏轼", "白居易"],
         "answer": [0, 1, 3], "source": "manual"},
        {"id": "seed-3", "type": "judge", "difficulty": "easy",
         "stem": "光在真空中沿直线传播。", "options": ["正确", "错误"], "answer": 0, "source": "llm"},
        {"id": "seed-4", "type": "blank", "difficulty": "medium",
         "stem": "The cat ___ on the mat.", "options": None, "answer": "sits", "source": "llm"},
        {"id": "seed-5", "type": "essay", "difficulty": "hard",
         "stem": "简述秦始皇统一六国的历史意义。", "options": None, "answer": "", "source": "manual"},
    ]
    conn.executemany(
        "INSERT INTO questions (id,type,difficulty,stem,options,answer,source,pool) VALUES (?,?,?,?,?,?,?,?)",
        [_q_to_row(q) for q in seeds],
    )
    # 抽取池种子（pool=1）— 从前端 question-bank.json 导入
    try:
        import os
        bank_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "mock", "question-bank.json")
        with open(bank_path, "r", encoding="utf-8") as f:
            bank = json.load(f)
        pool_rows = []
        for q in bank.get("questions", []):
            pool_rows.append(_q_to_row({
                **q, "pool": True,
                "difficulty": q.get("difficulty", "medium"),
                "source": q.get("source", "llm"),
            }))
        if pool_rows:
            conn.executemany(
                "INSERT OR IGNORE INTO questions (id,type,difficulty,stem,options,answer,source,pool) VALUES (?,?,?,?,?,?,?,?)",
                pool_rows,
            )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("导入 question-bank.json 到抽取池失败: %s", e)

    # 种子考试
    conn.execute(
        "INSERT INTO exams (id,title,duration,total_score,question_ids,status,created_at) VALUES (?,?,?,?,?,?,?)",
        (1, "期中测验", 60, 100, json.dumps(["seed-1", "seed-2", "seed-3"]), "published", "2026-07-28"),
    )
    conn.execute(
        "INSERT INTO exams (id,title,duration,total_score,question_ids,status,created_at) VALUES (?,?,?,?,?,?,?)",
        (2, "期末综合", 120, 150, json.dumps(["seed-1", "seed-2", "seed-3", "seed-4", "seed-5"]), "draft", "2026-07-29"),
    )
    # 种子成绩
    conn.execute(
        "INSERT INTO results (exam_id,student_name,score,total,submitted_at,answers) VALUES (?,?,?,?,?,?)",
        (1, "张三", 85, 100, "2026-07-28 14:30",
         json.dumps([{"qid": "seed-1", "userAnswer": 1, "correct": True},
                     {"qid": "seed-2", "userAnswer": [0, 1], "correct": False},
                     {"qid": "seed-3", "userAnswer": 0, "correct": True}])),
    )
    conn.execute(
        "INSERT INTO results (exam_id,student_name,score,total,submitted_at,answers) VALUES (?,?,?,?,?,?)",
        (1, "李四", 92, 100, "2026-07-28 15:10",
         json.dumps([{"qid": "seed-1", "userAnswer": 1, "correct": True},
                     {"qid": "seed-2", "userAnswer": [0, 1, 3], "correct": True},
                     {"qid": "seed-3", "userAnswer": 0, "correct": True}])),
    )


# ── 题目 CRUD ──

def list_questions() -> list[dict]:
    """返回用户题库（不含抽取池）。"""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM questions WHERE pool = 0").fetchall()
        return [_row_to_q(r) for r in rows]


def list_pool() -> list[dict]:
    """返回抽取池。"""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM questions WHERE pool = 1").fetchall()
        return [_row_to_q(r) for r in rows]


def get_questions_by_ids(ids: list[str]) -> list[dict]:
    if not ids:
        return []
    with get_db() as conn:
        placeholders = ",".join("?" * len(ids))
        rows = conn.execute(
            f"SELECT * FROM questions WHERE id IN ({placeholders})", ids
        ).fetchall()
        return [_row_to_row(r) for r in rows]


def batch_upsert(questions: list[dict]) -> int:
    with get_db() as conn:
        conn.executemany(
            """INSERT INTO questions (id,type,difficulty,stem,options,answer,source,pool)
               VALUES (?,?,?,?,?,?,?,?)
               ON CONFLICT(id) DO UPDATE SET
                 type=excluded.type, difficulty=excluded.difficulty,
                 stem=excluded.stem, options=excluded.options,
                 answer=excluded.answer, source=excluded.source,
                 pool=excluded.pool""",
            [_q_to_row(q) for q in questions],
        )
        return len(questions)


# ── 考试 / 成绩 ──

def list_exams() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM exams").fetchall()
        return [{
            "id": r["id"], "title": r["title"], "duration": r["duration"],
            "totalScore": r["total_score"], "questionIds": json.loads(r["question_ids"]),
            "status": r["status"], "createdAt": r["created_at"],
        } for r in rows]


def list_results(exam_id: int) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM results WHERE exam_id = ?", (exam_id,)).fetchall()
        return [{
            "examId": r["exam_id"], "studentName": r["student_name"],
            "score": r["score"], "total": r["total"],
            "submittedAt": r["submitted_at"],
            "answers": json.loads(r["answers"]),
        } for r in rows]


def _row_to_row(r):  # 别名，避免与 _row_to_q 混淆
    return _row_to_q(r)
