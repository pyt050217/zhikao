import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { questions as seedQuestions } from '@/mock/data'
import questionBank from '@/mock/question-bank.json'

export const useQuestionStore = defineStore('question', () => {
  // 题库 = 种子数据 + LLM 生成后存入的数据（去重按 id）
  const questions = ref([...seedQuestions, ...loadSaved()])

  const total = computed(() => questions.value.length)
  const llmCount = computed(() => questions.value.filter(q => q.source === 'llm').length)

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem('savedQuestions') || '[]')
    } catch {
      return []
    }
  }

  function persistSaved() {
    const saved = questions.value.filter(q => q._saved)
    localStorage.setItem('savedQuestions', JSON.stringify(saved))
  }

  // 从 LLM 题库中按 type / subject / difficulty 抽取 count 道
  function generate({ type, subject, difficulty, count }) {
    let pool = questionBank.questions.filter(q => q.type === type)
    if (subject) pool = pool.filter(q => q.subject === subject)
    if (difficulty) pool = pool.filter(q => q.difficulty === difficulty)

    // 过滤掉已存在于题库中的（按 stem 去重）
    const existingStems = new Set(questions.value.map(q => q.stem))
    pool = pool.filter(q => !existingStems.has(q.stem))

    // 随机抽取
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, count)

    // 深拷贝并加上运行时 id
    return picked.map((q, i) => ({
      ...q,
      id: `llm-${Date.now()}-${i}`,
      _generated: true
    }))
  }

  function saveToBank(items) {
    const existingStems = new Set(questions.value.map(q => q.stem))
    let added = 0
    items.forEach(q => {
      if (!existingStems.has(q.stem)) {
        questions.value.push({ ...q, _saved: true, _generated: false })
        existingStems.add(q.stem)
        added++
      }
    })
    persistSaved()
    return added
  }

  function removeQuestion(id) {
    questions.value = questions.value.filter(q => q.id !== id)
    persistSaved()
  }

  return { questions, total, llmCount, generate, saveToBank, removeQuestion }
})
