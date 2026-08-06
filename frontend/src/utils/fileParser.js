import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

/**
 * 从 PDF 提取文字 + 公式区域裁图。
 *
 * 核心思路：利用括号高度检测矩阵区域。
 * 矩阵的 ( ) [ ] 括号会被拉伸到覆盖所有行，高度远大于普通文字（通常 > 20px）。
 * 找到大括号后，收集括号之间的所有行，合并为一张图片送 OCR。
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
    const viewport = page.getViewport({ scale: 2 })

    const full_canvas = document.createElement('canvas')
    full_canvas.width = Math.ceil(viewport.width)
    full_canvas.height = Math.ceil(viewport.height)
    const full_ctx = full_canvas.getContext('2d')
    await page.render({ canvasContext: full_ctx, viewport }).promise

    const content = await page.getTextContent()

    // 按 y 坐标分桶为行
    const lines = {}
    content.items.forEach(item => {
      const key = Math.round(item.transform[5])
      if (!lines[key]) lines[key] = []
      lines[key].push(item)
    })

    const sorted_keys = Object.keys(lines).map(Number).sort((a, b) => b - a)

    // ── 第一步：计算每行的平均行高 ──
    const line_heights = {}
    for (const key of sorted_keys) {
      const items = lines[key]
      const heights = items.map(it => it.transform[3] || 10)
      line_heights[key] = heights.reduce((a, b) => a + b, 0) / heights.length
    }
    // 中位数行高（代表普通文字高度）
    const sorted_heights = Object.values(line_heights).sort((a, b) => a - b)
    const median_height = sorted_heights[Math.floor(sorted_heights.length / 2)] || 12
    const TALL_THRESHOLD = median_height * 1.8  // 超过 1.8 倍行高视为"大括号"

    // ── 第二步：找大括号位置 ──
    // 大括号特征：字符为 ( ) [ ] { }，且高度 > TALL_THRESHOLD
    const tall_brackets = []  // [{ char, x, y_top, y_bottom, line_key }]
    for (const key of sorted_keys) {
      for (const it of lines[key]) {
        const h = it.transform[3] || 10
        const ch = it.str || ''
        if (h > TALL_THRESHOLD && /^[()[\]{}]$/.test(ch.trim())) {
          tall_brackets.push({
            char: ch.trim(),
            x: it.transform[4],
            y_top: key + h / 2,
            y_bottom: key - h / 2,
            line_key: key,
            height: h
          })
        }
      }
    }

    // ── 第三步：匹配左右括号，确定矩阵行范围 ──
    const matrix_ranges = []  // [{ y_top, y_bottom, rows: [key1, key2, ...] }]
    const pairs = { '(': ')', '[': ']', '{': '}' }

    for (let b = 0; b < tall_brackets.length; b++) {
      const left = tall_brackets[b]
      if (!pairs[left.char]) continue  // 只处理左括号

      // 找同区域（x 接近）的右括号
      const right = tall_brackets.find(tb =>
        tb.char === pairs[left.char] &&
        Math.abs(tb.x - left.x) > 5 &&  // 在右方
        Math.abs(tb.x - left.x) < 500 && // 不会太远
        tb.y_top <= left.y_top + 5 &&   // y 范围重叠
        tb.y_bottom >= left.y_bottom - 5
      )

      if (right) {
        // 收集左右括号 y 范围内的所有行
        const y_min = Math.min(left.y_bottom, right.y_bottom) - 5
        const y_max = Math.max(left.y_top, right.y_top) + 5
        const matrix_rows = sorted_keys.filter(k => k >= y_min && k <= y_max)
        if (matrix_rows.length >= 2) {
          matrix_ranges.push({
            y_top: y_max,
            y_bottom: y_min,
            rows: matrix_rows.sort((a, b) => b - a)
          })
        }
      }
    }

    // ── 第四步：输出文本，矩阵区域替换为占位符 ──
    const matrix_row_set = new Set()
    for (const range of matrix_ranges) {
      for (const k of range.rows) matrix_row_set.add(k)
    }

    const page_text_parts = []
    let j = 0
    while (j < sorted_keys.length) {
      const key = sorted_keys[j]

      // 检查是否进入矩阵区域
      const matrix = matrix_ranges.find(r => r.rows.includes(key))
      if (matrix) {
        const idx = formulas.length
        page_text_parts.push(`__FORMULA_${idx}__`)
        const img = _crop_formula_block(full_canvas, lines, matrix.rows, viewport.scale)
        if (img) formulas.push({ page: i, image: img })
        // 跳过矩阵所有行
        for (const k of matrix.rows) {
          const idx_to_skip = sorted_keys.indexOf(k)
          if (idx_to_skip >= j) j = idx_to_skip + 1
        }
        continue
      }

      // 普通行：检查是否为公式
      if (_is_formula_line(lines[key])) {
        const idx = formulas.length
        page_text_parts.push(`__FORMULA_${idx}__`)
        const img = _crop_formula_block(full_canvas, lines, [key], viewport.scale)
        if (img) formulas.push({ page: i, image: img })
      } else {
        page_text_parts.push(lines[key].map(it => it.str).join(''))
      }
      j++
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
  return math_spans > 0 && math_spans >= items.length * 0.3
}

/**
 * 裁切一组行为一张图片。
 */
function _crop_formula_block(full_canvas, lines, keys, scale) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const key of keys) {
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

  const margin = 8
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
