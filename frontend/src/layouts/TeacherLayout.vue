<template>
  <el-container class="teacher-layout">
    <el-aside width="200px">
      <el-menu :default-active="route.path" router>
        <el-menu-item index="/teacher/generate">🤖 LLM 出题</el-menu-item>
        <el-menu-item index="/teacher/questions">📚 题库</el-menu-item>
        <el-menu-item index="/teacher/exams">📝 试卷</el-menu-item>
      </el-menu>
    </el-aside>
    <el-main><router-view /></el-main>
  </el-container>
</template>

<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
</script>
