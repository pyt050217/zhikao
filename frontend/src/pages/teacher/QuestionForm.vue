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
