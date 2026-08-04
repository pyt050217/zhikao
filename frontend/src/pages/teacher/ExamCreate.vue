<template>
  <div class="exam-create">
    <h2>📝 组卷</h2>
    <el-form :model="form" label-width="100px" class="exam-form">
      <el-form-item label="试卷名称">
        <el-input v-model="form.title" />
      </el-form-item>
      <el-form-item label="考试时长(分钟)">
        <el-input-number v-model="form.duration" :min="1" :max="300" />
      </el-form-item>
    </el-form>

    <el-row :gutter="20">
      <el-col :span="12">
        <h3>题库</h3>
        <el-checkbox-group v-model="selectedIds">
          <div v-for="q in questions" :key="q.id" class="question-card">
            <el-checkbox :value="q.id">{{ q.stem }}</el-checkbox>
            <el-tag size="small">{{ q.type }}</el-tag>
          </div>
        </el-checkbox-group>
      </el-col>
      <el-col :span="12">
        <h3>已选题目 ({{ selectedIds.length }})</h3>
        <div v-for="id in selectedIds" :key="id" class="selected-item">
          {{ questions.find(q => q.id === id)?.stem }}
        </div>
      </el-col>
    </el-row>

    <el-button type="primary" class="submit-btn" @click="createExam">创建试卷</el-button>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { questions as mockQuestions } from '@/mock/data'

const questions = ref(mockQuestions)
const selectedIds = ref([])
const form = reactive({ title: '', duration: 60 })

function createExam() {
  ElMessage.success(`试卷 "${form.title}" 创建成功 (mock)`)
}
</script>
