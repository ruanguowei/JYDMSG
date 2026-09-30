// 云函数入口文件
const cloud = require('wx-server-sdk')
const {
  buildEditionFields,
  collectionName,
  generateWorkCode,
  publicEdition,
  resolveEdition
} = require('../common/edition')
const { normalizeVideoMeta, validateVideoMeta, validateBaiduCloudBackup } = require('../common/video')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const submissionOpenId = wxContext.OPENID
  const db = cloud.database()
  
  try {
    const edition = await resolveEdition(db, {
      editionId: event.editionId || (event.data && event.data.editionId),
      useCurrent: !(event.editionId || (event.data && event.data.editionId)),
      mode: 'write'
    })
    const submissionsCollection = collectionName(edition, 'submissions')

    // 防止重复提交：先检查用户是否已经提交过
    const existingSubmissions = await db.collection(submissionsCollection)
      .where({ _openid: submissionOpenId })
      .count()
    
    if (existingSubmissions.total > 0) {
      console.log(`用户 ${submissionOpenId} 已有 ${existingSubmissions.total} 条提交记录，拒绝重复创建`)
      return {
        success: false,
        errMsg: '您已经提交过作品申请，如需修改请使用修改功能。如有疑问请联系管理员。'
      }
    }
    
    // 获取提交的申请数据
    const submissionData = event.data || {}
    
    // 检查必填字段
    const requiredFields = [
      'name', 'gender', 'school', 'schoolProvinces', 'grade', 'birthDate', 'major', 
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
    }
    
    // 根据作品类型进行不同的验证
    if(submissionData.workType === 'regular') {
      // 常规作品：检查分类图片
      if(!submissionData.perspectiveImage) {
        return {
          success: false,
          errMsg: '请上传透视图'
        }
      }
      
      if(!submissionData.fourViewImages || submissionData.fourViewImages.length !== 3 || submissionData.fourViewImages.some(item => !item)) {
        return {
          success: false,
          errMsg: '请按要求上传正面、右侧和背面共3张作品图片'
        }
      }
      
      if(!submissionData.detailImages || submissionData.detailImages.length !== 3 || submissionData.detailImages.some(item => !item)) {
        return {
          success: false,
          errMsg: '请按要求上传左侧、顶部／底部和局部细节共3张作品图片'
        }
      }
    } else if(submissionData.workType === 'video') {
      const hasDirectVideo = Boolean(submissionData.video && (submissionData.video.fileId || submissionData.video.fileName || submissionData.video.sizeBytes));
      const baiduBackup = validateBaiduCloudBackup(submissionData.baiduCloudLink, submissionData.baiduCloudPassword);
      if (!hasDirectVideo && !baiduBackup.ok) {
        return {
          success: false,
          errMsg: baiduBackup.errors[0] || '请上传 MP4 视频或填写百度网盘链接及提取码'
        }
      }
      if (hasDirectVideo) {
        const videoValidation = validateVideoMeta(submissionData.video, { required: true });
        if (!videoValidation.ok) {
          return { success: false, errMsg: videoValidation.errors[0] }
        }
      }
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
    const workCode = await generateWorkCode(db, edition, submissionData.category);
    const videoMeta = submissionData.workType === 'video'
      ? normalizeVideoMeta(submissionData.video)
      : normalizeVideoMeta();

    // 保存到数据库
    const result = await db.collection(submissionsCollection).add({
      data: {
        ...buildEditionFields(edition),
        workCode,
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
        video: videoMeta,
        
        // 状态信息
        _openid: submissionOpenId,
        status: 'pending', // 审核状态：pending（待审核）, approved（已通过）, rejected（已拒绝）
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    })
    
    return {
      success: true,
      edition: publicEdition(edition),
      data: {
        submissionId: result._id,
        workCode
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
