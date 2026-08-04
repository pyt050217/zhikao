import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// 真实后端 API（/mock 拦截器已移除，由 FastAPI 后端提供服务）
export function fetchQuestions()      { return api.get('/questions') }
export function fetchExams()          { return api.get('/exams') }
export function fetchResults(examId)  { return api.get(`/results/${examId}`) }
export function generateQuestions(payload) { return api.post('/generate', payload) }

// 导入文档（PDF/DOCX/TXT → 结构化题目）
export function importDocument(formData) {
  return api.post('/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// 批量入库
export function batchCreateQuestions(questions) {
  return api.post('/questions/batch', { questions })
}
