import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchQuestions, batchCreateQuestions, generateQuestions } from '@/api'
import questionBank from '@/mock/question-bank.json'

export const useQuestionStore = defineStore('question', () => {
  const questions = ref([])
  const loading = ref(false)

  const total = computed(() => questions.value.length)

  async function loadQuestions() {
    loading.value = true
    try {
      const { data } = await fetchQuestions()
      questions.value = data || []
    } finally {
      loading.value = false
    }
  }

  // 从 question-bank.json 本地按 subject/type/difficulty 抽取
  function generateLocal({ subject, type, difficulty, count }) {
    let pool = questionBank.questions.filter(q => q.type === type)
    // 按学科筛选（如果有 subject 字段）
    if (subject) pool = pool.filter(q => q.subject === subject)
    if (difficulty) pool = pool.filter(q => q.difficulty === difficulty)
    const existing = new Set(questions.value.map(q => q.stem))
    pool = pool.filter(q => !existing.has(q.stem))
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count).map(q => ({
      ...q,
      id: `llm-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      _generated: true,
    }))
  }

  async function generate(payload) {
    // 有学科参数时调 LLM 边缘函数；否则回退本地题库
    if (payload.subject) {
      try {
        const { data } = await generateQuestions(payload)
        if (data.questions?.length) return data.questions
      } catch (e) {
        console.warn('LLM 生成失败:', e.message)
        throw e  // LLM 失败时抛出错误，让前端显示提示，不再回退本地题库
      }
    }
    return generateLocal(payload)
  }

  async function saveToBank(items) {
    const rows = items.map(q => ({
      id: q.id,
      subject: q.subject || '',
      topic: q.topic || '',
      type: q.type,
      difficulty: q.difficulty || 'medium',
      stem: q.stem,
      options: q.options || null,
      answer: q.answer ?? 0,
      source: q.source || 'import',
    }))
    const { data } = await batchCreateQuestions(rows)
    questions.value = JSON.parse(localStorage.getItem('savedQuestions') || '[]')
    return data.inserted ?? rows.length
  }

  function removeQuestion(id) {
    const all = JSON.parse(localStorage.getItem('savedQuestions') || '[]')
    const filtered = all.filter(q => q.id !== id)
    localStorage.setItem('savedQuestions', JSON.stringify(filtered))
    questions.value = filtered
  }

  return { questions, loading, total, loadQuestions, generate, saveToBank, removeQuestion }
})
