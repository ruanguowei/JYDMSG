/**
 * 扫描本地证书文件夹，生成文件索引JSON
 * 运行方式: node scan-certificates.js
 * 输出: certificate_files.json
 */

const fs = require('fs')
const path = require('path')

// 本地证书文件夹路径 - 相对于当前脚本位置
const CERT_LOCAL_PATH = path.join(__dirname, '下载图片到本地', '大陶展证书')

// 如果上面路径不存在，尝试当前目录下的大陶展证书
const ALT_PATH = path.join(__dirname, '大陶展证书')

// 云存储路径前缀
const CLOUD_PREFIX = 'cloud://jdzyzdmsg-5g4rgrjl2008796f.6a64-jdzyzdmsg-5g4rgrjl2008796f-1378111268/证书/第二届/大陶展证书'

// 存储结果
const results = {
  folderStructure: {
    shortlisted: {},  // 入围证书文件夹结构
    award: {}         // 获奖证书文件夹结构
  },
  files: []           // 所有文件列表
}

/**
 * 扫描入围证书
 * 结构: 入围证书扫描/省份/学校/姓名.jpg
 */
function scanShortlistedCertificates() {
  const basePath = path.join(CERT_LOCAL_PATH, '入围证书扫描')
  
  if (!fs.existsSync(basePath)) {
    console.log('入围证书文件夹不存在:', basePath)
    return
  }
  
  console.log('\n=== 扫描入围证书 ===')
  console.log('路径:', basePath)
  
  // 遍历省份
  const provinces = fs.readdirSync(basePath).filter(f => {
    return fs.statSync(path.join(basePath, f)).isDirectory()
  })
  
  console.log(`发现 ${provinces.length} 个省份文件夹:`)
  provinces.forEach(p => console.log(`  - ${p}`))
  
  results.folderStructure.shortlisted.provinces = provinces
  results.folderStructure.shortlisted.schools = {}
  
  for (const province of provinces) {
    const provincePath = path.join(basePath, province)
    
    // 遍历学校
    const schools = fs.readdirSync(provincePath).filter(f => {
      return fs.statSync(path.join(provincePath, f)).isDirectory()
    })
    
    results.folderStructure.shortlisted.schools[province] = schools
    
    for (const school of schools) {
      const schoolPath = path.join(provincePath, school)
      
      // 遍历证书文件
      const files = fs.readdirSync(schoolPath).filter(f => {
        return f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg')
      })
      
      for (const file of files) {
        // 提取姓名 (去掉扩展名)
        const name = path.basename(file, path.extname(file))
        
        // 构建云存储URL
        const cloudPath = `${CLOUD_PREFIX}/入围证书扫描/${province}/${school}/${file}`
        
        results.files.push({
          type: 'shortlisted',
          province: province,
          school: school,
          name: name,
          fileName: file,
          fileID: cloudPath
        })
      }
    }
  }
  
  const shortlistedCount = results.files.filter(f => f.type === 'shortlisted').length
  console.log(`\n入围证书总计: ${shortlistedCount} 个`)
}

/**
 * 扫描获奖证书
 * 结构: 获奖证书扫描/奖项名称/学校 姓名.jpg
 */
function scanAwardCertificates() {
  const basePath = path.join(CERT_LOCAL_PATH, '获奖证书扫描')
  
  if (!fs.existsSync(basePath)) {
    console.log('获奖证书文件夹不存在:', basePath)
    return
  }
  
  console.log('\n=== 扫描获奖证书 ===')
  console.log('路径:', basePath)
  
  // 遍历奖项文件夹
  const awardFolders = fs.readdirSync(basePath).filter(f => {
    return fs.statSync(path.join(basePath, f)).isDirectory()
  })
  
  console.log(`发现 ${awardFolders.length} 个奖项文件夹:`)
  awardFolders.forEach(a => console.log(`  - ${a}`))
  
  results.folderStructure.award.categories = awardFolders
  
  for (const awardFolder of awardFolders) {
    const awardPath = path.join(basePath, awardFolder)
    
    // 遍历证书文件
    const files = fs.readdirSync(awardPath).filter(f => {
      return f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg')
    })
    
    for (const file of files) {
      // 解析文件名: "学校 姓名.jpg"
      const baseName = path.basename(file, path.extname(file))
      const parts = baseName.split(' ')
      
      let school = ''
      let name = ''
      
      if (parts.length >= 2) {
        // 最后一个部分是姓名，前面的都是学校名
        name = parts[parts.length - 1]
        school = parts.slice(0, -1).join(' ')
      } else {
        name = baseName
      }
      
      // 构建云存储URL
      const cloudPath = `${CLOUD_PREFIX}/获奖证书扫描/${awardFolder}/${file}`
      
      results.files.push({
        type: 'award',
        awardCategory: awardFolder,
        school: school,
        name: name,
        fileName: file,
        fileID: cloudPath
      })
    }
  }
  
  const awardCount = results.files.filter(f => f.type === 'award').length
  console.log(`\n获奖证书总计: ${awardCount} 个`)
}

/**
 * 主函数
 */
function main() {
  console.log('========================================')
  console.log('证书文件扫描工具')
  console.log('========================================')
  
  // 尝试多个可能的路径
  let certPath = CERT_LOCAL_PATH
  if (!fs.existsSync(certPath)) {
    certPath = ALT_PATH
  }
  if (!fs.existsSync(certPath)) {
    // 尝试当前工作目录
    certPath = path.join(process.cwd(), '大陶展证书')
  }
  
  console.log('扫描路径:', certPath)
  
  if (!fs.existsSync(certPath)) {
    console.error('错误: 证书文件夹不存在!')
    console.error('请在包含"大陶展证书"文件夹的目录下运行此脚本')
    console.error('或者修改脚本中的 CERT_LOCAL_PATH 变量')
    return
  }
  
  // 更新全局路径
  global.ACTUAL_CERT_PATH = certPath
  
  // 扫描入围证书
  scanShortlistedCertificates()
  
  // 扫描获奖证书
  scanAwardCertificates()
  
  // 输出统计
  console.log('\n========================================')
  console.log('扫描完成!')
  console.log('========================================')
  console.log(`入围证书: ${results.files.filter(f => f.type === 'shortlisted').length} 个`)
  console.log(`获奖证书: ${results.files.filter(f => f.type === 'award').length} 个`)
  console.log(`总计: ${results.files.length} 个`)
  
  // 保存文件夹结构
  const structureFile = path.join(__dirname, 'certificate_folder_structure.json')
  fs.writeFileSync(structureFile, JSON.stringify(results.folderStructure, null, 2), 'utf8')
  console.log(`\n文件夹结构已保存到: ${structureFile}`)
  
  // 保存文件列表 (用于导入数据库)
  const filesFile = path.join(__dirname, 'certificate_files.json')
  fs.writeFileSync(filesFile, JSON.stringify(results.files, null, 2), 'utf8')
  console.log(`文件列表已保存到: ${filesFile}`)
  
  // 生成数据库导入格式
  const dbImportFile = path.join(__dirname, 'certificate_files_db_import.json')
  const dbImportData = results.files.map(f => JSON.stringify(f)).join('\n')
  fs.writeFileSync(dbImportFile, dbImportData, 'utf8')
  console.log(`数据库导入文件已保存到: ${dbImportFile}`)
  console.log('(每行一条JSON，可直接导入云数据库 certificate_files 集合)')
}

main()
