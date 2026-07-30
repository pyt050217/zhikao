<template>
  <el-card class="auth-card">
    <h2>登录</h2>
    <el-form @submit.prevent="handleLogin">
      <el-form-item label="邮箱">
        <el-input v-model="form.email" placeholder="teacher@test.com" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" show-password />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading">登录</el-button>
        <el-button @click="$router.push('/auth/register')">去注册</el-button>
      </el-form-item>
    </el-form>
    <el-alert title="提示: teacher@xxx → 教师, 其他 → 学生" type="info" :closable="false" />
  </el-card>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const form = reactive({ email: '', password: '' })

async function handleLogin() {
  loading.value = true
  const user = auth.login(form)
  await new Promise(r => setTimeout(r, 300))
  loading.value = false
  router.push(user.role === 'teacher' ? '/teacher/generate' : '/student/dashboard')
}
</script>
