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
      'workType', 'artworkName', 'createYear', 'category', 'artworkDescription'
    ]
    
    // 根据作品类型添加特定必填字段
    if(submissionData.workType === 'regular') {
      requiredFields.push('craftMaterial');
    }
    
    for(const field of requiredFields) {
      if(!submissionData[field]) {
        return {
          success: false,
          errMsg: `${field} 字段是必填的`
        }
      }
    }
    
    // 根据作品类型进行不同的验证
    if(submissionData.workType === 'regular') {
      // 常规作品：检查作品尺寸
      if(!submissionData.dimensions || !Array.isArray(submissionData.dimensions) || submissionData.dimensions.length === 0) {
        return {
          success: false,
          errMsg: '作品尺寸必须完整填写'
        }
      }
      
      // 检查至少有一组完整的尺寸数据
      const hasValidDimensions = submissionData.dimensions.some(dim => 
        dim.length && dim.width && dim.height
      );
      if(!hasValidDimensions) {
        return {
          success: false,
          errMsg: '至少需要完整填写一组作品尺寸'
        }
      }
      
      // 检查分类图片
      if(!submissionData.perspectiveImage) {
        return {
          success: false,
          errMsg: '请上传透视图'
        }
      }
      
      if(!submissionData.fourViewImages || submissionData.fourViewImages.length === 0) {
        return {
          success: false,
          errMsg: '请至少上传一张四面图'
        }
      }
      
      if(!submissionData.detailImages || submissionData.detailImages.length === 0) {
        return {
          success: false,
          errMsg: '请至少上传一张局部图'
        }
      }
    } else if(submissionData.workType === 'video') {
      // 视频作品：检查视频相关字段
      const videoRequiredFields = [
        'videoDuration', 'videoResolution', 'videoAspectRatio', 
        'shootingTechnique', 'baiduCloudLink', 'baiduCloudPassword'
      ];
      
      for(const field of videoRequiredFields) {
        if(!submissionData[field]) {
          return {
            success: false,
            errMsg: `视频作品必须填写${field}字段`
          }
        }
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
    
    // 转换图片链接为HTTPS格式
    const convertImageLinks = async (imageData) => {
      if (!imageData) return '';
      
      // 如果是cloud://格式，转换为HTTPS
      if (typeof imageData === 'string' && imageData.startsWith('cloud://')) {
        try {
          const result = await cloud.getTempFileURL({
            fileList: [imageData]
          });
          return result.fileList[0]?.tempFileURL || imageData;
        } catch (error) {
          console.error('转换图片链接失败:', error);
          return imageData;
        }
      }
      
      return imageData;
    };
    
    const convertImageArray = async (imageArray) => {
      if (!Array.isArray(imageArray) || imageArray.length === 0) return [];
      
      const cloudImages = imageArray.filter(img => img && img.startsWith('cloud://'));
      if (cloudImages.length === 0) return imageArray;
      
      try {
        const result = await cloud.getTempFileURL({
          fileList: cloudImages
        });
        
        // 创建映射表
        const urlMap = {};
        result.fileList.forEach(item => {
          urlMap[item.fileID] = item.tempFileURL;
        });
        
        // 替换cloud://链接为HTTPS链接
        return imageArray.map(img => {
          if (img && img.startsWith('cloud://')) {
            return urlMap[img] || img;
          }
          return img;
        });
      } catch (error) {
        console.error('转换图片数组失败:', error);
        return imageArray;
      }
    };
    
    // 转换所有图片链接
    const convertedPhotoUrl = await convertImageLinks(submissionData.photoUrl);
    const convertedPerspectiveImage = await convertImageLinks(submissionData.perspectiveImage);
    const convertedFourViewImages = await convertImageArray(submissionData.fourViewImages || []);
    const convertedDetailImages = await convertImageArray(submissionData.detailImages || []);
    
    // 更新记录
    const result = await db.collection('pottery_submissions')
      .doc(submissionData.submissionId)
      .update({
        data: {
          // 个人信息
          name: submissionData.name,
          gender: submissionData.gender,
          school: submissionData.school,
          schoolProvinces: submissionData.schoolProvinces,
          grade: submissionData.grade,
          birthDate: submissionData.birthDate,
          major: submissionData.major,
          phone: submissionData.phone,
          email: submissionData.email,
          idNumber: submissionData.idNumber,
          teacher: submissionData.teacher,
          teacherPhone: submissionData.teacherPhone,
          address: submissionData.address,
          photoUrl: convertedPhotoUrl,
          
          // 作品信息
          workType: submissionData.workType,
          artworkName: submissionData.artworkName,
          createYear: submissionData.createYear,
          dimensions: submissionData.dimensions,
          category: submissionData.category,
          craftMaterial: submissionData.craftMaterial,
          artworkDescription: submissionData.artworkDescription,
          // 分类图片（已转换为HTTPS）
          perspectiveImage: convertedPerspectiveImage,
          fourViewImages: convertedFourViewImages,
          detailImages: convertedDetailImages,
          specialDisplay: submissionData.specialDisplay || '',
          // 视频作品字段
          videoDuration: submissionData.videoDuration || '',
          videoResolution: submissionData.videoResolution || '',
          videoAspectRatio: submissionData.videoAspectRatio || '',
          shootingTechnique: submissionData.shootingTechnique || '',
          baiduCloudLink: submissionData.baiduCloudLink || '',
          baiduCloudPassword: submissionData.baiduCloudPassword || '',
          
          // 更新状态
          updatedAt: Date.now(),
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