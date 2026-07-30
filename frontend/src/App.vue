<template>
  <component :is="layout">
    <router-view />
  </component>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import TeacherLayout from '@/layouts/TeacherLayout.vue'
import StudentLayout from '@/layouts/StudentLayout.vue'

const route = useRoute()
const layout = computed(() => {
  if (route.meta.guest) return AuthLayout
  if (route.meta.role === 'teacher') return TeacherLayout
  if (route.meta.role === 'student') return StudentLayout
  return AuthLayout
})
</script>
