/**
 * 把解析出的纯文本 mock 结构化为题目（模拟 LLM 结构化步骤）
 * 策略：按题号切分（支持 "1." "1、" "1）" "(1)" "一、" 等），
 * 切分后过滤掉考试声明/密封线/分数表等非题目块，再启发式推断题型。
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

// ===== 噪声过滤：以下模式的块视为非题目，直接丢弃 =====

// 行首即命中：考试声明、密封线、学生信息栏、分数表、注意事项、时间/满分声明等
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

// 纯装饰线或页码行（含 "第1页/共4页"、"第 1 页  共 4 页"、"- 3 -" 等混合格式）
const DECORATION_RE = /^[—\-_=~＊*＊\s]{3,}$|^\s*第\s*\d+\s*页(?:\s*[/\\]?\s*共\s*\d+\s*页)?\s*$|^\s*-\s*\d+\s*-\s*$|^\s*\d+\s*\/\s*\d+\s*$/

/**
 * @param {string} rawText 解析后的纯文本
 * @returns {{ stem: string, type: string, options: string[]|null, answer: any }[]}
 */
export function splitTextIntoQuestions(rawText) {
  if (!rawText || !rawText.trim()) return []

  // 预处理：去掉整行的装饰线 与 噪声行（得分/评卷/姓名等）
  rawText = rawText
    .split('\n')
    .filter(l => {
      const t = l.trim()
      return !DECORATION_RE.test(t) && !NOISE_LINE_START_RE.test(t)
    })
    .join('\n')

  // 按题号切分为若干题块
  let blocks = rawText
    .split(STEM_SPLIT_RE)
    .map(s => s.trim())
    .filter(s => s.length > 2)

  // 过滤噪声块
  blocks = blocks.filter(block => !isNoise(block))

  if (blocks.length === 0) {
    // 兜底：把整个文本作为一道题（仅在非噪声时）
    const cleaned = cleanBlock(rawText.replace(/\n/g, ' '))
    return cleaned && !isNoise(cleaned) ? [makeQuestion(rawText, 0)] : []
  }

  return blocks.map((block, i) => makeQuestion(block, i))
}

// 判断一个题块是否为噪声（非题目）
function isNoise(block) {
  if (!block) return true
  const firstLine = block.split('\n')[0].trim()

  // 1. 行首命中噪声关键词（注意事项/密封线/姓名/分数表等）
  if (NOISE_LINE_START_RE.test(firstLine)) return true

  // 2. 章节大题标题（"一、单选题（每小题3分）"）
  if (SECTION_HEADER_RE.test(block)) return true

  // 3. 整块含明显噪声内容
  if (NOISE_CONTENT_RE.test(block)) return true

  // 4. 考试标题（学年期中期末等）
  if (EXAM_TITLE_RE.test(firstLine)) return true

  // 5. 过短且不含选项 → 噪声
  if (block.length < 4) return true

  // 6. 纯分数/表格行（大量数字+顿号/空格，无中文语义）
  if (/^[\d\s.、,，]+$/.test(block)) return true

  // 7. 仅含单个字母的碎片
  if (/^\s*[A-H]\s*$/.test(block)) return true

  return false
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
