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
