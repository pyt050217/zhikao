import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

/**
 * 从 PDF 提取文字 + 公式区域裁图。
 * 公式行用占位符 __FORMULA_i__ 替代，同时返回每块公式区域的 PNG (base64 data URL)。
 *
 * 返回: { text: string, formulas: [{ page, image: "data:image/png;base64,..." }] }
 */
export async function parsePdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages_text = []
  const formulas = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })  // 2x 保证清晰度

    // 整页渲染到 canvas（用于裁切公式区域）
    const full_canvas = document.createElement('canvas')
    full_canvas.width = Math.ceil(viewport.width)
    full_canvas.height = Math.ceil(viewport.height)
    const full_ctx = full_canvas.getContext('2d')
    await page.render({ canvasContext: full_ctx, viewport }).promise

    const content = await page.getTextContent()
    // 按 y 坐标分桶为行（pdfjs 的 item.transform[5] 是行基线 y）
    const lines = {}
    content.items.forEach(item => {
      const key = Math.round(item.transform[5])
      if (!lines[key]) lines[key] = []
      lines[key].push(item)
    })

    const sorted_keys = Object.keys(lines).map(Number).sort((a, b) => b - a)
    const page_text_parts = []

    for (const key of sorted_keys) {
      const items = lines[key]
      if (_is_formula_line(items)) {
        const idx = formulas.length
        page_text_parts.push(`__FORMULA_${idx}__`)
        const img = _crop_formula(full_canvas, items, viewport.scale)
        if (img) formulas.push({ page: i, image: img })
      } else {
        page_text_parts.push(items.map(it => it.str).join(''))
      }
    }
    pages_text.push(page_text_parts.join('\n'))
  }

  return { text: pages_text.join('\n\n'), formulas }
}

function _is_formula_line(items) {
  if (!items.length) return false
  let math_spans = 0
  for (const item of items) {
    const font = (item.fontName || '').toLowerCase()
    const text = item.str || ''
    const is_math_font = ['math', 'cmsy', 'cmmi', 'symbol', 'asana', 'latin'].some(f => font.includes(f))
    const has_math_char = /[∑∏∫∂√∞≈≠≤≥±×÷∈∉⊂⊃∪∩α-ωΑ-Ω→←↑↓↔⇌ℓ∂∇]/.test(text)
    if (is_math_font || has_math_char) math_spans++
  }
  return math_spans > 0 && math_spans >= items.length * 0.4
}

function _crop_formula(full_canvas, items, scale) {
  // 计算该行在 PDF 坐标系的 bbox
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const it of items) {
    const w = it.transform[0] || 6  // 近似字符宽度
    const h = it.transform[3] || 10
    const left = it.transform[4]
    const bottom = it.transform[5]
    if (left < x0) x0 = left
    if (bottom < y0) y0 = bottom
    if (left + (it.str?.length || 1) * w > x1) x1 = left + (it.str?.length || 1) * w
    if (bottom + h > y1) y1 = bottom + h
  }
  if (!isFinite(x0) || x1 - x0 < 3 || y1 - y0 < 3) return null

  const margin = 4
  // PDF 坐标 → canvas 像素（注意 y 轴翻转：PDF 原点在左下，canvas 在左上）
  const sx = Math.max(0, (x0 - margin) * scale)
  const sy = Math.max(0, full_canvas.height - (y1 + margin) * scale)
  const sw = Math.min(full_canvas.width - sx, (x1 - x0 + margin * 2) * scale)
  const sh = Math.min(full_canvas.height - sy, (y1 - y0 + margin * 2) * scale)
  if (sw < 5 || sh < 5) return null

  const crop = document.createElement('canvas')
  crop.width = Math.ceil(sw)
  crop.height = Math.ceil(sh)
  crop.getContext('2d').drawImage(full_canvas, sx, sy, sw, sh, 0, 0, sw, sh)
  try {
    return crop.toDataURL('image/png')
  } catch {
    return null
  }
}

export async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return { text: result.value, formulas: [] }
}

export async function parseTxt(file) {
  return { text: await file.text(), formulas: [] }
}

export async function parseFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return parsePdf(file)
  if (name.endsWith('.docx')) return parseDocx(file)
  if (name.endsWith('.txt')) return parseTxt(file)
  throw new Error('不支持的文件格式，请上传 PDF / DOCX / TXT')
}
