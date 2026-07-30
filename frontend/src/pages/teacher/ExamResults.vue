<template>
  <div class="exam-results">
    <h2>📊 成绩汇总</h2>
    <el-row :gutter="20" class="stats">
      <el-col :span="6"><el-statistic title="平均分" :value="avgScore" /></el-col>
      <el-col :span="6"><el-statistic title="最高分" :value="maxScore" /></el-col>
      <el-col :span="6"><el-statistic title="最低分" :value="minScore" /></el-col>
      <el-col :span="6"><el-statistic title="提交人数" :value="results.length" /></el-col>
    </el-row>

    <el-table :data="results" stripe class="table">
      <el-table-column prop="studentName" label="学生" />
      <el-table-column prop="score" label="得分" sortable />
      <el-table-column prop="submittedAt" label="提交时间" />
    </el-table>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { results as mockResults } from '@/mock/data'

const results = ref(mockResults)
const avgScore = computed(() => (results.value.reduce((s, r) => s + r.score, 0) / results.value.length).toFixed(1))
const maxScore = computed(() => Math.max(...results.value.map(r => r.score)))
const minScore = computed(() => Math.min(...results.value.map(r => r.score)))
</script>
