<template>
  <div class="question-list">
    <h2>题库</h2>
    <el-row :gutter="16" class="toolbar">
      <el-col :span="4">
        <el-select v-model="subjectFilter" placeholder="学科" clearable>
          <el-option label="线性代数" value="linear_algebra" />
          <el-option label="微积分" value="calculus" />
        </el-select>
      </el-col>
      <el-col :span="5"><el-input v-model="keyword" placeholder="搜索题目" clearable /></el-col>
      <el-col :span="4">
        <el-select v-model="typeFilter" placeholder="题型筛选" clearable>
          <el-option label="单选题" value="single" />
          <el-option label="多选题" value="multiple" />
          <el-option label="判断题" value="judge" />
          <el-option label="填空题" value="blank" />
          <el-option label="简答题" value="essay" />
        </el-select>
      </el-col>
      <el-col :span="7">
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
      <div v-if="parsing || ocrRunning" class="parse-status">
        <el-icon class="is-loading"><loading /></el-icon>
        <span>{{ ocrRunning ? `正在识别 ${formulaCount} 个公式（Pix2tex 本地推理）…` : '正在解析文档…' }}</span>
      </div>

      <!-- 预览表格 -->
      <div v-if="parsedQuestions.length" class="preview-section">
        <h4>解析结果预览（共 {{ parsedQuestions.length }} 道题，检测到 {{ formulaCount }} 个公式）</h4>

        <!-- 学科选择 -->
        <div class="subject-select-row">
          <span class="label">存入学科：</span>
          <el-radio-group v-model="importSubject" size="small">
            <el-radio-button value="linear_algebra">线性代数</el-radio-button>
            <el-radio-button value="calculus">微积分</el-radio-button>
          </el-radio-group>
        </div>

        <el-alert
          v-if="ocrTodos.length"
          :title="`有 ${ocrTodos.length} 个公式识别存疑，请入库后人工复核题干中的 $...$ 部分`"
          type="warning"
          show-icon
          :closable="false"
          class="ocr-alert"
        />
        <el-table :data="parsedQuestions" stripe max-height="300">
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="type" label="题型" width="80">
            <template #default="{ row }">
              <el-tag size="small">{{ { single: '单选', multiple: '多选', judge: '判断', blank: '填空', essay: '简答' }[row.type] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="题干">
            <template #default="{ row }">
              <MathText :text="row.stem" />
            </template>
          </el-table-column>
        </el-table>
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
import { ocrFormulas, ocrFormulasPix2tex } from '@/api'
import { parseFile } from '@/utils/fileParser'
import { splitTextIntoQuestions, applyFormulas } from '@/utils/questionSplitter'
import MathText from '@/components/MathText.vue'

const store = useQuestionStore()

const subjectFilter = ref('')
const keyword = ref('')
const typeFilter = ref('')
const importDialog = ref(false)
const importSubject = ref('linear_algebra')
const fileList = ref([])
const parsing = ref(false)
const ocrRunning = ref(false)
const importing = ref(false)
const parsedQuestions = ref([])
const ocrTodos = ref([])
const formulaCount = ref(0)

const filtered = computed(() => store.questions.filter(q =>
  (!subjectFilter.value || q.subject === subjectFilter.value) &&
  (!keyword.value || q.stem.includes(keyword.value)) &&
  (!typeFilter.value || q.type === typeFilter.value)
))

function del(id) {
  store.removeQuestion(id)
}

async function handleFileChange(file) {
  fileList.value = [file]
  parsing.value = true
  ocrRunning.value = false
  parsedQuestions.value = []
  ocrTodos.value = []
  formulaCount.value = 0
  try {
    // 1. 前端解析文字 + 公式裁图
    const { text, formulas } = await parseFile(file.raw)
    formulaCount.value = formulas.length

    // 2. 构建题目（公式位置用占位符）
    let questions = splitTextIntoQuestions(text)

    if (!questions.length) {
      ElMessage.warning('未能从文档中识别出题目，请检查格式')
      parsing.value = false
      return
    }

    // 3. 有公式则调 OCR（Pix2tex 优先，失败降级 Claude）
    if (formulas.length) {
      ocrRunning.value = true
      const formula_payloads = formulas.map(f => ({
        image: f.image,
        context: text.slice(0, 800),  // 前 800 字作为上下文
      }))
      try {
        let ocrResult = null
        let usedEngine = 'pix2tex'

        // 优先调用 Pix2tex（本地推理，免费）
        try {
          const { data } = await ocrFormulasPix2tex(formula_payloads)
          if (data.results?.length) {
            const errors = data.results.filter(r => r.status === 'ERROR')
            // 全部失败则视为 Pix2tex 不可用，降级 Claude
            if (errors.length < data.results.length) {
              ocrResult = data
            }
          }
        } catch (pix2texErr) {
          console.warn('Pix2tex 不可用，降级到 Claude:', pix2texErr)
        }

        // 降级：调用 Claude 视觉
        if (!ocrResult) {
          usedEngine = 'claude'
          const { data } = await ocrFormulas(formula_payloads)
          ocrResult = data
        }

        const latexList = (ocrResult.results || []).map(r => r.latex || '')
        const todos = (ocrResult.results || []).filter(r => r.status === 'TODO' || r.status === 'ERROR')
        ocrTodos.value = todos.map((r, i) => `公式 ${i + 1}: ${r.status === 'ERROR' ? r.error : '需人工复核'}`)
        // 回填 LaTeX 到占位符
        questions = questions.map(q => ({
          ...q,
          stem: applyFormulas(q.stem, latexList),
        }))
      } catch (ocrErr) {
        console.warn('公式 OCR 失败（可在预览后手动补充 LaTeX）:', ocrErr)
        ocrTodos.value = [`公式 OCR 调用失败: ${ocrErr.message}（题干中公式显示为占位符，可手动编辑）`]
      } finally {
        ocrRunning.value = false
      }
    }

    parsedQuestions.value = questions

    const msg = ocrTodos.value.length
      ? `识别 ${questions.length} 道题，${formulas.length} 个公式（${ocrTodos.value.length} 个待复核）`
      : `识别 ${questions.length} 道题${formulas.length ? `，${formulas.length} 个公式已转 LaTeX` : ''}`
    ElMessage.success(msg)
  } catch (e) {
    ElMessage.error('解析失败：' + (e.message || e))
  } finally {
    parsing.value = false
    ocrRunning.value = false
  }
}

function resetParse() {
  fileList.value = []
  parsedQuestions.value = []
  ocrTodos.value = []
  formulaCount.value = 0
  importSubject.value = 'linear_algebra'
}

async function confirmImport() {
  importing.value = true
  try {
    // 将选择的学科写入每道题
    const questionsWithSubject = parsedQuestions.value.map(q => ({
      ...q,
      subject: importSubject.value,
    }))
    const added = await store.saveToBank(questionsWithSubject)
    ElMessage.success(`已入库 ${added} 道新题目`)
    importDialog.value = false
    resetParse()
  } catch (e) {
    ElMessage.error('入库失败：' + (e.response?.data?.detail || e.message))
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.parse-status { margin-top: 16px; display: flex; align-items: center; gap: 8px; color: #409eff; }
.preview-section { margin-top: 16px; }
.preview-section h4 { margin-bottom: 8px; }
.subject-select-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.subject-select-row .label { color: #606266; font-size: 14px; }
.ocr-alert { margin-bottom: 12px; }
</style>
