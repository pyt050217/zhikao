# Exam Maker 前端设计文档

**日期**: 2026-07-30
**状态**: 已确认

---

## 概述

exam-maker 是一个完整的考试平台：LLM 出题 → 题库管理 → 组卷发布 → 学生作答 → 交卷判分。
本文档定义前端应用的设计，后端 API 暂不实现，使用 mock 数据开发。

## 技术栈

- Vue 3 (Composition API + `<script setup>`)
- Vite 构建
- Pinia 状态管理
- Element Plus UI 组件库
- Vue Router 4 路由
- Axios + 本地 mock 数据（拦截器模拟）

## 用户角色

| 角色 | 权限 |
|------|------|
| 教师 (teacher) | 出题、管理题库、组卷、查看成绩、主观题批改 |
| 学生 (student) | 查看待考列表、答题、查看自己的成绩 |

## 主链路

```
LLM 出题 → 题库管理 → 组卷发布 → 学生作答 → 交卷判分
```

## 路由设计

```
/auth/login                 →  登录页
/auth/register              →  注册页

# 主链 Step 1: LLM 出题
/teacher/generate           →  LLM 出题页

# 主链 Step 2: 题库管理
/teacher/questions          →  题库列表
/teacher/questions/create   →  手动新建题目
/teacher/questions/:id/edit →  编辑题目

# 主链 Step 3: 组卷发布
/teacher/exams              →  试卷列表
/teacher/exams/create       →  组卷页
/teacher/exams/:id          →  试卷详情
/teacher/exams/:id/results  →  成绩汇总

# 主链 Step 4: 学生作答
/student/dashboard          →  待考列表
/student/exam/:id           →  答题页

# 主链 Step 5: 交卷判分
/student/result/:examId     →  成绩页
```

**路由守卫**:
- 未登录 → `/auth/login`
- 学生访问 `/teacher/*` → `/student/dashboard`
- 教师访问 `/student/*` → `/teacher/dashboard`

## 目录结构（按功能模块）

```
frontend/src/
  api/            # axios 实例 + API 函数（初期用 mock）
  mock/           # mock 数据 & 拦截器
  router/         # 路由配置 + 守卫
  stores/         # Pinia stores
    auth.js
    questionBank.js
    exam.js
    answer.js
  layouts/
    TeacherLayout.vue
    StudentLayout.vue
    AuthLayout.vue
  pages/
    auth/
      Login.vue
      Register.vue
    teacher/
      Generate.vue
      QuestionList.vue
      QuestionForm.vue
      ExamList.vue
      ExamCreate.vue
      ExamDetail.vue
      ExamResults.vue
    student/
      Dashboard.vue
      ExamAnswer.vue
      ExamResult.vue
  components/
    common/        # 通用组件
    teacher/       # 教师端组件
    student/       # 学生端组件
  App.vue
  main.js
```

## Pinia Store 设计

### authStore
- `user: { id, name, role } | null`
- `login(credentials)`, `logout()`, `register()`
- 初始化时从 localStorage 恢复 session

### questionBankStore
- `questions: Question[]`, `filters: { type, keyword }`
- `fetchQuestions()`, `createQuestion()`, `updateQuestion()`, `deleteQuestion()`
- `generateQuestions(prompt)` — 调用 LLM mock

### examStore
- `exams: Exam[]`, `currentExam: Exam | null`
- `fetchExams()`, `createExam(config)`, `publishExam(id)`, `fetchResults(examId)`

### answerStore
- `currentAnswers: Record<questionId, answer>`, `timeRemaining: number`
- `startExam(examId)`, `submitAnswer(qId, answer)`, `submitExam()`
- `fetchResult(examId)`

## Mock 策略

- 使用 axios 请求拦截器，根据 URL 模式返回本地 JSON 数据
- Mock 数据放在 `mock/` 目录下，按模块拆分文件
- 模拟 200-500ms 网络延迟

## 第一阶段实施范围

只做静态页面 + mock 数据展示，每个任务 < 30 行改动：
1. 项目脚手架（Vite + 依赖安装）
2. 路由骨架 + 布局组件
3. 逐个页面实现为静态表单页
