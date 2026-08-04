<template>
  <div class="generate-page">
    <h2>🤖 LLM 出题</h2>
    <p class="hint">基于 exam-maker 智能体，从 LLM 生成的题库中按题型 / 难度智能抽题（题干支持 LaTeX 公式渲染）</p>

    <el-form :model="form" label-width="90px">
      <el-form-item label="题型">
        <el-select v-model="form.type">
          <el-option label="单选题" value="single" />
          <el-option label="多选题" value="multiple" />
          <el-option label="判断题" value="judge" />
          <el-option label="填空题" value="blank" />
          <el-option label="简答题" value="essay" />
        </el-select>
      </el-form-item>
      <el-form-item label="难度">
        <el-radio-group v-model="form.difficulty">
          <el-radio-button value="">不限</el-radio-button>
          <el-radio-button value="easy">简单</el-radio-button>
          <el-radio-button value="medium">中等</el-radio-button>
          <el-radio-button value="hard">困难</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="数量">
        <el-input-number v-model="form.count" :min="1" :max="10" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="generate" :loading="generating">
          {{ generating ? 'LLM 生成中…' : '生成题目' }}
        </el-button>
      </el-form-item>
    </el-form>

    <el-divider />

    <div v-if="generated.length">
      <h3>生成结果 ({{ generated.length }} 题)</h3>

      <div v-for="(q, idx) in generated" :key="q.id" class="generated-item">
        <p class="q-header">
          <el-tag size="small" :type="typeTag(q.type)">{{ typeLabel(q.type) }}</el-tag>
          <el-tag size="small" :type="diffTag(q.difficulty)">{{ diffLabel(q.difficulty) }}</el-tag>
          <span class="stem">{{ idx + 1 }}. <MathText :text="q.stem" /></span>
        </p>

        <!-- 选项：单选 / 多选 / 判断 -->
        <ul v-if="q.options && q.options.length" class="options">
          <li v-for="(opt, i) in q.options" :key="i" :class="{ correct: isCorrect(q, i) }">
            {{ String.fromCharCode(65 + i) }}. <MathText :text="opt" />
            <el-tag v-if="isCorrect(q, i)" size="small" type="success">正确答案</el-tag>
          </li>
        </ul>

        <!-- 填空 / 简答：直接显示答案 -->
        <p v-else class="answer-line">
          <el-tag type="success" size="small">参考答案</el-tag>
          <MathText :text="String(q.answer)" />
        </p>
      </div>

      <div class="actions">
        <el-button type="success" @click="saveAll" :disabled="!generated.length">全部存入题库</el-button>
        <el-button @click="generated = []">清空</el-button>
      </div>
    </div>

    <el-empty v-else description="点击「生成题目」开始 LLM 出题" />
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { generateQuestions } from '@/api'
import { useQuestionStore } from '@/stores/question'
import MathText from '@/components/MathText.vue'

const store = useQuestionStore()

const typeMap = { single: '单选', multiple: '多选', judge: '判断', blank: '填空', essay: '简答' }
const diffMap = { easy: '简单', medium: '中等', hard: '困难' }

const form = reactive({ type: 'single', difficulty: '', count: 3 })
const generating = ref(false)
const generated = ref([])

function typeLabel(t)  { return typeMap[t] || t }
function diffLabel(d)  { return diffMap[d] || d }
function typeTag(t)    { return t === 'essay' ? 'warning' : (t === 'judge' ? 'info' : '') }
function diffTag(d)    { return d === 'easy' ? 'success' : d === 'hard' ? 'danger' : 'warning' }

// 判断第 i 个选项是否为正确答案
function isCorrect(q, i) {
  if (Array.isArray(q.answer)) return q.answer.includes(i)
  return q.answer === i
}

async function generate() {
  generating.value = true
  try {
    const { data } = await generateQuestions({
      type: form.type,
      difficulty: form.difficulty,
      count: form.count
    })
    generated.value = data
    if (data.length < form.count) {
      ElMessage.warning(`题库中符合条件的题目仅有 ${data.length} 道（已去重）`)
    } else {
      ElMessage.success(`LLM 已生成 ${data.length} 道题目`)
    }
  } catch (e) {
    ElMessage.error('生成失败：' + e.message)
  } finally {
    generating.value = false
  }
}

function saveAll() {
  const added = store.saveToBank(generated.value)
  ElMessage.success(`已存入题库 ${added} 道新题目`)
  generated.value = []
}
</script>

<style scoped>
.generate-page { max-width: 800px; }
.hint { color: #909399; font-size: 13px; margin-top: -8px; }
.generated-item { padding: 14px; margin: 10px 0; background: #f5f7fa; border-radius: 6px; }
.q-header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.q-header .stem { margin-left: 4px; }
.options { list-style: none; padding: 8px 0 0 0; margin: 0; }
.options li { padding: 4px 8px; margin: 2px 0; border-radius: 4px; }
.options li.correct { background: #f0f9eb; color: #67c23a; font-weight: 500; }
.answer-line { padding: 6px 0; color: #67c23a; }
.actions { margin-top: 16px; display: flex; gap: 8px; }
</style>
