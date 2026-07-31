export function confirmAction(message, title = '确认', options = {}) {
  return ElMessageBox.confirm(message, title, {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    ...options,
  })
}

export function confirmDelete(message, title = '删除确认', options = {}) {
  return confirmAction(message, title, {
    confirmButtonText: '删除',
    confirmButtonClass: 'el-button--danger',
    ...options,
  })
}

export function isCancelError(error) {
  const message = error?.toString()
  return error === 'cancel' || error === 'close' || message === 'cancel' || message === 'close'
}

/**
 * 选择文件
 * @param {boolean} multiple 是否多选
 * @param {string} accept 可以选择的文件格式
 * @returns {Promise<File[]>}
 */
export async function clickUploadFile(multiple = false, accept = '*') {
  const input = document.createElement('input')
  input.style.display = 'none'
  document.body.appendChild(input)
  input.type = 'file'
  if (multiple) {
    input.multiple = 'multiple'
  }
  if (accept) {
    input.accept = accept
  }
  const removeInput = () => {
    document.body.removeChild(input)
  }
  return new Promise((resolve, reject) => {
    input.click()
    input.onchange = (f) => {
      resolve(f.target.files)
      removeInput()
    }
    const r = (e) => {
      reject(e)
      removeInput()
    }
    input.onerror = r
    input.oncancel = r
    input.onabort = r
  })
}

/**
 * 读取文件内容
 * @param {File} file 文件
 * @param {'readAsText'|'readAsDataURL'|'readAsBinaryString'|'readAsArrayBuffer'} type 读取类型
 * @returns {Promise<Blob | string>}
 */
export function readFile(file, type = 'readAsArrayBuffer') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader[type](file)
  })
}