# Exam Maker 前端实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 exam-maker 前端静态页面，覆盖 LLM 出题 → 题库 → 组卷 → 作答 → 判分主链路，使用 mock 数据，不依赖后端。

**Architecture:** Vue 3 SPA，按功能模块拆分目录，Pinia 管理状态，Element Plus 提供 UI 组件，axios 拦截器模拟 API 响应。

**Tech Stack:** Vue 3 (Composition API + `<script setup>`), Vite, Pinia, Vue Router 4, Element Plus, Axios

## Global Constraints

- 每个任务改动 < 30 行
- 所有数据来自 mock，不连后端
- 每个任务必须写明验证方法
- 每个任务完成后独立 commit

---

### Task 1: 脚手架 — 创建 Vite + Vue 3 项目

**Files:**
- Create: `frontend/` (整个 Vite 项目目录)

- [ ] **Step 1: 执行脚手架命令**

```bash
cd frontend && npm create vite@latest . -- --template vue
```

- [ ] **Step 2: 验证**

```bash
ls frontend/src/App.vue frontend/vite.config.js
```
Expected: 两个文件均存在。

- [ ] **Step 3: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold Vite + Vue 3 project"
```

---

### Task 2: 安装依赖

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: 安装 vue-router, pinia, element-plus, axios**

```bash
cd frontend && npm install && npm install vue-router@4 pinia element-plus axios
```

- [ ] **Step 2: 验证**

```bash
cd frontend && node -e "require('vue-router'); require('pinia'); require('element-plus'); require('axios'); console.log('OK')"
```
Expected: 输出 `OK`，无报错。

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add vue-router, pinia, element-plus, axios"
```

---

### Task 3: 配置 main.js — 注册插件

**Files:**
- Modify: `frontend/src/main.js`

**Produces:**
- `app` 实例挂载了 router, pinia, ElementPlus

- [ ] **Step 1: 写入 main.js**

```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功，无报错。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.js
git commit -m "feat: register pinia, router, element-plus in main.js"
```

---

### Task 4: 创建路由骨架 — 所有路由定义 + 路由守卫

**Files:**
- Create: `frontend/src/router/index.js`

**Produces:**
- `router` 实例，包含所有路由定义和 `beforeEach` 守卫
- 所有页面组件先以占位 `<div>PageName</div>` 的形式创建

- [ ] **Step 1: 创建所有占位页面**

```bash
mkdir -p frontend/src/pages/auth
mkdir -p frontend/src/pages/teacher
mkdir -p frontend/src/pages/student
mkdir -p frontend/src/layouts
```

创建以下占位文件（每个 3 行）：

`frontend/src/pages/auth/Login.vue`:
```vue
<template><div>Login</div></template>
```

`frontend/src/pages/auth/Register.vue`:
```vue
<template><div>Register</div></template>
```

`frontend/src/pages/teacher/Generate.vue`:
```vue
<template><div>Generate</div></template>
```

`frontend/src/pages/teacher/QuestionList.vue`:
```vue
<template><div>QuestionList</div></template>
```

`frontend/src/pages/teacher/QuestionForm.vue`:
```vue
<template><div>QuestionForm</div></template>
```

`frontend/src/pages/teacher/ExamList.vue`:
```vue
<template><div>ExamList</div></template>
```

`frontend/src/pages/teacher/ExamCreate.vue`:
```vue
<template><div>ExamCreate</div></template>
```

`frontend/src/pages/teacher/ExamDetail.vue`:
```vue
<template><div>ExamDetail</div></template>
```

`frontend/src/pages/teacher/ExamResults.vue`:
```vue
<template><div>ExamResults</div></template>
```

`frontend/src/pages/student/Dashboard.vue`:
```vue
<template><div>Dashboard</div></template>
```

`frontend/src/pages/student/ExamAnswer.vue`:
```vue
<template><div>ExamAnswer</div></template>
```

`frontend/src/pages/student/ExamResult.vue`:
```vue
<template><div>ExamResult</div></template>
```

- [ ] **Step 2: 创建路由文件**

`frontend/src/router/index.js`:
```javascript
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/auth/login' },
  {
    path: '/auth/login',
    name: 'Login',
    component: () => import('@/pages/auth/Login.vue'),
    meta: { guest: true }
  },
  {
    path: '/auth/register',
    name: 'Register',
    component: () => import('@/pages/auth/Register.vue'),
    meta: { guest: true }
  },
  {
    path: '/teacher/generate',
    name: 'Generate',
    component: () => import('@/pages/teacher/Generate.vue'),
    meta: { role: 'teacher' }
  },
  {
    path: '/teacher/questions',
    name: 'QuestionList',
    component: () => import('@/pages/teacher/QuestionList.vue'),
    meta: { role: 'teacher' }
  },
  {
    path: '/teacher/questions/create',
    name: 'QuestionCreate',
    component: () => import('@/pages/teacher/QuestionForm.vue'),
    meta: { role: 'teacher' }
  },
  {
    path: '/teacher/questions/:id/edit',
    name: 'QuestionEdit',
    component: () => import('@/pages/teacher/QuestionForm.vue'),
    meta: { role: 'teacher' }
  },
  {
    path: '/teacher/exams',
    name: 'ExamList',
    component: () => import('@/pages/teacher/ExamList.vue'),
    meta: { role: 'teacher' }
  },
  {
    path: '/teacher/exams/create',
    name: 'ExamCreate',
    component: () => import('@/pages/teacher/ExamCreate.vue'),
    meta: { role: 'teacher' }
  },
  {
    path: '/teacher/exams/:id',
    name: 'ExamDetail',
    component: () => import('@/pages/teacher/ExamDetail.vue'),
    meta: { role: 'teacher' }
  },
  {
    path: '/teacher/exams/:id/results',
    name: 'ExamResults',
    component: () => import('@/pages/teacher/ExamResults.vue'),
    meta: { role: 'teacher' }
  },
  {
    path: '/student/dashboard',
    name: 'StudentDashboard',
    component: () => import('@/pages/student/Dashboard.vue'),
    meta: { role: 'student' }
  },
  {
    path: '/student/exam/:id',
    name: 'ExamAnswer',
    component: () => import('@/pages/student/ExamAnswer.vue'),
    meta: { role: 'student' }
  },
  {
    path: '/student/result/:examId',
    name: 'ExamResult',
    component: () => import('@/pages/student/ExamResult.vue'),
    meta: { role: 'student' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const role = localStorage.getItem('role') || 'guest'
  if (to.meta.guest) return next()
  if (to.meta.role && to.meta.role !== role) {
    if (role === 'teacher') return next('/teacher/generate')
    if (role === 'student') return next('/student/dashboard')
    return next('/auth/login')
  }
  next()
})

export default router
```

- [ ] **Step 3: 配置 Vite 别名**

修改 `frontend/vite.config.js`，在 `defineConfig` 中添加 `resolve.alias`:
```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
```

- [ ] **Step 4: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。然后 `npx vite --port 3000`，访问 `http://localhost:3000` 自动跳转到 `/auth/login`，显示 "Login"。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/router/ frontend/src/pages/ frontend/vite.config.js
git commit -m "feat: add router with all routes and guards"
```

---

### Task 5: 创建 authStore

**Files:**
- Create: `frontend/src/stores/auth.js`

**Produces:**
- `useAuthStore()` — Pinia store，提供 `user`, `role`, `login()`, `logout()`, `register()`

- [ ] **Step 1: 写入 auth store**

```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  const role = computed(() => user.value?.role || 'guest')

  function login(credentials) {
    // mock: 用邮箱前缀判断角色
    const mockUser = {
      email: credentials.email,
      name: credentials.email.split('@')[0],
      role: credentials.email.includes('teacher') ? 'teacher' : 'student'
    }
    user.value = mockUser
    localStorage.setItem('user', JSON.stringify(mockUser))
    localStorage.setItem('role', mockUser.role)
    return mockUser
  }

  function register(info) {
    return login(info)
  }

  function logout() {
    user.value = null
    localStorage.removeItem('user')
    localStorage.removeItem('role')
  }

  return { user, role, login, logout, register }
})
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/
git commit -m "feat: add auth store with mock login/register/logout"
```

---

### Task 6: 创建 Mock 数据与拦截器

**Files:**
- Create: `frontend/src/mock/data.js`
- Create: `frontend/src/api/index.js`

**Produces:**
- `mock/data.js` — 导出 `questions`, `exams`, `results` 三个 mock 数据数组
- `api/index.js` — 导出带拦截器的 axios 实例和 API 函数

- [ ] **Step 1: 写入 mock 数据**

`frontend/src/mock/data.js`:
```javascript
export const questions = [
  {
    id: 1, type: 'single', subject: '数学', difficulty: 'easy',
    stem: '1 + 1 = ?',
    options: ['1', '2', '3', '4'], answer: 1, source: 'llm'
  },
  {
    id: 2, type: 'multiple', subject: '语文', difficulty: 'medium',
    stem: '以下哪些是唐代诗人？（多选）',
    options: ['李白', '杜甫', '苏轼', '白居易'], answer: [0, 1, 3], source: 'manual'
  },
  {
    id: 3, type: 'judge', subject: '物理', difficulty: 'easy',
    stem: '光在真空中沿直线传播。',
    options: ['正确', '错误'], answer: 0, source: 'llm'
  },
  {
    id: 4, type: 'blank', subject: '英语', difficulty: 'medium',
    stem: 'The cat ___ on the mat.',
    answer: 'sits', source: 'llm'
  },
  {
    id: 5, type: 'essay', subject: '历史', difficulty: 'hard',
    stem: '简述秦始皇统一六国的历史意义。',
    answer: '', source: 'manual'
  }
]

export const exams = [
  {
    id: 1, title: '期中测验', subject: '数学',
    duration: 60, totalScore: 100,
    questionIds: [1, 2, 3],
    status: 'published',
    createdAt: '2026-07-28'
  },
  {
    id: 2, title: '期末综合', subject: '综合',
    duration: 120, totalScore: 150,
    questionIds: [1, 2, 3, 4, 5],
    status: 'draft',
    createdAt: '2026-07-29'
  }
]

export const results = [
  { examId: 1, studentName: '张三', score: 85, total: 100, submittedAt: '2026-07-28 14:30', answers: [{ qid: 1, userAnswer: 1, correct: true }, { qid: 2, userAnswer: [0, 1], correct: false }, { qid: 3, userAnswer: 0, correct: true }] },
  { examId: 1, studentName: '李四', score: 92, total: 100, submittedAt: '2026-07-28 15:10', answers: [{ qid: 1, userAnswer: 1, correct: true }, { qid: 2, userAnswer: [0, 1, 3], correct: true }, { qid: 3, userAnswer: 0, correct: true }] }
]
```

- [ ] **Step 2: 写入 API 层**

`frontend/src/api/index.js`:
```javascript
import axios from 'axios'
import { questions, exams, results } from '@/mock/data'

const api = axios.create({ baseURL: '/api' })

// mock 拦截器: 延迟 300ms 返回数据
api.interceptors.request.use(async (config) => {
  await new Promise(r => setTimeout(r, 300))
  const url = config.url || ''

  if (url === '/questions')            config.adapter = () => Promise.resolve({ data: questions })
  else if (url === '/exams')           config.adapter = () => Promise.resolve({ data: exams })
  else if (url.startsWith('/results')) config.adapter = () => Promise.resolve({ data: results })

  return config
})

export function fetchQuestions()      { return api.get('/questions') }
export function fetchExams()          { return api.get('/exams') }
export function fetchResults(examId)  { return api.get(`/results/${examId}`) }
```

- [ ] **Step 3: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/mock/ frontend/src/api/
git commit -m "feat: add mock data and axios interceptor"
```

---

### Task 7: 创建布局组件

**Files:**
- Create: `frontend/src/layouts/AuthLayout.vue`
- Create: `frontend/src/layouts/TeacherLayout.vue`
- Create: `frontend/src/layouts/StudentLayout.vue`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/router/index.js`

**Interfaces:**
- Consumes: `router` (Task 4), `useAuthStore` (Task 5)
- Produces: 三个布局组件包裹 `<router-view>`，教师端含侧边栏导航

- [ ] **Step 1: 写入 AuthLayout.vue**

```vue
<template>
  <div class="auth-layout">
    <el-container>
      <el-main><router-view /></el-main>
    </el-container>
  </div>
</template>
```

- [ ] **Step 2: 写入 TeacherLayout.vue**

```vue
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
```

- [ ] **Step 3: 写入 StudentLayout.vue**

```vue
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
```

- [ ] **Step 4: 修改 App.vue**

```vue
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
```

- [ ] **Step 5: 修改 router/index.js — 路由改用布局包裹**

删除之前的路由定义，改为：

```javascript
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/auth/login' },
  {
    path: '/auth',
    meta: { guest: true },
    children: [
      { path: 'login', name: 'Login', component: () => import('@/pages/auth/Login.vue') },
      { path: 'register', name: 'Register', component: () => import('@/pages/auth/Register.vue') }
    ]
  },
  {
    path: '/teacher',
    meta: { role: 'teacher' },
    children: [
      { path: 'generate', name: 'Generate', component: () => import('@/pages/teacher/Generate.vue') },
      { path: 'questions', name: 'QuestionList', component: () => import('@/pages/teacher/QuestionList.vue') },
      { path: 'questions/create', name: 'QuestionCreate', component: () => import('@/pages/teacher/QuestionForm.vue') },
      { path: 'questions/:id/edit', name: 'QuestionEdit', component: () => import('@/pages/teacher/QuestionForm.vue') },
      { path: 'exams', name: 'ExamList', component: () => import('@/pages/teacher/ExamList.vue') },
      { path: 'exams/create', name: 'ExamCreate', component: () => import('@/pages/teacher/ExamCreate.vue') },
      { path: 'exams/:id', name: 'ExamDetail', component: () => import('@/pages/teacher/ExamDetail.vue') },
      { path: 'exams/:id/results', name: 'ExamResults', component: () => import('@/pages/teacher/ExamResults.vue') }
    ]
  },
  {
    path: '/student',
    meta: { role: 'student' },
    children: [
      { path: 'dashboard', name: 'StudentDashboard', component: () => import('@/pages/student/Dashboard.vue') },
      { path: 'exam/:id', name: 'ExamAnswer', component: () => import('@/pages/student/ExamAnswer.vue') },
      { path: 'result/:examId', name: 'ExamResult', component: () => import('@/pages/student/ExamResult.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const role = localStorage.getItem('role') || 'guest'
  if (to.meta.guest) return next()
  if (to.meta.role && to.meta.role !== role) {
    if (role === 'teacher') return next('/teacher/generate')
    if (role === 'student') return next('/student/dashboard')
    return next('/auth/login')
  }
  next()
})

export default router
```

- [ ] **Step 6: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。然后用 `npx vite` 启动，浏览器访问确认布局渲染、侧边栏导航可点击。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/layouts/ frontend/src/App.vue frontend/src/router/
git commit -m "feat: add layouts with sidebar navigation"
```

---

### Task 8: 登录页 Login.vue

**Files:**
- Modify: `frontend/src/pages/auth/Login.vue`

**Interfaces:**
- Consumes: `useAuthStore` (Task 5)

- [ ] **Step 1: 写入 Login.vue**

```vue
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
```

- [ ] **Step 2: 添加 auth card 样式**

在 `frontend/src/style.css`（若没有则创建）追加：

```css
.auth-card { width: 400px; margin: 100px auto; }
```

- [ ] **Step 3: 验证**

```bash
cd frontend && npx vite build && npx vite --port 3000
```
- 访问 `http://localhost:3000/auth/login`，看到登录表单
- 输入 `teacher@test.com` / 任意密码，点击登录 → 跳转到 `/teacher/generate`
- 清除 localStorage 后输入 `student@test.com` → 跳转到 `/student/dashboard`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/auth/Login.vue frontend/src/style.css
git commit -m "feat: add login page with mock auth"
```

---

### Task 9: 注册页 Register.vue

**Files:**
- Modify: `frontend/src/pages/auth/Register.vue`

- [ ] **Step 1: 写入 Register.vue**

```vue
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
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。浏览器访问 `/auth/register`，填写表单点击注册，跳回登录页。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/auth/Register.vue
git commit -m "feat: add register page"
```

---

### Task 10: LLM 出题页 Generate.vue

**Files:**
- Modify: `frontend/src/pages/teacher/Generate.vue`

- [ ] **Step 1: 写入 Generate.vue**

```vue
<template>
  <div class="generate-page">
    <h2>🤖 LLM 出题</h2>
    <el-form :model="form" label-width="80px">
      <el-form-item label="题型">
        <el-select v-model="form.type">
          <el-option label="单选题" value="single" />
          <el-option label="多选题" value="multiple" />
          <el-option label="判断题" value="judge" />
          <el-option label="填空题" value="blank" />
          <el-option label="简答题" value="essay" />
        </el-select>
      </el-form-item>
      <el-form-item label="科目">
        <el-input v-model="form.subject" placeholder="数学" />
      </el-form-item>
      <el-form-item label="知识点">
        <el-input v-model="form.topic" placeholder="一元二次方程" />
      </el-form-item>
      <el-form-item label="难度">
        <el-radio-group v-model="form.difficulty">
          <el-radio-button value="easy">简单</el-radio-button>
          <el-radio-button value="medium">中等</el-radio-button>
          <el-radio-button value="hard">困难</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="数量">
        <el-input-number v-model="form.count" :min="1" :max="10" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="generate" :loading="generating">生成题目</el-button>
      </el-form-item>
    </el-form>

    <el-divider />

    <div v-if="generated.length">
      <h3>生成结果 ({{ generated.length }} 题)</h3>
      <div v-for="q in generated" :key="q.id" class="generated-item">
        <p><el-tag>{{ q.type }}</el-tag> <strong>{{ q.stem }}</strong></p>
        <p v-if="q.options">选项: {{ q.options.join(' / ') }}</p>
        <p>答案: {{ q.answer }}</p>
      </div>
      <el-button type="success" @click="saveAll">全部存入题库</el-button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

const form = reactive({ type: 'single', subject: '', topic: '', difficulty: 'medium', count: 3 })
const generating = ref(false)
const generated = ref([])

async function generate() {
  generating.value = true
  await new Promise(r => setTimeout(r, 500)) // mock delay
  generated.value = Array.from({ length: form.count }, (_, i) => ({
    id: Date.now() + i,
    type: form.type,
    stem: `[Mock] ${form.subject || '通用'} - ${form.topic || '知识点'} 第${i + 1}题`,
    options: form.type !== 'essay' ? ['选项A', '选项B', '选项C', '选项D'] : null,
    answer: form.type === 'multiple' ? 'A,C' : 'A'
  }))
  generating.value = false
  ElMessage.success(`已生成 ${form.count} 道题目`)
}

function saveAll() {
  ElMessage.success('题目已存入题库 (mock)')
  generated.value = []
}
</script>
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。浏览器以教师身份登录，访问 `/teacher/generate`，选择题型、填写信息，点击生成，看到 mock 题目列表。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/teacher/Generate.vue
git commit -m "feat: add LLM generate page with mock generation"
```

---

### Task 11: 题库列表页 QuestionList.vue

**Files:**
- Modify: `frontend/src/pages/teacher/QuestionList.vue`

- [ ] **Step 1: 写入 QuestionList.vue**

```vue
<template>
  <div class="question-list">
    <h2>📚 题库</h2>
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
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。浏览器教师登录后访问 `/teacher/questions`，看到题库表格，搜索和筛选可用。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/teacher/QuestionList.vue
git commit -m "feat: add question list page with search and filter"
```

---

### Task 12: 题目表单页 QuestionForm.vue

**Files:**
- Modify: `frontend/src/pages/teacher/QuestionForm.vue`

- [ ] **Step 1: 写入 QuestionForm.vue**

```vue
<template>
  <div class="question-form">
    <h2>{{ isEdit ? '编辑题目' : '手动建题' }}</h2>
    <el-form :model="form" label-width="80px">
      <el-form-item label="题型">
        <el-select v-model="form.type">
          <el-option label="单选题" value="single" />
          <el-option label="多选题" value="multiple" />
          <el-option label="判断题" value="judge" />
          <el-option label="填空题" value="blank" />
          <el-option label="简答题" value="essay" />
        </el-select>
      </el-form-item>
      <el-form-item label="题干">
        <el-input v-model="form.stem" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item v-if="form.type !== 'essay'" label="选项">
        <div v-for="(opt, i) in form.options" :key="i" class="option-row">
          <el-input v-model="form.options[i]" :placeholder="`选项${String.fromCharCode(65 + i)}`" />
        </div>
      </el-form-item>
      <el-form-item label="答案">
        <el-input v-model="form.answer" placeholder="单选填索引0/1/2/3，多选用逗号分隔" />
      </el-form-item>
      <el-form-item label="难度">
        <el-radio-group v-model="form.difficulty">
          <el-radio-button value="easy">简单</el-radio-button>
          <el-radio-button value="medium">中等</el-radio-button>
          <el-radio-button value="hard">困难</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="save">保存</el-button>
        <el-button @click="$router.back()">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

const route = useRoute()
const isEdit = computed(() => !!route.params.id)

const form = reactive({
  type: 'single',
  stem: '',
  options: ['', '', '', ''],
  answer: '',
  difficulty: 'medium'
})

function save() {
  ElMessage.success(isEdit.value ? '题目已更新 (mock)' : '题目已创建 (mock)')
}
</script>
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。浏览器访问 `/teacher/questions/create`，填写表单点击保存，看到成功提示。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/teacher/QuestionForm.vue
git commit -m "feat: add question form page for create and edit"
```

---

### Task 13: 试卷列表页 ExamList.vue

**Files:**
- Modify: `frontend/src/pages/teacher/ExamList.vue`

- [ ] **Step 1: 写入 ExamList.vue**

```vue
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
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。浏览器访问 `/teacher/exams`，看到试卷列表。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/teacher/ExamList.vue
git commit -m "feat: add exam list page"
```

---

### Task 14: 组卷页 ExamCreate.vue

**Files:**
- Modify: `frontend/src/pages/teacher/ExamCreate.vue`

- [ ] **Step 1: 写入 ExamCreate.vue**

```vue
<template>
  <div class="exam-create">
    <h2>📝 组卷</h2>
    <el-form :model="form" label-width="100px" class="exam-form">
      <el-form-item label="试卷名称">
        <el-input v-model="form.title" />
      </el-form-item>
      <el-form-item label="科目">
        <el-input v-model="form.subject" />
      </el-form-item>
      <el-form-item label="考试时长(分钟)">
        <el-input-number v-model="form.duration" :min="1" :max="300" />
      </el-form-item>
    </el-form>

    <el-row :gutter="20">
      <el-col :span="12">
        <h3>题库</h3>
        <el-checkbox-group v-model="selectedIds">
          <div v-for="q in questions" :key="q.id" class="question-card">
            <el-checkbox :value="q.id">{{ q.stem }}</el-checkbox>
            <el-tag size="small">{{ q.type }}</el-tag>
          </div>
        </el-checkbox-group>
      </el-col>
      <el-col :span="12">
        <h3>已选题目 ({{ selectedIds.length }})</h3>
        <div v-for="id in selectedIds" :key="id" class="selected-item">
          {{ questions.find(q => q.id === id)?.stem }}
        </div>
      </el-col>
    </el-row>

    <el-button type="primary" class="submit-btn" @click="createExam">创建试卷</el-button>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { questions as mockQuestions } from '@/mock/data'

const questions = ref(mockQuestions)
const selectedIds = ref([])
const form = reactive({ title: '', subject: '', duration: 60 })

function createExam() {
  ElMessage.success(`试卷 "${form.title}" 创建成功 (mock)`)
}
</script>
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。浏览器访问 `/teacher/exams/create`，左侧勾选题目，右侧显示已选，点击创建提示成功。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/teacher/ExamCreate.vue
git commit -m "feat: add exam create page with question selection"
```

---

### Task 15: 试卷详情页 ExamDetail.vue

**Files:**
- Modify: `frontend/src/pages/teacher/ExamDetail.vue`

- [ ] **Step 1: 写入 ExamDetail.vue**

```vue
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
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。浏览器访问 `/teacher/exams/1`，看到试卷信息 + 题目 + 学生作答。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/teacher/ExamDetail.vue
git commit -m "feat: add exam detail page"
```

---

### Task 16: 成绩汇总页 ExamResults.vue

**Files:**
- Modify: `frontend/src/pages/teacher/ExamResults.vue`

- [ ] **Step 1: 写入 ExamResults.vue**

```vue
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
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。浏览器访问 `/teacher/exams/1/results`，看到统计卡片 + 成绩表格。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/teacher/ExamResults.vue
git commit -m "feat: add exam results page with score statistics"
```

---

### Task 17: 学生首页 Dashboard.vue

**Files:**
- Modify: `frontend/src/pages/student/Dashboard.vue`

- [ ] **Step 1: 写入 Dashboard.vue**

```vue
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
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。浏览器学生登录后看到待考列表和历史记录。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/student/Dashboard.vue
git commit -m "feat: add student dashboard with exam list and history"
```

---

### Task 18: 答题页 ExamAnswer.vue

**Files:**
- Modify: `frontend/src/pages/student/ExamAnswer.vue`

- [ ] **Step 1: 写入 ExamAnswer.vue**

```vue
<template>
  <div class="exam-answer">
    <el-affix>
      <div class="answer-header">
        <h2>{{ exam.title }}</h2>
        <el-tag type="warning">剩余时间: {{ remaining }}</el-tag>
        <el-progress :percentage="progress" class="progress" />
      </div>
    </el-affix>

    <div v-for="(q, i) in questions" :key="q.id" class="question-block">
      <h3>{{ i + 1 }}. <el-tag size="small">{{ q.type }}</el-tag> {{ q.stem }}</h3>
      <el-radio-group v-if="q.type === 'single'" v-model="answers[q.id]" class="option-group">
        <el-radio v-for="(opt, j) in q.options" :key="j" :value="j">{{ opt }}</el-radio>
      </el-radio-group>
      <el-checkbox-group v-else-if="q.type === 'multiple'" v-model="answers[q.id]" class="option-group">
        <el-checkbox v-for="(opt, j) in q.options" :key="j" :value="j">{{ opt }}</el-checkbox>
      </el-checkbox-group>
      <el-radio-group v-else-if="q.type === 'judge'" v-model="answers[q.id]" class="option-group">
        <el-radio :value="0">正确</el-radio>
        <el-radio :value="1">错误</el-radio>
      </el-radio-group>
      <el-input v-else v-model="answers[q.id]" :type="q.type === 'essay' ? 'textarea' : 'text'" :rows="3" />
    </div>

    <el-button type="primary" size="large" @click="submit" class="submit-btn">交卷</el-button>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { exams, questions as allQuestions } from '@/mock/data'

const route = useRoute()
const exam = exams.find(e => e.id === Number(route.params.id)) || exams[0]
const questions = allQuestions.filter(q => exam.questionIds.includes(q.id))
const answers = reactive({})
const remaining = ref(`${exam.duration}:00`)

const progress = computed(() => {
  const answered = Object.keys(answers).filter(k => answers[k] !== '' && answers[k] !== undefined).length
  return Math.round((answered / questions.length) * 100)
})

async function submit() {
  await ElMessageBox.confirm('确认交卷？', '提示', { type: 'warning' })
}
</script>
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。浏览器访问 `/student/exam/1`，看到题目、计时器、进度条，各题型渲染正确，点击交卷弹出确认框。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/student/ExamAnswer.vue
git commit -m "feat: add exam answer page with all question types"
```

---

### Task 19: 成绩页 ExamResult.vue

**Files:**
- Modify: `frontend/src/pages/student/ExamResult.vue`

- [ ] **Step 1: 写入 ExamResult.vue**

```vue
<template>
  <div class="exam-result">
    <h2>📊 考试成绩</h2>
    <el-result :icon="passed ? 'success' : 'error'" :title="`${result.score} / ${result.total}`" :sub-title="passed ? '通过!' : '未通过'" />

    <h3>逐题详情</h3>
    <div v-for="(a, i) in result.answers" :key="i" class="answer-item">
      <p>
        <el-tag :type="a.correct ? 'success' : 'danger'">{{ a.correct ? '✓' : '✗' }}</el-tag>
        第{{ i + 1 }}题
        <template v-if="!a.correct">（正确答案非本题所填）</template>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { results } from '@/mock/data'

const route = useRoute()
const result = ref(results.find(r => r.examId === Number(route.params.examId)) || results[0])
const passed = computed(() => result.value.score / result.value.total >= 0.6)
</script>
```

- [ ] **Step 2: 验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功。浏览器访问 `/student/result/1`，看到总分、通过状态、逐题对错。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/student/ExamResult.vue
git commit -m "feat: add exam result page with score and per-question detail"
```

---

### Task 20: 全局样式与收尾

**Files:**
- Create/Modify: `frontend/src/style.css`
- Modify: `frontend/index.html`

- [ ] **Step 1: 确认 style.css 完整**

```css
body { margin: 0; font-family: 'Helvetica Neue', Arial, sans-serif; }
.auth-card { width: 400px; margin: 100px auto; }
.toolbar { margin-bottom: 16px; }
.table { margin-top: 16px; }
.question-card { padding: 8px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 8px; }
.question-block { padding: 20px; margin: 16px 0; border: 1px solid #ebeef5; border-radius: 4px; }
.option-group { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.submit-btn { margin-top: 24px; width: 100%; }
.answer-item { padding: 8px; border-bottom: 1px solid #f0f0f0; }
.stats { margin-bottom: 20px; }
.answer-header { background: #fff; padding: 16px; border-bottom: 1px solid #eee; }
.answer-header .progress { margin-top: 8px; }
.exam-form { max-width: 500px; }
.generated-item { padding: 12px; margin: 8px 0; background: #f5f7fa; border-radius: 4px; }
.selected-item { padding: 4px 0; border-bottom: 1px solid #eee; font-size: 14px; }
```

- [ ] **Step 2: 修改 index.html — 设置中文 title**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Exam Maker</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 3: 全局验证**

```bash
cd frontend && npx vite build
```
Expected: build 成功，无警告。

完整流程验证：
1. `npx vite --port 3000` 启动
2. 访问 `/auth/login` → 用 `teacher@test.com` 登录 → 跳转 `/teacher/generate`
3. 出题 → 题库列表 → 组卷 → 查看试卷详情 → 查看成绩
4. 退出(清 localStorage) → 用 `student@test.com` 登录
5. 待考列表 → 答题 → 交卷 → 查看成绩
6. 教师页 → 成绩汇总

- [ ] **Step 4: Commit**

```bash
git add frontend/src/style.css frontend/index.html
git commit -m "feat: add global styles and finalize frontend"
```

---

## 验证清单

| # | 页面 | 验证方法 |
|---|------|----------|
| 1 | `/auth/login` | 用 teacher@test.com 登录 → 跳转 /teacher/generate |
| 2 | `/auth/register` | 填写表单 → 跳回登录页 |
| 3 | `/teacher/generate` | 选择题型、科目 → 点击生成 → 看到 mock 题目 |
| 4 | `/teacher/questions` | 看到题库表格 → 搜索/筛选可用 → 点击编辑跳转 |
| 5 | `/teacher/questions/create` | 填写表单 → 保存 → 提示成功 |
| 6 | `/teacher/exams` | 看到试卷列表 |
| 7 | `/teacher/exams/create` | 左侧勾选题目 → 右侧同步显示 → 创建成功 |
| 8 | `/teacher/exams/1` | 看到试卷信息 + 题目列表 + 学生作答 |
| 9 | `/teacher/exams/1/results` | 看到统计卡片 + 成绩表格 |
| 10 | `/student/dashboard` | 看到待考列表 + 历史记录 |
| 11 | `/student/exam/1` | 各题型渲染正确 → 作答 → 进度条变化 → 交卷弹确认 |
| 12 | `/student/result/1` | 看到分数 + 通过状态 + 逐题对错 |
