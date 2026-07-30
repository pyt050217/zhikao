<template>
  <el-container class="student-layout">
    <el-header>
      <el-menu mode="horizontal" :default-active="route.path" router>
        <el-menu-item index="/student/dashboard">📋 我的考试</el-menu-item>
      </el-menu>
    </el-header>
    <el-main><router-view /></el-main>
  </el-container>
</template>

<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
</script>
