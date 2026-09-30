// 云函数入口文件
const cloud = require('wx-server-sdk')
const { publicEdition, resolveEdition } = require('../common/edition')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const edition = await resolveEdition(db, {
      editionId: event.editionId,
      useCurrent: !event.editionId,
      mode: 'read'
    })
    const controls = edition.runtimeControls || {}
    const hasEditionControls = Boolean(edition.runtimeControls)

    // 旧 timeLimit 只作为历史兼容兜底；新届次优先使用 edition_controls 的年度时间。
    const res = await db.collection('timeLimit').limit(1).get()
    const timeLimit = (res.data && res.data[0]) || null
    const data = {
      deliveryBeginTime: controls.deliveryStartAt || (!hasEditionControls && timeLimit && timeLimit.deliveryBeginTime) || '',
      deliveryEndTime: controls.deliveryEndAt || (!hasEditionControls && timeLimit && timeLimit.deliveryEndTime) || '',
      submissionBeginDeadline: controls.registrationStartAt || (!hasEditionControls && timeLimit && timeLimit.submissionBeginDeadline) || '',
      submissionEndDeadline: controls.registrationEndAt || (!hasEditionControls && timeLimit && timeLimit.submissionEndDeadline) || '',
      note: controls.note || (timeLimit && timeLimit.note) || ''
    }

    if (!data.deliveryBeginTime && !data.deliveryEndTime && !data.submissionBeginDeadline && !data.submissionEndDeadline) {
      return {
        success: true,
        data: null,
        message: '未配置当前届次的报名或送件时间'
      }
    }

    return {
      success: true,
      edition: publicEdition(edition),
      data
    }
  } catch (e) {
    console.error('获取作品运送时间限制失败', e)
    return {
      success: false,
      message: '获取作品运送时间限制失败'
    }
  }
}
