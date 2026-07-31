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
