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

  // 从 question-bank.json 本地按 type/difficulty 抽取（无需后端）
  // 若部署了 Vercel 边缘函数 /generate，可改为调后端
  function generateLocal({ type, difficulty, count }) {
    let pool = questionBank.questions.filter(q => q.type === type)
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
    // 优先调边缘函数；失败则回退到本地题库
    try {
      const { data } = await generateQuestions(payload)
      if (data.questions?.length) return data.questions
    } catch (e) {
      console.warn('generate 边缘函数失败，回退本地题库:', e.message)
    }
    return generateLocal(payload)
  }

  async function saveToBank(items) {
    const rows = items.map(q => ({
      id: q.id,
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
