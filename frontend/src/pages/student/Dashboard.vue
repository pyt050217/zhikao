<template>
  <div class="dashboard">
    <h2>📋 我的考试</h2>
    <el-table :data="exams" stripe>
      <el-table-column prop="title" label="考试名称" />
      <el-table-column prop="subject" label="科目" width="100" />
      <el-table-column prop="duration" label="时长(分钟)" width="100" />
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="$router.push(`/student/exam/${row.id}`)">开始答题</el-button>
        </template>
      </el-table-column>
    </el-table>

    <h2>📊 历史记录</h2>
    <el-table :data="myResults" stripe>
      <el-table-column prop="score" label="得分" />
      <el-table-column prop="submittedAt" label="提交时间" />
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push(`/student/result/${row.examId}`)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { exams, results } from '@/mock/data'

const myResults = ref(results)
</script>
