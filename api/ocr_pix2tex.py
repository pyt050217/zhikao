"""
Vercel Serverless Function: 公式图片 → LaTeX（Pix2tex 本地推理）。

接收 JSON: { "formulas": [{ "image": "base64...", "context": "..." }] }
返回 JSON: { "results": [{ "latex": "$...$", "status": "PASS"|"ERROR" }] }

Pix2tex 服务运行在 PIX2TEX_URL 环境变量指定的地址（默认 localhost:8502）。
Pix2tex 服务部署方式：
  pip install pix2tex[api]
  python -m pix2tex.api.app --host 0.0.0.0 --port 8502
或使用本项目提供的 Dockerfile 部署。

CPU 环境单张推理约 2-5 秒，超时设为 60 秒。
"""

import base64
import json
import os

try:
    import requests
except ImportError:
    requests = None

PIX2TEX_URL = os.getenv("PIX2TEX_URL", "http://localhost:8502")
PIX2TEX_TIMEOUT = int(os.getenv("PIX2TEX_TIMEOUT", "60"))


def handler(request):
    """Vercel Python entry point."""
    if request.method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors(), "body": ""}
    if request.method != "POST":
        return {"statusCode": 405, "headers": _cors(), "body": json.dumps({"error": "method not allowed"})}

    try:
        body = json.loads(request.get("body", "{}"))
    except Exception:
        return {"statusCode": 400, "headers": _cors(), "body": json.dumps({"error": "invalid json"})}

    formulas = body.get("formulas", [])
    if not isinstance(formulas, list) or not formulas:
        return {"statusCode": 400, "headers": _cors(), "body": json.dumps({"error": "formulas required"})}

    if requests is None:
        return {
            "statusCode": 500,
            "headers": _cors(),
            "body": json.dumps({"error": "requests 库未安装，请在 requirements.txt 加入 requests"}),
        }

    results = []
    for f in formulas:
        img = f.get("image", "")
        # 去掉 data:image/...;base64, 前缀
        if "," in img:
            img = img.split(",", 1)[1]
        latex = _call_pix2tex(img)
        status = "PASS" if latex else "ERROR"
        results.append({"latex": latex or "", "status": status})

    return {
        "statusCode": 200,
        "headers": {**_cors(), "Content-Type": "application/json"},
        "body": json.dumps({"results": results}, ensure_ascii=False),
    }


def _fix_pix2tex_matrix(latex):
    """修复 Pix2tex 输出的矩阵格式。
    Pix2tex 可能把多行矩阵拍扁为 \\matrix{ a b c d e f }，
    \\begin{pmatrix} a & b & c \\ d & e & f \\ g & h & i \\end{pmatrix}
    """
    import re

    # 检测旧式 \\matrix{ ... } 写法（无 & 和 \\）
    def fix_old_matrix(m):
        content = m.group(1).strip()
        if '&' in content or '\\\\' in content:
            return m.group(0)  # 已有行列分隔，无需修复
        # 拍扁的矩阵：尝试按固定列数分组
        # 启发式：统计空格分隔的元素数量，尝试分解为方阵或常见列数
        tokens = content.split()
        n = len(tokens)
        if n < 4:
            return m.group(0)  # 太短，不是矩阵
        # 尝试列数（2-6 列）
        for cols in [2, 3, 4, 5, 6]:
            if n % cols == 0:
                rows = n // cols
                parts = []
                for r in range(rows):
                    row_tokens = tokens[r * cols:(r + 1) * cols]
                    parts.append(' & '.join(row_tokens))
                return '\\begin{pmatrix} ' + ' \\\\ '.join(parts) + ' \\end{pmatrix}'
        return m.group(0)

    # 匹配 \matrix{ ... }（无 begin/end）
    latex = re.sub(r'\\matrix\{([^}]+)\}', fix_old_matrix, latex)

    # 匹配 \begin{pmatrix}...\end{pmatrix} 等环境中缺少 \\ 的情况
    for env in ['pmatrix', 'bmatrix', 'matrix', 'vmatrix']:
        def fix_env(m):
            content = m.group(1).strip()
            if '\\\\' in content:
                return m.group(0)  # 已有行分隔
            if '&' not in content:
                # 无列分隔也无法修复
                return m.group(0)
            # 有 & 但无 \\：说明行被拍扁了
            # 尝试按 & 分割后，每 N 个元素一行
            cells = [c.strip() for c in content.split('&')]
            n = len(cells)
            # 尝试列数
            for cols in [2, 3, 4]:
                if n % cols == 0 and n // cols >= 2:
                    rows = n // cols
                    parts = []
                    for r in range(rows):
                        row_cells = cells[r * cols:(r + 1) * cols]
                        parts.append(' & '.join(row_cells))
                    return f'\\begin{{{env}}} ' + ' \\\\ '.join(parts) + f' \\end{{{env}}}'
            return m.group(0)

        latex = re.sub(
            rf'\\begin\{{{env}\}}(.*?)\\end\{{{env}\}}',
            fix_env,
            latex,
            flags=re.DOTALL
        )

    return latex


def _call_pix2tex(img_b64):
    """
    调用 Pix2tex 本地服务识别单张公式图片。

    Pix2tex API 接受 multipart/form-data 文件上传，
    返回纯文本 LaTeX 字符串。
    """
    try:
        img_bytes = base64.b64decode(img_b64)
        resp = requests.post(
            f"{PIX2TEX_URL}/predict",
            files={"file": ("formula.png", img_bytes, "image/png")},
            timeout=PIX2TEX_TIMEOUT,
        )
        if resp.status_code == 200:
            latex = resp.text.strip()
            if not latex:
                return None
            # 后处理：修复可能被拍扁的矩阵
            latex = _fix_pix2tex_matrix(latex)
            # 确保 LaTeX 有 $ 包裹（Pix2tex 默认输出裸 LaTeX）
            if not latex.startswith("$"):
                # 判断是否独立成行（多行或含 \\）
                if "\n" in latex or "\\\\" in latex or latex.startswith("\\begin"):
                    latex = f"$${latex}$$"
                else:
                    latex = f"${latex}$"
            return latex
    except requests.exceptions.ConnectionError:
        print(f"[ocr_pix2tex] 无法连接 Pix2tex 服务: {PIX2TEX_URL}")
    except requests.exceptions.Timeout:
        print(f"[ocr_pix2tex] Pix2tex 识别超时（>{PIX2TEX_TIMEOUT}s）")
    except Exception as e:
        print(f"[ocr_pix2tex] 识别失败: {e}")
    return None


def _cors():
    return {
        "Access-Control-Allow-Origin": os.getenv("FRONTEND_ORIGIN", "*"),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }
