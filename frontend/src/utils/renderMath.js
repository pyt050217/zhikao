import katex from 'katex'
import 'katex/dist/katex.min.css'

/**
 * 渲染含 LaTeX 数学公式的文本。
 * 支持行内 $...$ / \(...\) 与行间 $$...$$ / \[...\]。
 * 公式片段用 KaTeX 渲染，其余文本做 HTML 转义，解析失败时降级为纯文本。
 *
 * @param {string} text
 * @returns {string} HTML 字符串（调用方用 v-html 渲染）
 */
export function renderMath(text) {
  if (!text) return ''
  // 无任何公式标记 → 纯文本转义返回
  if (!/[\$\\]/.test(text)) return escapeHtml(text)

  try {
    return renderSegments(normalizeMathDelimiters(text))
  } catch {
    return escapeHtml(text)
  }
}

/**
 * 预处理：把包含换行的 $...$ 转为 $$...$$（显示模式），
 * 避免多行矩阵在行内模式下布局错乱。
 */
function normalizeMathDelimiters(text) {
  // 匹配 $...$（非 $$），若内容含换行则替换为 $$...$$
  return text.replace(/\$([\s\S]+?)\$(?!\$)/g, (match, content) => {
    if (/\n/.test(content)) return `$$${content}$$`
    return match
  })
}

// 将文本切分为 [公式, 文本, 公式, ...] 片段，交替类型
function renderSegments(text) {
  // 匹配顺序：$$...$$  \[...\]  $...$  \(...\)
  const RE = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\$([^\$\n]+?)\$(?!\$)|\\\(([\s\S]*?)\\\)/g
  let lastIndex = 0
  const parts = []
  let match

  while ((match = RE.exec(text)) !== null) {
    // 公式前的普通文本
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)))
    }
    const math = match[1] ?? match[2] ?? match[3] ?? match[4]
    const displayMode = !!match[1] || !!match[2]
    try {
      parts.push(
        katex.renderToString(math.trim(), { displayMode, throwOnError: false })
      )
    } catch {
      parts.push(`<code class="math-error">${escapeHtml(match[0])}</code>`)
    }
    lastIndex = match.index + match[0].length
  }
  // 末尾普通文本
  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.slice(lastIndex)))
  }
  return parts.join('')
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
