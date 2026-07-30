<template>
  <div class="generate-page">
    <h2>🤖 LLM 出题</h2>
    <el-form :model="form" label-width="80px">
      <el-form-item label="题型">
        <el-select v-model="form.type">
          <el-option label="单选题" value="single" />
          <el-option label="多选题" value="multiple" />
          <el-option label="判断题" value="judge" />
          <el-option label="填空题" value="blank" />
          <el-option label="简答题" value="essay" />
        </el-select>
      </el-form-item>
      <el-form-item label="科目">
        <el-input v-model="form.subject" placeholder="数学" />
      </el-form-item>
      <el-form-item label="知识点">
        <el-input v-model="form.topic" placeholder="一元二次方程" />
      </el-form-item>
      <el-form-item label="难度">
        <el-radio-group v-model="form.difficulty">
          <el-radio-button value="easy">简单</el-radio-button>
          <el-radio-button value="medium">中等</el-radio-button>
          <el-radio-button value="hard">困难</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="数量">
        <el-input-number v-model="form.count" :min="1" :max="10" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="generate" :loading="generating">生成题目</el-button>
      </el-form-item>
    </el-form>

    <el-divider />

    <div v-if="generated.length">
      <h3>生成结果 ({{ generated.length }} 题)</h3>
      <div v-for="q in generated" :key="q.id" class="generated-item">
        <p><el-tag>{{ q.type }}</el-tag> <strong>{{ q.stem }}</strong></p>
        <p v-if="q.options">选项: {{ q.options.join(' / ') }}</p>
        <p>答案: {{ q.answer }}</p>
      </div>
      <el-button type="success" @click="saveAll">全部存入题库</el-button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

const form = reactive({ type: 'single', subject: '', topic: '', difficulty: 'medium', count: 3 })
const generating = ref(false)
const generated = ref([])

async function generate() {
  generating.value = true
  await new Promise(r => setTimeout(r, 500))
  generated.value = Array.from({ length: form.count }, (_, i) => ({
    id: Date.now() + i,
    type: form.type,
    stem: `[Mock] ${form.subject || '通用'} - ${form.topic || '知识点'} 第${i + 1}题`,
    options: form.type !== 'essay' ? ['选项A', '选项B', '选项C', '选项D'] : null,
    answer: form.type === 'multiple' ? 'A,C' : 'A'
  }))
  generating.value = false
  ElMessage.success(`已生成 ${form.count} 道题目`)
}

function saveAll() {
  ElMessage.success('题目已存入题库 (mock)')
  generated.value = []
}
</script>
