<template>
  <div class="exam-list">
    <h2>📝 试卷</h2>
    <el-button type="primary" @click="$router.push('/teacher/exams/create')">组卷</el-button>
    <el-table :data="exams" stripe class="table">
      <el-table-column prop="title" label="名称" />
      <el-table-column prop="subject" label="科目" width="100" />
      <el-table-column prop="duration" label="时长(分钟)" width="100" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'published' ? 'success' : 'info'">{{ row.status === 'published' ? '已发布' : '草稿' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push(`/teacher/exams/${row.id}`)">详情</el-button>
          <el-button size="small" @click="$router.push(`/teacher/exams/${row.id}/results`)">成绩</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { exams as mockExams } from '@/mock/data'

const exams = ref(mockExams)
</script>
