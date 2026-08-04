import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// pdfjs 需要 worker；Vite 下用 URL 形式引入，避免打包问题
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

/**
 * 从 PDF 文件提取纯文本
 * @param {File} file
 * @returns {Promise<string>} 拼接后的文本
 */
export async function parsePdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // 按 y 坐标分桶为行，同 y 视为一行；行内按出现顺序拼接
    const lines = {}
    content.items.forEach(item => {
      const key = Math.round(item.transform[5])
      if (!lines[key]) lines[key] = []
      lines[key].push(item.str)
    })
    const text = Object.entries(lines)
      .sort((a, b) => Number(b[0]) - Number(a[0])) // y 从大到小（页面上到下）
      .map(([, parts]) => parts.join(''))
      .join('\n')
    pages.push(text)
  }
  return pages.join('\n\n')
}

/**
 * 从 DOCX 文件提取纯文本
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

/**
 * 根据文件类型分发解析
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function parseFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return parsePdf(file)
  if (name.endsWith('.docx')) return parseDocx(file)
  if (name.endsWith('.txt')) return file.text()
  throw new Error('不支持的文件格式，请上传 PDF / DOCX / TXT')
}
