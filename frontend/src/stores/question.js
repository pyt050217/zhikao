import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchQuestions, generateQuestions, batchCreateQuestions } from '@/api'

export const useQuestionStore = defineStore('question', () => {
  // 题库从后端加载
  const questions = ref([])
  const loading = ref(false)

  const total = computed(() => questions.value.length)
  const llmCount = computed(() => questions.value.filter(q => q.source === 'llm').length)

  async function loadQuestions() {
    loading.value = true
    try {
      const { data } = await fetchQuestions()
      questions.value = data
    } finally {
      loading.value = false
    }
  }

  // 从后端题库按 type/difficulty 抽取 count 道
  async function generate({ type, difficulty, count }) {
    const { data } = await generateQuestions({ type, difficulty, count })
    return data
  }

  // 批量入库到后端
  async function saveToBank(items) {
    // 去掉前端临时字段
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
    // 入库后刷新本地列表
    await loadQuestions()
    return data.inserted ?? rows.length
  }

  function removeQuestion(id) {
    // 本地移除（后端删除接口后续补充）
    questions.value = questions.value.filter(q => q.id !== id)
  }

  return { questions, loading, total, llmCount, loadQuestions, generate, saveToBank, removeQuestion }
})
