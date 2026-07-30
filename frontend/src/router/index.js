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
