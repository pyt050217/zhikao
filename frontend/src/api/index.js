import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// ── 题库（localStorage 持久化，静态站点无需后端数据库）──
export function fetchQuestions() {
  try {
    return Promise.resolve({ data: JSON.parse(localStorage.getItem('savedQuestions') || '[]') })
  } catch {
    return Promise.resolve({ data: [] })
  }
}

export async function batchCreateQuestions(questions) {
  try {
    const existing = JSON.parse(localStorage.getItem('savedQuestions') || '[]')
    const stems = new Set(existing.map(q => q.stem))
    let added = 0
    questions.forEach(q => {
      if (!stems.has(q.stem)) {
        existing.push({ ...q, _saved: true })
        stems.add(q.stem)
        added++
      }
    })
    localStorage.setItem('savedQuestions', JSON.stringify(existing))
    return { data: { inserted: added } }
  } catch (e) {
    console.error('[batchCreateQuestions] 失败:', e)
    throw e
  }
}

// ── 考试 / 成绩（静态数据）──
import { exams, results } from '@/mock/data'
export function fetchExams() { return Promise.resolve({ data: exams }) }
export function fetchResults(examId) {
  return Promise.resolve({ data: results.filter(r => r.examId === examId) })
}

// ── 出题：调 Vercel 边缘函数（从 question-bank.json 抽取）──
export function generateQuestions(payload) { return api.post('/generate', payload) }

// ── 公式 OCR：调 Vercel 边缘函数（Claude 视觉，API key 藏在服务端）──
export function ocrFormulas(formulas) {
  return api.post('/ocr', { formulas })
}

// ── 公式 OCR（Pix2tex 本地推理，优先使用）──
export function ocrFormulasPix2tex(formulas) {
  return api.post('/ocr_pix2tex', { formulas })
}
