// 独立云函数：批量生成 appointments 测试数据（1000条）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const totalCount = 1000
    console.log('=== 开始生成预约测试数据 ===')
    console.log('目标总数:', totalCount)

    // 可用时段
    const timeSlots = [
      '09:00-10:00', '10:00-11:00', '11:00-12:00',
      '14:00-15:00', '15:00-16:00', '16:00-17:00'
    ]

    // 姓氏和名字
    const firstNames = ['张', '王', '李', '刘', '陈', '杨', '黄', '赵', '周', '吴',
      '徐', '孙', '马', '胡', '朱', '郭', '何', '林', '罗', '高']
    const lastNames = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军',
      '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '霞', '平',
      '刚', '桂英', '华', '飞', '玉兰', '萍', '红', '玉珍', '凤英', '志强']

    // 来访事由
    const reasons = [
      '参观陶瓷展览',
      '学术交流访问',
      '团体参观学习',
      '艺术创作考察',
      '陶瓷文化研究',
      '摄影采风',
      '学校组织参观',
      '个人兴趣参观',
      '商务考察洽谈',
      '媒体采访拍摄',
      '亲子教育活动',
      '课题调研',
      '朋友推荐来访',
      '文化交流活动',
      '毕业设计调研'
    ]

    // 生成2025年1月1日到1月27日之间的可用日期（跳过周一）
    const availableDates = []
    for (let day = 1; day <= 27; day++) {
      const date = new Date(2025, 0, day) // 月份从0开始
      if (date.getDay() !== 1) { // 跳过周一
        availableDates.push(day)
      }
    }
    console.log('可用日期数量:', availableDates.length, '天')

    // 简单的伪随机函数（基于种子，保证可复现）
    let seed = 42
    function random() {
      seed = (seed * 16807 + 0) % 2147483647
      return seed / 2147483647
    }

    // 生成所有记录
    const records = []
    for (let i = 0; i < totalCount; i++) {
      const day = availableDates[Math.floor(random() * availableDates.length)]
      const time = timeSlots[Math.floor(random() * timeSlots.length)]
      const firstName = firstNames[Math.floor(random() * firstNames.length)]
      const lastName = lastNames[Math.floor(random() * lastNames.length)]
      const reason = reasons[Math.floor(random() * reasons.length)]
      const visitors = Math.floor(random() * 20) + 1 // 1-20人

      // 生成手机号：1[3-9]开头 + 9位随机数字
      const phonePrefix = '1' + String(3 + Math.floor(random() * 7))
      let phoneSuffix = ''
      for (let j = 0; j < 9; j++) {
        phoneSuffix += String(Math.floor(random() * 10))
      }
      const phone = phonePrefix + phoneSuffix

      // 状态分布：80% approved, 10% pending, 10% rejected
      let status = 'approved'
      const statusRand = random()
      if (statusRand > 0.9) {
        status = 'rejected'
      } else if (statusRand > 0.8) {
        status = 'pending'
      }

      // 模拟openid
      const openid = 'test_openid_' + String(i).padStart(4, '0')

      records.push({
        _openid: openid,
        date: `2025-1-${day}`,
        time: time,
        reason: reason,
        reservationName: firstName + lastName,
        reservationPhone: phone,
        visitors: visitors,
        status: status,
        createTime: db.serverDate(),
        _isTestData: true
      })
    }

    console.log('准备插入数据，总数:', records.length)

    // 分批插入（每批100条）
    const batchSize = 100
    let insertedCount = 0

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      const promises = batch.map(record =>
        db.collection('appointments').add({ data: record })
      )
      await Promise.all(promises)
      insertedCount += batch.length
      console.log(`已插入 ${insertedCount}/${records.length} 条预约`)
    }

    console.log('=== 预约测试数据生成完成 ===')

    return {
      success: true,
      message: '预约测试数据生成成功',
      data: {
        totalInserted: insertedCount,
        dateRange: '2025-01-01 ~ 2025-01-27',
        availableDays: availableDates.length
      }
    }

  } catch (error) {
    console.error('生成预约测试数据失败:', error)
    return {
      success: false,
      message: '生成预约测试数据失败',
      error: error.message
    }
  }
}
