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
