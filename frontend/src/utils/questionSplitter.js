/**
 * 把解析出的纯文本结构化为题目。
 *
 * 策略（多策略级联）：
 *   1. 预处理：归一化换行，把"1.xxx 2.xxx"这种无换行的文本拆开
 *   2. 按题号切分（支持 1. 1、 1） （1） (1) ①②③ 一、 等多种格式）
 *   3. 过滤噪声块，启发式推断题型
 *   4. 回退：若行首切分失败，尝试按选项组（A.B.C.D.）识别选择题
 */

// ── 正式切分用：行首题号 ──────────────────────────────────────────
const STEM_SPLIT_RE = /(?=(?:^|\n)\s*(?:\d{1,3}[.、)）]|[（(]\d{1,3}[)）]|[①②③④⑤⑥⑦⑧⑨⑩]|[一二三四五六七八九十]+[、.])[\s\S])/

// ── 选项行：A. xxx  或  A、xxx  或  A）xxx  ──────────────────────
const OPTION_RE = /^\s*([A-H])[.、)）]\s*(.+)$/

// ── 判断题题干：简短陈述句（句号结尾、无问号、较短）──────────────
const JUDGE_STATEMENT_RE = /[。．]$/

// ── 主观题标志 ──────────────────────────────────────────────────
const ESSAY_PROMPT_RE = /请|简述|分析|论述|解释|说明|描述|回答|你认为|谈谈|试述/

// ── 填空题：含 ____ 或 空格线 ────────────────────────────────────
const BLANK_RE = /_{2,}|（\s*　?\s*）|\(\s*　?\s*\)/

// ── 噪声过滤：以下模式的块视为非题目，直接丢弃 ──────────────────

// 行首即命中：考试声明、密封线、学生信息栏、分数表、注意事项等
const NOISE_LINE_START_RE = new RegExp(
  '^(?:' +
    '注意事项|考试说明|答卷说明|考前须知|说明：|说明:' +
    '|密封线|密[　 ]*封[　 ]*线' +
    '|姓名|班级|学号|考号|座号|准考证' +
    '|得分|评卷人|阅卷人|核分人|总分|满分' +
    '|考试时间|考试时限|时长|分钟|命题人|审核人' +
    '|同学们|提示你|请你|务必|认真|仔细|书写|黑色|签字笔' +
    '|答卷前|交卷|考试结束|信号发出' +
    ')\\s*[：:]?',
  'i'
)

// 章节/大题标题行（每小题x分、共x题、每题x分）→ 不是题目
const SECTION_HEADER_RE = /(?:每小题|每题|共|小题|总分|满分).{0,4}(?:分|题)|^(?:一|二|三|四|五|六|七|八|九|十)[、.]\s*(?:选择|填空|判断|解答|简答|计算|论述|作文|阅读|写作)/i

// 整块含明显噪声关键词（注意事项子项、考试标题等）
const NOISE_CONTENT_RE = /(答卷前|密封线|姓名[:：]|班级[:：]|学号[:：]|考号[:：]|命题人|审核人|学年|学期|试卷\s*[AB]卷|考试\s*时间|满分\s*\d+|共\s*\d+\s*页|第\s*\d+\s*页)/i

// 考试标题行（以学年/学期/年级开头，很短）
const EXAM_TITLE_RE = /^\s*\d{4}[-/年]\d{1,2}.{0,30}(?:期末|期中|月考|模拟|统考|真题)|^(?:初三|高三|初二|高二|九年级|高[一二三]).{0,20}(?:期末|期中)/i

// 纯装饰线或页码行
const DECORATION_RE = /^[—\-_=~＊*＊\s]{3,}$|^\s*第\s*\d+\s*页(?:\s*[/\\]?\s*共\s*\d+\s*页)?\s*$|^\s*-\s*\d+\s*-\s*$|^\s*\d+\s*\/\s*\d+\s*$/

/**
 * 预处理：归一化文本，修复 PDF 提取缺失换行的问题。
 *
 * 典型问题："1. xxx 2. xxx 3. xxx" 被提取为一行，
 * 导致按行首题号切分失败。本函数在题号前插入换行。
 *
 * 关键设计：
 *   - 对于 "1." "1、" 等数字题号：要求前导字符是空白/行首/标点，
 *     避免把公式里的 "2)" "(x-2)" "x=1)" 误判。
 *   - 对于 "（1）" "①" "一、" 等格式：无条件识别（公式里不会出现
 *     全角括号或圈数字作为题号），处理"选择题（1）xxx"这种常见格式。
 */
function preprocessText(rawText) {
  if (!rawText) return ''

  // 统一全角空白
  const normalized = rawText.replace(/　/g, ' ')

  // 策略 1：带括号的题号 / 圈数字 / 中文数字 → 无条件识别（公式里不会出现）
  // 注意：这些格式后不一定有空格（如"（1）下列""①下列""一、选择"），所以不要求 \s
  let text = normalized.replace(
    /(?=[（(]\d{1,3}[)）]|[①②③④⑤⑥⑦⑧⑨⑩]|[一二三四五六七八九十]+[、.])/g,
    '\n'
  )

  // 策略 2：纯数字题号（1. 1、 1）））→ 要求前导字符是合法分隔符
  const lines = text.split('\n')
  const processedLines = lines.map(line =>
    line.replace(
      /(?:^|([\s.。:：)）\]】]))(?=(?:\d{1,3}[.、)）])\s)/g,
      (match, char) => (char ? char : '') + '\n'
    )
  )

  return processedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * @param {string} rawText 解析后的纯文本
 * @returns {{ stem: string, type: string, options: string[]|null, answer: any }[]}
 */
export function splitTextIntoQuestions(rawText) {
  if (!rawText || !rawText.trim()) return []

  // ── 预处理：归一化换行 ──
  const processed = preprocessText(rawText)

  // 预处理：去掉整行的装饰线与噪声行
  const cleaned = processed
    .split('\n')
    .filter(l => {
      const t = l.trim()
      return !DECORATION_RE.test(t) && !NOISE_LINE_START_RE.test(t)
    })
    .join('\n')

  // ── 策略 1：按行首题号切分 ──
  let blocks = splitByQuestionNumber(cleaned)

  // ── 策略 2（回退）：若题数过少，尝试按选项组识别选择题 ──
  if (blocks.length < 2) {
    const fallback = splitByOptionGroups(cleaned)
    if (fallback.length > blocks.length) {
      blocks = fallback
    }
  }

  if (blocks.length === 0) {
    return []
  }

  return blocks.map((block, i) => makeQuestion(block, i))
}

/**
 * 按行首题号切分文本为若干题块。
 */
function splitByQuestionNumber(text) {
  return text
    .split(STEM_SPLIT_RE)
    .map(s => s.trim())
    .filter(s => s.length > 2)
    .filter(block => !isNoise(block))
}

/**
 * 回退策略：按选项组（连续 A.B.C.D. 行）识别选择题。
 *
 * 当题号切分失败时，尝试找"2+ 连续选项行"作为题目边界，
 * 选项之前的非选项行视为题干。
 */
function splitByOptionGroups(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const blocks = []
  let currentStem = []
  let currentOptions = []

  const flush = () => {
    if (currentOptions.length >= 2 && currentStem.length > 0) {
      const stem = cleanBlock(currentStem.join(' '))
      if (stem && stem.length > 2 && !isNoise(stem)) {
        blocks.push(stem + '\n' + currentOptions.map((o, i) =>
          `${String.fromCharCode(65 + i)}. ${o}`
        ).join('\n'))
      }
    } else if (currentStem.length > 0) {
      // 没有选项但有题干，作为非选择题
      const stem = cleanBlock(currentStem.join(' '))
      if (stem && stem.length > 2 && !isNoise(stem)) {
        blocks.push(stem)
      }
    }
    currentStem = []
    currentOptions = []
  }

  for (const line of lines) {
    const m = line.match(OPTION_RE)
    if (m) {
      currentOptions.push(m[2].trim())
    } else {
      // 非选项行 → 如果已有选项，先 flush
      if (currentOptions.length >= 2) {
        flush()
      } else if (currentOptions.length > 0 && currentStem.length > 0) {
        // 选项太少，合并到题干
        currentStem.push(...currentOptions.map((o, i) =>
          `${String.fromCharCode(65 + i)}. ${o}`
        ))
        currentOptions = []
      }
      currentStem.push(line)
    }
  }
  flush()

  return blocks
}

// 判断一个题块是否为噪声（非题目）
function isNoise(block) {
  if (!block) return true
  const firstLine = block.split('\n')[0].trim()

  // 1. 行首命中噪声关键词
  if (NOISE_LINE_START_RE.test(firstLine)) return true

  // 2. 章节大题标题
  if (SECTION_HEADER_RE.test(block)) return true

  // 3. 整块含明显噪声内容
  if (NOISE_CONTENT_RE.test(block)) return true

  // 4. 考试标题
  if (EXAM_TITLE_RE.test(firstLine)) return true

  // 5. 过短且不含选项
  if (block.length < 4) return true

  // 6. 纯分数/表格行
  if (/^[\d\s.、,，]+$/.test(block)) return true

  // 7. 仅含单个字母的碎片
  if (/^\s*[A-H]\s*$/.test(block)) return true

  return false
}

// 去掉题号前缀
function cleanBlock(block) {
  return block
    .replace(/^\s*\d{1,3}[.、)）]\s*/, '')
    .replace(/^\s*[（(]\d{1,3}[)）]\s*/, '')
    .replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
    .replace(/^\s*[一二三四五六七八九十]+[、.]\s*/, '')
    .replace(/^\s*[(（]\d+[)）]\s*/, '')
    .trim()
}

function makeQuestion(raw, index) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const firstLine = lines[0] || ''

  // 提取选项行
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
    type = 'single'
    options = optionLines
    answer = 0
  } else if (BLANK_RE.test(stem)) {
    type = 'blank'
    answer = '（待填）'
  } else if (
    stem.length < 25 &&
    !stem.includes('？') && !stem.includes('?') &&
    !ESSAY_PROMPT_RE.test(stem) &&
    JUDGE_STATEMENT_RE.test(stem)
  ) {
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
    _importRaw: raw.slice(0, 200)
  }
}

/**
 * 把 OCR 返回的 LaTeX 回填到题目的 __FORMULA_i__ 占位符。
 */
export function applyFormulas(stem, latexList) {
  if (!stem) return stem
  let result = stem
  latexList.forEach((latex, i) => {
    result = result.replace(`__FORMULA_${i}__`, latex || '')
  })
  return result
}
