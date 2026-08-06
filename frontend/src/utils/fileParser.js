import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

/**
 * 从 PDF 提取文字 + 公式区域裁图。
 *
 * 关键改进：连续的多行公式（如矩阵）会被合并为一张图片，
 * 让 OCR 一次看到完整结构，输出带 \\ 换行的正确 LaTeX。
 *
 * 公式位置用 __FORMULA_i__ 占位符替代，同时返回每块公式区域的 PNG (base64 data URL)。
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

    // ── 第一步：标记哪些行是公式行 ──
    const line_is_formula = {}
    for (const key of sorted_keys) {
      line_is_formula[key] = _is_formula_line(lines[key])
    }

    // ── 第二步：合并连续的公式行为一个公式块 ──
    // 相邻公式行（y 坐标接近）视为同一个公式（如矩阵的多行）
    const formula_blocks = []  // [{ y_top, y_bottom, keys: [key1, key2, ...] }]
    let current_block = null
    const MERGE_THRESHOLD = 20  // y 坐标差距小于此行高则合并（约 20px ≈ 行间距）

    for (const key of sorted_keys) {
      if (!line_is_formula[key]) {
        current_block = null
        continue
      }
      if (current_block && Math.abs(key - current_block.keys[current_block.keys.length - 1]) < MERGE_THRESHOLD) {
        // 与上一个公式行连续 → 并入同一块
        current_block.keys.push(key)
        current_block.y_bottom = Math.max(current_block.y_bottom, key)
        current_block.y_top = Math.min(current_block.y_top, key)
      } else {
        // 新公式块
        current_block = { y_top: key, y_bottom: key, keys: [key] }
        formula_blocks.push(current_block)
      }
    }

    // ── 第三步：按行输出文本，公式块整体替换为占位符 ──
    const page_text_parts = []
    const processed_formula_keys = new Set()

    for (const key of sorted_keys) {
      // 检查此行是否属于某个公式块
      const block = formula_blocks.find(b => b.keys.includes(key))
      if (block) {
        // 只处理一次：在公式块的第一行（y 最大即最上方）输出占位符
        const block_top_key = Math.max(...block.keys)
        if (key === block_top_key && !processed_formula_keys.has(block_top_key)) {
          const idx = formulas.length
          page_text_parts.push(`__FORMULA_${idx}__`)
          const img = _crop_formula_block(full_canvas, lines, block, viewport.scale)
          if (img) formulas.push({ page: i, image: img })
          processed_formula_keys.add(block_top_key)
        }
        // 跳过公式块内的其他行（已合并处理）
        continue
      }
      // 普通文本行
      page_text_parts.push(lines[key].map(it => it.str).join(''))
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

/**
 * 裁切整个公式块（可能包含多行，如矩阵）。
 * 合并块内所有行的 bbox 范围，一次性裁出完整公式图片。
 */
function _crop_formula_block(full_canvas, lines, block, scale) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const key of block.keys) {
    for (const it of lines[key]) {
      const w = it.transform[0] || 6
      const h = it.transform[3] || 10
      const left = it.transform[4]
      const bottom = it.transform[5]
      if (left < x0) x0 = left
      if (bottom < y0) y0 = bottom
      if (left + (it.str?.length || 1) * w > x1) x1 = left + (it.str?.length || 1) * w
      if (bottom + h > y1) y1 = bottom + h
    }
  }
  if (!isFinite(x0) || x1 - x0 < 3 || y1 - y0 < 3) return null

  const margin = 6
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
