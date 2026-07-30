import axios from 'axios'
import { questions, exams, results } from '@/mock/data'

const api = axios.create({ baseURL: '/api' })

// mock 拦截器: 延迟 300ms 返回数据
api.interceptors.request.use(async (config) => {
  await new Promise(r => setTimeout(r, 300))
  const url = config.url || ''

  if (url === '/questions')            config.adapter = () => Promise.resolve({ data: questions })
  else if (url === '/exams')           config.adapter = () => Promise.resolve({ data: exams })
  else if (url.startsWith('/results')) config.adapter = () => Promise.resolve({ data: results })

  return config
})

export function fetchQuestions()      { return api.get('/questions') }
export function fetchExams()          { return api.get('/exams') }
export function fetchResults(examId)  { return api.get(`/results/${examId}`) }
