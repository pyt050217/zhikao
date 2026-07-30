export const questions = [
  {
    id: 1, type: 'single', subject: '数学', difficulty: 'easy',
    stem: '1 + 1 = ?',
    options: ['1', '2', '3', '4'], answer: 1, source: 'llm'
  },
  {
    id: 2, type: 'multiple', subject: '语文', difficulty: 'medium',
    stem: '以下哪些是唐代诗人？（多选）',
    options: ['李白', '杜甫', '苏轼', '白居易'], answer: [0, 1, 3], source: 'manual'
  },
  {
    id: 3, type: 'judge', subject: '物理', difficulty: 'easy',
    stem: '光在真空中沿直线传播。',
    options: ['正确', '错误'], answer: 0, source: 'llm'
  },
  {
    id: 4, type: 'blank', subject: '英语', difficulty: 'medium',
    stem: 'The cat ___ on the mat.',
    answer: 'sits', source: 'llm'
  },
  {
    id: 5, type: 'essay', subject: '历史', difficulty: 'hard',
    stem: '简述秦始皇统一六国的历史意义。',
    answer: '', source: 'manual'
  }
]

export const exams = [
  {
    id: 1, title: '期中测验', subject: '数学',
    duration: 60, totalScore: 100,
    questionIds: [1, 2, 3],
    status: 'published',
    createdAt: '2026-07-28'
  },
  {
    id: 2, title: '期末综合', subject: '综合',
    duration: 120, totalScore: 150,
    questionIds: [1, 2, 3, 4, 5],
    status: 'draft',
    createdAt: '2026-07-29'
  }
]

export const results = [
  { examId: 1, studentName: '张三', score: 85, total: 100, submittedAt: '2026-07-28 14:30', answers: [{ qid: 1, userAnswer: 1, correct: true }, { qid: 2, userAnswer: [0, 1], correct: false }, { qid: 3, userAnswer: 0, correct: true }] },
  { examId: 1, studentName: '李四', score: 92, total: 100, submittedAt: '2026-07-28 15:10', answers: [{ qid: 1, userAnswer: 1, correct: true }, { qid: 2, userAnswer: [0, 1, 3], correct: true }, { qid: 3, userAnswer: 0, correct: true }] }
]
