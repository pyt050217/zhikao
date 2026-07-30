<template>
  <div class="question-list">
    <h2>题库</h2>
    <el-row :gutter="16" class="toolbar">
      <el-col :span="6"><el-input v-model="keyword" placeholder="搜索题目" clearable /></el-col>
      <el-col :span="4">
        <el-select v-model="typeFilter" placeholder="题型筛选" clearable>
          <el-option label="单选题" value="single" />
          <el-option label="多选题" value="multiple" />
          <el-option label="判断题" value="judge" />
          <el-option label="填空题" value="blank" />
          <el-option label="简答题" value="essay" />
        </el-select>
      </el-col>
      <el-col :span="4"><el-button type="primary" @click="$router.push('/teacher/questions/create')">手动建题</el-button></el-col>
    </el-row>

    <el-table :data="filtered" stripe class="table">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="type" label="题型" width="80">
        <template #default="{ row }">
          <el-tag size="small">{{ { single: '单选', multiple: '多选', judge: '判断', blank: '填空', essay: '简答' }[row.type] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="stem" label="题干" show-overflow-tooltip />
      <el-table-column prop="difficulty" label="难度" width="80" />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push(`/teacher/questions/${row.id}/edit`)">编辑</el-button>
          <el-button size="small" type="danger" @click="del(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { questions as mockData } from '@/mock/data'

const keyword = ref('')
const typeFilter = ref('')
const questions = ref(mockData)

const filtered = computed(() => questions.value.filter(q =>
  (!keyword.value || q.stem.includes(keyword.value)) &&
  (!typeFilter.value || q.type === typeFilter.value)
))

function del(id) {
  questions.value = questions.value.filter(q => q.id !== id)
}
</script>
