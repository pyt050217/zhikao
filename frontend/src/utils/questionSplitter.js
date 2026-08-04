/**
 * 把解析出的纯文本 mock 结构化为题目（模拟 LLM 结构化步骤）
 * 策略：按题号切分（支持 "1." "1、" "1）" "(1)" "一、" 等），
 * 切分后根据内容启发式推断题型与答案字段。
 *
 * 真实场景下这一步由 exam-maker LLM 完成，此处用正则做 mock 占位。
 */

const STEM_SPLIT_RE = /(?=(?:^|\n)\s*(?:\d+[.、)）]|[一二三四五六七八九十]+[、.])[\s\S])/

// 选项行：A. xxx  或  A、xxx
const OPTION_RE = /^\s*([A-H])[.、)）]\s*(.+)$/
// 判断题题干：简短陈述句（句号结尾、无问号、较短）
const JUDGE_STATEMENT_RE = /[。．]$/
// 主观题标志：含"请"或"简述/分析/论述/解释/说明/描述/回答/你认为"等动词 → 简答
const ESSAY_PROMPT_RE = /请|简述|分析|论述|解释|说明|描述|回答|你认为|谈谈|试述/
// 填空题：含 ____ 或 空格线
const BLANK_RE = /_{2,}|（\s*　?\s*）|\(\s*　?\s*\)/

/**
 * @param {string} rawText 解析后的纯文本
 * @returns {{ stem: string, type: string, options: string[]|null, answer: any }[]}
 */
export function splitTextIntoQuestions(rawText) {
  if (!rawText || !rawText.trim()) return []

  // 按题号切分为若干题块
  const blocks = rawText
    .split(STEM_SPLIT_RE)
    .map(s => s.trim())
    .filter(s => s.length > 2)

  if (blocks.length === 0) {
    // 兜底：把整个文本作为一道题
    return [makeQuestion(cleanBlock(rawText), 0)]
  }

  return blocks.map((block, i) => makeQuestion(block, i))
}

// 去掉题号前缀
function cleanBlock(block) {
  return block
    .replace(/^\s*\d+[.、)）]\s*/, '')
    .replace(/^\s*[一二三四五六七八九十]+[、.]\s*/, '')
    .replace(/^\s*[(（]\d+[)）]\s*/, '')
    .trim()
}

function makeQuestion(raw, index) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const firstLine = lines[0] || ''

  // 提取选项行（A. B. C. D. 开头的行）
  const optionLines = []
  const stemLines = []
  lines.forEach(line => {
    const m = line.match(OPTION_RE)
    if (m && optionLines.length < 8) {
      optionLines.push(m[2].trim())
    } else {
      stemLines.push(line)
    }
  })

  const stem = cleanBlock(stemLines.join(' ')) || firstLine

  // 启发式判题型
  let type = 'essay'
  let answer = ''
  let options = null

  if (optionLines.length >= 2) {
    // 有选项 → 单选 or 多选（无法区分时默认单选）
    type = 'single'
    options = optionLines
    answer = 0 // 默认正确答案为 A（mock）
  } else if (BLANK_RE.test(stem)) {
    type = 'blank'
    answer = '（待填）'
  } else if (
    stem.length < 25 &&
    !stem.includes('？') && !stem.includes('?') &&
    !ESSAY_PROMPT_RE.test(stem) &&     // 排除"请简述/分析/解释"等主观题
    JUDGE_STATEMENT_RE.test(stem)
  ) {
    // 简短陈述句 → 判断题（mock 默认正确答案为"正确"，待教师复核）
    type = 'judge'
    options = ['正确', '错误']
    answer = 0
  } else {
    type = 'essay'
    answer = ''
  }

  return {
    id: `import-${Date.now()}-${index}`,
    type,
    stem,
    options,
    answer,
    source: 'import',
    _importRaw: raw.slice(0, 200) // 保留原始文本供预览
  }
}
