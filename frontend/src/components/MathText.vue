<template>
  <span class="math-text" v-html="html"></span>
</template>

<script setup>
import { computed } from 'vue'
import { renderMath } from '@/utils/renderMath'

const props = defineProps({
  text: { type: String, default: '' }
})

const html = computed(() => renderMath(props.text))
</script>

<style scoped>
.math-text :deep(.katex-display) {
  margin: 0.5em 0;
  overflow-x: auto;
}
.math-text :deep(.math-error) {
  color: #f56c6c;
  background: #fef0f0;
  padding: 0 4px;
  border-radius: 2px;
}
</style>
