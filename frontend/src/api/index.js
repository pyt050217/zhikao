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
    // ⚠️ 必须在拦截器里提前捕获 config.data（对象）。
    // axios 在拦截器之后会跑 transformRequest，把 config.data 序列化成 JSON 字符串；
    // 若 adapter 里直接用 config.data，解构出来的 type/difficulty/count 全是 undefined。
    const payload = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {})
    config.adapter = () => new Promise(resolve => {
      setTimeout(() => {
        const store = useQuestionStore()
        const items = store.generate(payload)
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
