// 云函数入口文件 - 更新参展申请
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
    
    // 检查必要的ID字段
    if(!submissionData.submissionId) {
      return {
        success: false,
        errMsg: '缺少申请ID'
      }
    }
    
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
    
    // 先检查记录是否存在以及权限
    const checkResult = await db.collection('pottery_submissions')
      .doc(submissionData.submissionId)
      .get();
      
    if (!checkResult.data) {
      return {
        success: false,
        errMsg: '申请记录不存在'
      };
    }
    
    // 验证当前用户是否有权限修改此记录
    if (checkResult.data._openid !== wxContext.OPENID) {
      return {
        success: false,
        errMsg: '无权修改此申请记录'
      };
    }
    
    // 更新记录
    const result = await db.collection('pottery_submissions')
      .doc(submissionData.submissionId)
      .update({
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
          
          // 更新状态
          updatedAt: db.serverDate(),
          status: 'pending' // 修改后重置为待审核状态
        }
      });
    
    return {
      success: true,
      data: {
        updated: result.stats.updated
      }
    }
  } catch (error) {
    console.error('更新参展申请失败', error)
    return {
      success: false,
      errMsg: '更新参展申请失败：' + error.message
    }
  }
} 