<template>
  <div class="exam-answer">
    <el-affix>
      <div class="answer-header">
        <h2>{{ exam.title }}</h2>
        <el-tag type="warning">剩余时间: {{ remaining }}</el-tag>
        <el-progress :percentage="progress" class="progress" />
      </div>
    </el-affix>

    <div v-for="(q, i) in questions" :key="q.id" class="question-block">
      <h3>{{ i + 1 }}. <el-tag size="small">{{ q.type }}</el-tag> <MathText :text="q.stem" /></h3>
      <el-radio-group v-if="q.type === 'single'" v-model="answers[q.id]" class="option-group">
        <el-radio v-for="(opt, j) in q.options" :key="j" :value="j"><MathText :text="opt" /></el-radio>
      </el-radio-group>
      <el-checkbox-group v-else-if="q.type === 'multiple'" v-model="answers[q.id]" class="option-group">
        <el-checkbox v-for="(opt, j) in q.options" :key="j" :value="j"><MathText :text="opt" /></el-checkbox>
      </el-checkbox-group>
      <el-radio-group v-else-if="q.type === 'judge'" v-model="answers[q.id]" class="option-group">
        <el-radio :value="0">正确</el-radio>
        <el-radio :value="1">错误</el-radio>
      </el-radio-group>
      <el-input v-else v-model="answers[q.id]" :type="q.type === 'essay' ? 'textarea' : 'text'" :rows="3" />
    </div>

    <el-button type="primary" size="large" @click="submit" class="submit-btn">交卷</el-button>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { exams, questions as allQuestions } from '@/mock/data'
import MathText from '@/components/MathText.vue'

const route = useRoute()
const exam = exams.find(e => e.id === Number(route.params.id)) || exams[0]
const questions = allQuestions.filter(q => exam.questionIds.includes(q.id))
const answers = reactive({})
const remaining = ref(`${exam.duration}:00`)

const progress = computed(() => {
  const answered = Object.keys(answers).filter(k => answers[k] !== '' && answers[k] !== undefined).length
  return Math.round((answered / questions.length) * 100)
})

async function submit() {
  await ElMessageBox.confirm('确认交卷？', '提示', { type: 'warning' })
}
</script>

<style scoped>
.exam-answer {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px;
}
.answer-header {
  background: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.answer-header h2 {
  margin: 0 0 8px;
}
.progress {
  margin-top: 8px;
}
.question-block {
  background: #fff;
  margin: 16px 0;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.submit-btn {
  display: block;
  width: 100%;
  margin-top: 24px;
}
</style>
