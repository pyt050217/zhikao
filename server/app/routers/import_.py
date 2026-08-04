import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from ..services.pdf_parser import parse_document
from ..services.math_ocr import recognize_and_verify
from ..services.question_builder import build_questions

router = APIRouter()
log = logging.getLogger(__name__)


@router.post("/import")
async def import_document(file: UploadFile = File(...)):
    """上传 PDF/DOCX/TXT → 解析文字 + 公式 OCR → 结构化题目。"""
    filename = file.filename or "upload.bin"
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"读取文件失败: {e}")

    # 1. 解析文字 + 检测公式区域
    try:
        parsed = parse_document(filename, file_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"解析失败: {e}")

    text = parsed["text"]
    formula_regions = parsed["formula_regions"]

    # 2. 对每块公式区域做 OCR
    formula_latex: dict[int, str] = {}
    ocr_todos: list[str] = []
    for idx, region in enumerate(formula_regions):
        try:
            result = recognize_and_verify(region["image_bytes"], context=text[:500])
            latex = result.get("latex", "")
            status = result.get("status", "TODO")
            if latex:
                formula_latex[idx] = latex
            if status in ("TODO", "ERROR"):
                ocr_todos.append(f"第{region['page']+1}页公式 {idx+1}: {status}"
                                 + (f" ({result.get('error', '')})" if result.get("error") else ""))
        except Exception as e:
            log.error("公式 %d OCR 失败: %s", idx, e)
            ocr_todos.append(f"第{region['page']+1}页公式 {idx+1}: 识别失败({e})")

    # 3. 构建结构化题目（导入的题进用户题库 pool=0）
    questions = build_questions(text, formula_latex)
    for q in questions:
        q["pool"] = False

    # 把 ocr_todos 附加到每道题上（教师复核用）
    if ocr_todos:
        for q in questions:
            q["ocr_todos"] = ocr_todos

    return {
        "questions": questions,
        "formula_count": len(formula_regions),
        "ocr_todos": ocr_todos,
    }
