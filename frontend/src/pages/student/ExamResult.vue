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
