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
