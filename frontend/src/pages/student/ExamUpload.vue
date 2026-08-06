<template>
  <div class="exam-upload">
    <el-affix>
      <div class="upload-header">
        <h2>📷 拍照上传答案</h2>
        <p class="hint">拍摄或上传解题过程，支持图片和 PDF 文档，可多道题分别上传</p>
      </div>
    </el-affix>

    <!-- 题目列表 -->
    <div v-for="(q, i) in questions" :key="q.id" class="question-upload-block">
      <div class="question-title">
        <span class="q-num">{{ i + 1 }}.</span>
        <el-tag size="small">{{ typeLabel(q.type) }}</el-tag>
        <MathText :text="q.stem" />
      </div>

      <!-- 已上传文件预览 -->
      <div v-if="answers[q.id]?.length" class="uploaded-preview">
        <!-- 图片预览 -->
        <div
          v-for="(item, idx) in answers[q.id]"
          :key="idx"
          class="preview-item"
          :class="{ 'pdf-item': item.type === 'pdf' }"
        >
          <!-- 图片缩略图 -->
          <img
            v-if="item.type === 'image'"
            :src="item.data"
            :alt="`${i + 1}题答案${idx + 1}`"
          />
          <!-- PDF 文件指示 -->
          <div v-else class="pdf-preview">
            <el-icon class="pdf-icon"><Document /></el-icon>
            <span class="pdf-name">{{ item.name }}</span>
            <span class="pdf-badge">PDF</span>
          </div>
          <!-- 删除按钮 -->
          <div class="preview-actions">
            <el-button size="small" type="danger" :icon="Delete" circle @click="removeFile(q.id, idx)" />
          </div>
        </div>
      </div>

      <!-- 上传区域 -->
      <div class="upload-area">
        <div class="upload-buttons">
          <!-- 拍照按钮 -->
          <label :for="`camera-${q.id}`" class="action-btn camera-btn">
            <el-icon><Camera /></el-icon>
            <span>拍照</span>
          </label>
          <input
            :id="`camera-${q.id}`"
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            @change="(e) => handleCapture(e, q.id)"
          />

          <!-- 上传图片按钮 -->
          <label :for="`image-${q.id}`" class="action-btn image-btn">
            <el-icon><Picture /></el-icon>
            <span>上传图片</span>
          </label>
          <input
            :id="`image-${q.id}`"
            type="file"
            accept="image/*"
            multiple
            hidden
            @change="(e) => handleFileSelect(e, q.id)"
          />

          <!-- 上传 PDF 按钮 -->
          <label :for="`pdf-${q.id}`" class="action-btn pdf-btn">
            <el-icon><Document /></el-icon>
            <span>上传 PDF</span>
          </label>
          <input
            :id="`pdf-${q.id}`"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            @change="(e) => handleFileSelect(e, q.id)"
          />
        </div>

        <p class="upload-tip">支持 JPG / PNG 图片和 PDF 文档，单题可传多个文件</p>
      </div>
    </div>

    <!-- 全局操作 -->
    <div class="submit-section">
      <el-button type="primary" size="large" @click="submitAnswers" :loading="submitting" class="submit-btn">
        {{ submitting ? '提交中…' : '提交答案' }}
      </el-button>
      <p class="submit-hint">
        共 {{ totalUploaded }} 个文件（{{ imageCount }} 张图片 / {{ pdfCount }} 个 PDF），
        {{ answeredCount }} / {{ questions.length }} 题已上传
      </p>
    </div>

    <!-- 提交成功提示 -->
    <el-dialog v-model="successDialog" title="提交成功" width="360px" center>
      <div class="success-content">
        <el-icon class="success-icon"><CircleCheckFilled /></el-icon>
        <p>答案已提交，共 {{ totalUploaded }} 个文件</p>
      </div>
      <template #footer>
        <el-button type="primary" @click="goBack">返回考试列表</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Camera, Picture, Document, Delete, CircleCheckFilled } from '@element-plus/icons-vue'
import { exams, questions as allQuestions } from '@/mock/data'
import MathText from '@/components/MathText.vue'

const route = useRoute()
const router = useRouter()

const exam = exams.find(e => e.id === Number(route.params.id)) || exams[0]
const questions = allQuestions.filter(q => exam.questionIds.includes(q.id))
const answers = reactive({})  // { questionId: [{ type: 'image'|'pdf', data: base64, name: string }, ...] }
const submitting = ref(false)
const successDialog = ref(false)

const typeMap = { single: '单选', multiple: '多选', judge: '判断', blank: '填空', essay: '简答' }
function typeLabel(t) { return typeMap[t] || t }

// 初始化每道题的答案数组
questions.forEach(q => {
  if (!answers[q.id]) answers[q.id] = []
})

const totalUploaded = computed(() =>
  Object.values(answers).reduce((sum, files) => sum + files.length, 0)
)
const imageCount = computed(() =>
  Object.values(answers).reduce((sum, files) => sum + files.filter(f => f.type === 'image').length, 0)
)
const pdfCount = computed(() =>
  Object.values(answers).reduce((sum, files) => sum + files.filter(f => f.type === 'pdf').length, 0)
)
const answeredCount = computed(() =>
  Object.values(answers).filter(files => files.length > 0).length
)

// 读取文件为 base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 判断文件类型
function getFileType(file) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf'
  return 'image'
}

// 处理单个文件
async function processFile(file, questionId) {
  const fileType = getFileType(file)
  try {
    const base64 = await fileToBase64(file)
    answers[questionId].push({
      type: fileType,
      data: base64,
      name: file.name
    })
    return true
  } catch {
    ElMessage.error(`文件 "${file.name}" 读取失败`)
    return false
  }
}

// 拍照捕获（仅图片）
async function handleCapture(event, questionId) {
  const file = event.target.files?.[0]
  if (!file) return
  await processFile(file, questionId)
  event.target.value = ''  // 允许重复拍照
}

// 处理文件选择（图片或 PDF）
async function handleFileSelect(event, questionId) {
  const files = Array.from(event.target.files || [])
  let successCount = 0
  for (const file of files) {
    const ok = await processFile(file, questionId)
    if (ok) successCount++
  }
  if (successCount) {
    ElMessage.success(`已添加 ${successCount} 个文件`)
  }
  event.target.value = ''
}

// 删除已上传的文件
function removeFile(questionId, idx) {
  answers[questionId].splice(idx, 1)
}

// 提交答案
async function submitAnswers() {
  if (!totalUploaded.value) {
    ElMessage.warning('请至少上传一张图片或一个 PDF')
    return
  }
  submitting.value = true
  try {
    // 保存到 localStorage（模拟提交到服务器）
    const submission = {
      examId: exam.id,
      examTitle: exam.title,
      studentName: localStorage.getItem('studentName') || '当前学生',
      submittedAt: new Date().toLocaleString('zh-CN'),
      answers: JSON.parse(JSON.stringify(answers)),
      fileCount: totalUploaded.value,
      imageCount: imageCount.value,
      pdfCount: pdfCount.value
    }
    const existing = JSON.parse(localStorage.getItem('submissions') || '[]')
    existing.push(submission)
    localStorage.setItem('submissions', JSON.stringify(existing))

    successDialog.value = true
  } catch (e) {
    ElMessage.error('提交失败：' + (e.message || e))
  } finally {
    submitting.value = false
  }
}

function goBack() {
  successDialog.value = false
  router.push('/student/dashboard')
}
</script>

<style scoped>
.exam-upload {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px;
  padding-bottom: 120px;
}

.upload-header {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 16px;
}
.upload-header h2 {
  margin: 0 0 4px;
  font-size: 20px;
}
.hint {
  margin: 0;
  color: #909399;
  font-size: 13px;
}

.question-upload-block {
  background: #fff;
  margin-bottom: 16px;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.question-title {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 15px;
  line-height: 1.6;
}
.q-num {
  font-weight: 600;
  color: #303133;
  flex-shrink: 0;
}

/* 已上传文件预览 */
.uploaded-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
.preview-item {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e4e7ed;
}
.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.preview-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
.preview-item:hover .preview-actions {
  opacity: 1;
}

/* PDF 预览样式 */
.pdf-item {
  background: #fef0f0;
  border-color: #f56c6c;
}
.pdf-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 6px;
  padding: 8px;
}
.pdf-icon {
  font-size: 36px;
  color: #f56c6c;
}
.pdf-name {
  font-size: 11px;
  color: #606266;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}
.pdf-badge {
  font-size: 10px;
  color: #fff;
  background: #f56c6c;
  padding: 1px 6px;
  border-radius: 8px;
}

/* 上传区域 */
.upload-area {
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  transition: border-color 0.2s;
}
.upload-area:hover {
  border-color: #409eff;
}

/* 上传按钮组 */
.upload-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  min-width: 90px;
}
.action-btn .el-icon {
  font-size: 24px;
}
.camera-btn {
  background: #e6f0ff;
  color: #409eff;
}
.camera-btn:hover {
  background: #d9e8ff;
}
.image-btn {
  background: #f0f9eb;
  color: #67c23a;
}
.image-btn:hover {
  background: #e1f3d8;
}
.pdf-btn {
  background: #fef0f0;
  color: #f56c6c;
}
.pdf-btn:hover {
  background: #fde2e2;
}

.upload-tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: #c0c4cc;
}

/* 提交区域 */
.submit-section {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 12px 16px;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.08);
  text-align: center;
  z-index: 100;
}
.submit-btn {
  width: 100%;
  max-width: 400px;
}
.submit-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #909399;
}

/* 成功弹窗 */
.success-content {
  text-align: center;
  padding: 20px 0;
}
.success-icon {
  font-size: 48px;
  color: #67c23a;
}
</style>
