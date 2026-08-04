import axios from 'axios'
import { questions, exams, results } from '@/mock/data'
import { useQuestionStore } from '@/stores/question'

const api = axios.create({ baseURL: '/api' })

// mock 拦截器: 延迟 300ms 返回数据
api.interceptors.request.use(async (config) => {
  await new Promise(r => setTimeout(r, 300))
  const url = config.url || ''

  if (url === '/questions') {
    config.adapter = () => {
      const store = useQuestionStore()
      return Promise.resolve({ data: store.questions })
    }
  } else if (url === '/exams') {
    config.adapter = () => Promise.resolve({ data: exams })
  } else if (url.startsWith('/results')) {
    config.adapter = () => Promise.resolve({ data: results })
  } else if (url === '/generate' && config.method === 'post') {
    // LLM 出题：模拟 800ms 生成延迟，从题库抽取
    config.adapter = () => new Promise(resolve => {
      setTimeout(() => {
        const store = useQuestionStore()
        const items = store.generate(config.data || {})
        resolve({ data: items })
      }, 800)
    })
  }

  return config
})

export function fetchQuestions()      { return api.get('/questions') }
export function fetchExams()          { return api.get('/exams') }
export function fetchResults(examId)  { return api.get(`/results/${examId}`) }
export function generateQuestions(payload) { return api.post('/generate', payload) }
