<template>
  <div class="question-list">
    <h2>题库</h2>
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
      <el-col :span="8">
        <el-button type="primary" @click="$router.push('/teacher/questions/create')">手动建题</el-button>
        <el-button type="success" @click="importDialog = true">📄 导入文档</el-button>
      </el-col>
    </el-row>

    <el-table :data="filtered" stripe class="table">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="type" label="题型" width="80">
        <template #default="{ row }">
          <el-tag size="small">{{ { single: '单选', multiple: '多选', judge: '判断', blank: '填空', essay: '简答' }[row.type] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="题干" show-overflow-tooltip>
        <template #default="{ row }">
          <MathText :text="row.stem" />
        </template>
      </el-table-column>
      <el-table-column prop="source" label="来源" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="row.source === 'import' ? 'success' : (row.source === 'llm' ? 'warning' : 'info')">
            {{ { import: '导入', llm: 'LLM', manual: '手动' }[row.source] || row.source }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push(`/teacher/questions/${row.id}/edit`)">编辑</el-button>
          <el-button size="small" type="danger" @click="del(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 导入文档对话框 -->
    <el-dialog v-model="importDialog" title="导入往届题目（PDF / DOCX）" width="700px" destroy-on-close>
      <el-upload
        drag
        :auto-upload="false"
        :on-change="handleFileChange"
        :before-upload="() => false"
        accept=".pdf,.docx,.txt"
        :limit="1"
        :file-list="fileList"
        :on-remove="resetParse"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">拖拽文件到此处，或 <em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">支持 PDF / DOCX / TXT，单个文件</div>
        </template>
      </el-upload>

      <!-- 解析状态 -->
      <div v-if="parsing" class="parse-status">
        <el-icon class="is-loading"><loading /></el-icon>
        <span>正在解析文档…</span>
      </div>

      <!-- 预览表格 -->
      <div v-if="parsedQuestions.length" class="preview-section">
        <h4>解析结果预览（共 {{ parsedQuestions.length }} 道题）</h4>
        <el-table :data="parsedQuestions" stripe max-height="300">
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="type" label="题型" width="80">
            <template #default="{ row }">
              <el-tag size="small">{{ { single: '单选', multiple: '多选', judge: '判断', blank: '填空', essay: '简答' }[row.type] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="题干" show-overflow-tooltip>
            <template #default="{ row }">
              <MathText :text="row.stem" />
            </template>
          </el-table-column>
        </el-table>
        <p class="parse-hint">
          ⚠️ 当前为 mock 结构化（按题号切分 + 启发式判题型）。如需更精准的 LLM 结构化，后续可接入 exam-maker 智能体。
        </p>
      </div>

      <template #footer>
        <el-button @click="importDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmImport" :disabled="!parsedQuestions.length" :loading="importing">
          确认入库（{{ parsedQuestions.length }} 题）
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Loading } from '@element-plus/icons-vue'
import { useQuestionStore } from '@/stores/question'
import { parseFile } from '@/utils/fileParser'
import { splitTextIntoQuestions } from '@/utils/questionSplitter'
import MathText from '@/components/MathText.vue'

const store = useQuestionStore()

const keyword = ref('')
const typeFilter = ref('')
const importDialog = ref(false)
const fileList = ref([])
const parsing = ref(false)
const importing = ref(false)
const parsedQuestions = ref([])

const filtered = computed(() => store.questions.filter(q =>
  (!keyword.value || q.stem.includes(keyword.value)) &&
  (!typeFilter.value || q.type === typeFilter.value)
))

function del(id) {
  store.removeQuestion(id)
}

async function handleFileChange(file) {
  fileList.value = [file]
  parsing.value = true
  parsedQuestions.value = []
  try {
    const text = await parseFile(file.raw)
    parsedQuestions.value = splitTextIntoQuestions(text)
    if (!parsedQuestions.value.length) {
      ElMessage.warning('未能从文档中识别出题目，请检查格式')
    } else {
      ElMessage.success(`解析完成，识别出 ${parsedQuestions.value.length} 道题`)
    }
  } catch (e) {
    ElMessage.error('解析失败：' + e.message)
  } finally {
    parsing.value = false
  }
}

function resetParse() {
  fileList.value = []
  parsedQuestions.value = []
}

function confirmImport() {
  importing.value = true
  const added = store.saveToBank(parsedQuestions.value)
  importing.value = false
  ElMessage.success(`已入库 ${added} 道新题目`)
  importDialog.value = false
  resetParse()
}
</script>

<style scoped>
.parse-status { margin-top: 16px; display: flex; align-items: center; gap: 8px; color: #409eff; }
.preview-section { margin-top: 16px; }
.preview-section h4 { margin-bottom: 8px; }
.parse-hint { margin-top: 8px; font-size: 12px; color: #e6a23c; }
</style>
