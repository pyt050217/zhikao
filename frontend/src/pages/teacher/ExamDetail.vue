<template>
  <div class="exam-detail">
    <h2>{{ exam.title }}</h2>
    <el-descriptions :column="2" border>
      <el-descriptions-item label="科目">{{ exam.subject }}</el-descriptions-item>
      <el-descriptions-item label="时长">{{ exam.duration }} 分钟</el-descriptions-item>
      <el-descriptions-item label="总分">{{ exam.totalScore }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="exam.status === 'published' ? 'success' : 'info'">{{ exam.status === 'published' ? '已发布' : '草稿' }}</el-tag>
      </el-descriptions-item>
    </el-descriptions>

    <h3>题目列表</h3>
    <div v-for="q in examQuestions" :key="q.id" class="question-item">
      <p><el-tag size="small">{{ q.type }}</el-tag> {{ q.stem }}</p>
    </div>

    <h3>作答学生</h3>
    <el-table :data="examResults" stripe>
      <el-table-column prop="studentName" label="姓名" />
      <el-table-column prop="score" label="得分" />
      <el-table-column prop="submittedAt" label="提交时间" />
    </el-table>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { exams, questions, results } from '@/mock/data'

const route = useRoute()
const exam = ref(exams.find(e => e.id === Number(route.params.id)) || exams[0])
const examQuestions = questions.filter(q => exam.value.questionIds.includes(q.id))
const examResults = results.filter(r => r.examId === exam.value.id)
</script>
