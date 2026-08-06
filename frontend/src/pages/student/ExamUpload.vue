<template>
  <div class="exam-upload">
    <el-affix>
      <div class="upload-header">
        <h2>📷 拍照上传答案</h2>
        <p class="hint">拍摄或上传你的解题过程图片，支持多道题分别上传</p>
      </div>
    </el-affix>

    <!-- 题目列表 -->
    <div v-for="(q, i) in questions" :key="q.id" class="question-upload-block">
      <div class="question-title">
        <span class="q-num">{{ i + 1 }}.</span>
        <el-tag size="small">{{ typeLabel(q.type) }}</el-tag>
        <MathText :text="q.stem" />
      </div>

      <!-- 已上传的图片预览 -->
      <div v-if="answers[q.id]?.length" class="uploaded-preview">
        <div v-for="(img, idx) in answers[q.id]" :key="idx" class="preview-item">
          <img :src="img" :alt="`${i + 1}题答案${idx + 1}`" />
          <div class="preview-actions">
            <el-button size="small" type="danger" :icon="Delete" circle @click="removeImage(q.id, idx)" />
          </div>
        </div>
      </div>

      <!-- 上传区域 -->
      <div class="upload-area">
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept="image/*,.pdf"
          :on-change="(file) => handleFileChange(file, q.id)"
          :before-upload="() => false"
          multiple
        >
          <div class="upload-trigger">
            <el-icon class="upload-icon"><Camera /></el-icon>
            <div class="upload-text">
              <span>点击拍照或选择图片/PDF</span>
              <span class="upload-sub">支持 JPG / PNG / PDF，单题可传多张</span>
            </div>
          </div>
        </el-upload>

        <!-- 拍照按钮（移动端调用摄像头） -->
        <div class="camera-actions">
          <label :for="`camera-${q.id}`" class="camera-btn">
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

          <label :id="`file-${q.id}`" class="file-btn" @click="triggerFileInput(q.id)">
            <el-icon><FolderOpened /></el-icon>
            <span>从相册选择</span>
          </label>
          <input
            :id="`file-input-${q.id}`"
            type="file"
            accept="image/*,.pdf"
            multiple
            hidden
            @change="(e) => handleFileSelect(e, q.id)"
          />
        </div>
      </div>
    </div>

    <!-- 全局操作 -->
    <div class="submit-section">
      <el-button type="primary" size="large" @click="submitAnswers" :loading="submitting" class="submit-btn">
        {{ submitting ? '提交中…' : '提交答案' }}
      </el-button>
      <p class="submit-hint">共 {{ totalUploaded }} 张图片，{{ answeredCount }} / {{ questions.length }} 题已上传</p>
    </div>

    <!-- 提交成功提示 -->
    <el-dialog v-model="successDialog" title="提交成功" width="360px" center>
      <div class="success-content">
        <el-icon class="success-icon"><CircleCheckFilled /></el-icon>
        <p>答案已提交，共 {{ totalUploaded }} 张图片</p>
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
import { Camera, FolderOpened, Delete, CircleCheckFilled } from '@element-plus/icons-vue'
import { exams, questions as allQuestions } from '@/mock/data'
import MathText from '@/components/MathText.vue'

const route = useRoute()
const router = useRouter()

const exam = exams.find(e => e.id === Number(route.params.id)) || exams[0]
const questions = allQuestions.filter(q => exam.questionIds.includes(q.id))
const answers = reactive({})  // { questionId: [base64img1, base64img2, ...] }
const submitting = ref(false)
const successDialog = ref(false)

const typeMap = { single: '单选', multiple: '多选', judge: '判断', blank: '填空', essay: '简答' }
function typeLabel(t) { return typeMap[t] || t }

// 初始化每道题的答案数组
questions.forEach(q => {
  if (!answers[q.id]) answers[q.id] = []
})

const totalUploaded = computed(() =>
  Object.values(answers).reduce((sum, imgs) => sum + imgs.length, 0)
)
const answeredCount = computed(() =>
  Object.values(answers).filter(imgs => imgs.length > 0).length
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

// 处理文件选择（拖拽/点击上传）
async function handleFileChange(file, questionId) {
  try {
    const base64 = await fileToBase64(file)
    answers[questionId].push(base64)
    ElMessage.success('图片已添加')
  } catch {
    ElMessage.error('图片读取失败')
  }
}

// 拍照捕获
async function handleCapture(event, questionId) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const base64 = await fileToBase64(file)
    answers[questionId].push(base64)
    ElMessage.success('拍照成功')
  } catch {
    ElMessage.error('拍照处理失败')
  }
  event.target.value = ''  // 允许重复拍照同一题
}

// 从相册选择
async function handleFileSelect(event, questionId) {
  const files = Array.from(event.target.files || [])
  for (const file of files) {
    try {
      const base64 = await fileToBase64(file)
      answers[questionId].push(base64)
    } catch {
      ElMessage.error('图片读取失败')
    }
  }
  if (files.length) ElMessage.success(`已添加 ${files.length} 张图片`)
  event.target.value = ''
}

function triggerFileInput(questionId) {
  document.getElementById(`file-input-${questionId}`)?.click()
}

// 删除已上传的图片
function removeImage(questionId, idx) {
  answers[questionId].splice(idx, 1)
}

// 提交答案
async function submitAnswers() {
  if (!totalUploaded.value) {
    ElMessage.warning('请至少上传一张答案图片')
    return
  }
  submitting.value = true
  try {
    // 保存到 localStorage（模拟提交）
    const submission = {
      examId: exam.id,
      studentName: '当前学生',
      submittedAt: new Date().toLocaleString('zh-CN'),
      answers: { ...answers },
      imageCount: totalUploaded.value
    }
    const existing = JSON.parse(localStorage.getItem('submissions') || '[]')
    existing.push(submission)
    localStorage.setItem('submissions', JSON.stringify(existing))

    // 同时保存到 answers 格式兼容教师端查看
    questions.forEach(q => {
      if (answers[q.id]?.length) {
        // 简答题答案设为图片数量标记
        if (q.type === 'essay' || q.type === 'blank') {
          q._imageAnswer = answers[q.id]
        }
      }
    })

    successDialog.value = true
  } catch (e) {
    ElMessage.error('提交失败：' + e.message)
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
  padding-bottom: 100px;
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

/* 已上传预览 */
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
.upload-trigger {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px;
}
.upload-icon {
  font-size: 36px;
  color: #909399;
}
.upload-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #606266;
  font-size: 14px;
}
.upload-sub {
  font-size: 12px;
  color: #c0c4cc;
}

/* 拍照/相册按钮 */
.camera-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
}
.camera-btn,
.file-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  background: #f5f7fa;
  color: #606266;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.camera-btn:hover,
.file-btn:hover {
  background: #e6f0ff;
  color: #409eff;
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
