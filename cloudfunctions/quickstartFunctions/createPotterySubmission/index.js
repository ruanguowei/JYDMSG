// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  
  try {
    // 获取提交的申请数据
    const submissionData = event.data || {}
    
    // 检查必填字段
    const requiredFields = [
      'name', 'gender', 'school', 'grade', 'birthDate', 'major', 
      'phone', 'email', 'idNumber', 'teacher', 'teacherPhone', 'address', 'photoUrl',
      'artworkName', 'createYear', 'category', 'craftMaterial', 'artworkDescription'
    ]
    
    for(const field of requiredFields) {
      if(!submissionData[field]) {
        return {
          success: false,
          errMsg: `${field} 字段是必填的`
        }
      }
    }
    
    // 检查作品尺寸
    if(!submissionData.dimensions || !submissionData.dimensions.length || !submissionData.dimensions.width || !submissionData.dimensions.height) {
      return {
        success: false,
        errMsg: '作品尺寸必须完整填写'
      }
    }
    
    // 检查作品图片
    if(!submissionData.artworkImages || submissionData.artworkImages.length === 0) {
      return {
        success: false,
        errMsg: '至少需要上传一张作品照片'
      }
    }
    
    // 保存到数据库
    const result = await db.collection('pottery_submissions').add({
      data: {
        // 个人信息
        name: submissionData.name,
        gender: submissionData.gender,
        school: submissionData.school,
        grade: submissionData.grade,
        birthDate: submissionData.birthDate,
        major: submissionData.major,
        phone: submissionData.phone,
        email: submissionData.email,
        idNumber: submissionData.idNumber,
        teacher: submissionData.teacher,
        teacherPhone: submissionData.teacherPhone,
        address: submissionData.address,
        photoUrl: submissionData.photoUrl,
        
        // 作品信息
        artworkName: submissionData.artworkName,
        createYear: submissionData.createYear,
        dimensions: submissionData.dimensions,
        category: submissionData.category,
        craftMaterial: submissionData.craftMaterial,
        artworkDescription: submissionData.artworkDescription,
        artworkImages: submissionData.artworkImages,
        
        // 状态信息
        _openid: wxContext.OPENID,
        status: 'pending', // 审核状态：pending（待审核）, approved（已通过）, rejected（已拒绝）
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })
    
    return {
      success: true,
      data: {
        submissionId: result._id
      }
    }
  } catch (error) {
    console.error('创建参展申请失败', error)
    return {
      success: false,
      errMsg: '创建参展申请失败：' + error.message
    }
  }
} 