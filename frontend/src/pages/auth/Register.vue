<template>
  <el-card class="auth-card">
    <h2>注册</h2>
    <el-form @submit.prevent="handleRegister">
      <el-form-item label="邮箱">
        <el-input v-model="form.email" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" show-password />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit">注册</el-button>
        <el-button @click="$router.push('/auth/login')">返回登录</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>
<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
const router = useRouter()
const auth = useAuthStore()
const form = reactive({ email: '', password: '' })
function handleRegister() {
  auth.register(form)
  router.push('/auth/login')
}
</script>
