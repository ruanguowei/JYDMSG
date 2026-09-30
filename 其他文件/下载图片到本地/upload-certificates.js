/**
 * 证书上传脚本
 * 
 * 功能：
 * 1. 扫描入围证书和获奖证书文件夹
 * 2. 解析文件名获取姓名和学校信息
 * 3. 生成证书映射 JSON 数据
 * 
 * 使用方法：
 * 1. 在当前目录运行: node upload-certificates.js
 * 2. 生成 certificate-mapping.json 文件
 * 3. 手动将证书图片上传到云存储
 * 4. 更新 JSON 中的 certificateUrl 为云存储 URL
 * 5. 在微信开发者工具中调用 uploadCertificates 云函数
 */

const fs = require('fs')
const path = require('path')

// 证书根目录
const CERT_ROOT = path.join(__dirname, '大陶展证书')
const SHORTLISTED_DIR = path.join(CERT_ROOT, '入围证书扫描')
const AWARD_DIR = path.join(CERT_ROOT, '获奖证书扫描')

// 云存储路径前缀
const CLOUD_PATH_PREFIX = 'cloud://jdzyzdmsg-5g4rgrjl2008796f.6a64-jdzyzdmsg-5g4rgrjl2008796f-1378111268/大陶展证书'

/**
 * 递归扫描入围证书
 * 结构: 省份/学校/姓名.jpg
 */
function scanShortlistedCertificates() {
  const certificates = []
  
  if (!fs.existsSync(SHORTLISTED_DIR)) {
    console.log('入围证书目录不存在:', SHORTLISTED_DIR)
    return certificates
  }

  // 遍历省份
  const provinces = fs.readdirSync(SHORTLISTED_DIR)
  for (const province of provinces) {
    const provincePath = path.join(SHORTLISTED_DIR, province)
    if (!fs.statSync(provincePath).isDirectory()) continue

    // 遍历学校
    const schools = fs.readdirSync(provincePath)
    for (const school of schools) {
      const schoolPath = path.join(provincePath, school)
      if (!fs.statSync(schoolPath).isDirectory()) continue

      // 遍历证书文件
      const files = fs.readdirSync(schoolPath)
      for (const file of files) {
        if (!file.endsWith('.jpg') && !file.endsWith('.png') && !file.endsWith('.jpeg')) continue
        if (file === 'desktop.ini') continue

        const name = path.parse(file).name // 去掉扩展名
        const localPath = path.join(schoolPath, file)
        const cloudPath = `${CLOUD_PATH_PREFIX}/入围证书扫描/${province}/${school}/${file}`

        certificates.push({
          name: name,
          school: school,
          province: province,
          type: 'shortlisted',
          localPath: localPath,
          certificateUrl: cloudPath
        })
      }
    }
  }

  return certificates
}

/**
 * 扫描获奖证书
 * 结构: 奖项名称/学校 姓名.jpg
 */
function scanAwardCertificates() {
  const certificates = []
  
  if (!fs.existsSync(AWARD_DIR)) {
    console.log('获奖证书目录不存在:', AWARD_DIR)
    return certificates
  }

  // 遍历奖项文件夹
  const awardTypes = fs.readdirSync(AWARD_DIR)
  for (const awardType of awardTypes) {
    const awardPath = path.join(AWARD_DIR, awardType)
    if (!fs.statSync(awardPath).isDirectory()) continue

    // 遍历证书文件
    const files = fs.readdirSync(awardPath)
    for (const file of files) {
      if (!file.endsWith('.jpg') && !file.endsWith('.png') && !file.endsWith('.jpeg')) continue
      if (file === 'desktop.ini') continue

      const baseName = path.parse(file).name // 去掉扩展名
      // 解析 "学校 姓名" 格式
      const parts = baseName.split(' ')
      
      let school = ''
      let name = ''
      
      if (parts.length >= 2) {
        school = parts[0]
        name = parts.slice(1).join(' ') // 姓名可能包含空格（如多人合作）
      } else {
        name = baseName
      }

      const localPath = path.join(awardPath, file)
      const cloudPath = `${CLOUD_PATH_PREFIX}/获奖证书扫描/${awardType}/${file}`

      certificates.push({
        name: name,
        school: school,
        awardType: awardType,
        type: 'award',
        localPath: localPath,
        certificateUrl: cloudPath
      })
    }
  }

  return certificates
}

/**
 * 主函数
 */
function main() {
  console.log('=== 开始扫描证书文件 ===\n')

  // 扫描入围证书
  console.log('正在扫描入围证书...')
  const shortlistedCerts = scanShortlistedCertificates()
  console.log(`找到 ${shortlistedCerts.length} 个入围证书\n`)

  // 扫描获奖证书
  console.log('正在扫描获奖证书...')
  const awardCerts = scanAwardCertificates()
  console.log(`找到 ${awardCerts.length} 个获奖证书\n`)

  // 合并所有证书
  const allCertificates = [...shortlistedCerts, ...awardCerts]

  // 生成统计信息
  const stats = {
    total: allCertificates.length,
    shortlisted: shortlistedCerts.length,
    award: awardCerts.length,
    generatedAt: new Date().toISOString()
  }

  // 输出结果
  const output = {
    stats: stats,
    certificates: allCertificates
  }

  // 保存到 JSON 文件
  const outputPath = path.join(__dirname, 'certificate-mapping.json')
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`✅ 证书映射已保存到: ${outputPath}`)

  // 生成云函数调用数据（只包含必要字段）
  const cloudFunctionData = {
    certificates: allCertificates.map(cert => ({
      name: cert.name,
      school: cert.school,
      certificateUrl: cert.certificateUrl,
      type: cert.type
    }))
  }

  const cloudDataPath = path.join(__dirname, 'cloud-function-data.json')
  fs.writeFileSync(cloudDataPath, JSON.stringify(cloudFunctionData, null, 2), 'utf-8')
  console.log(`✅ 云函数调用数据已保存到: ${cloudDataPath}`)

  // 打印摘要
  console.log('\n=== 摘要 ===')
  console.log(`入围证书: ${stats.shortlisted} 个`)
  console.log(`获奖证书: ${stats.award} 个`)
  console.log(`总计: ${stats.total} 个`)

  // 打印前几条示例
  console.log('\n=== 入围证书示例 (前3条) ===')
  shortlistedCerts.slice(0, 3).forEach((cert, i) => {
    console.log(`${i + 1}. ${cert.name} - ${cert.school} (${cert.province})`)
  })

  console.log('\n=== 获奖证书示例 (前3条) ===')
  awardCerts.slice(0, 3).forEach((cert, i) => {
    console.log(`${i + 1}. ${cert.name} - ${cert.school} (${cert.awardType})`)
  })

  console.log('\n=== 下一步操作 ===')
  console.log('1. 将 "大陶展证书" 文件夹上传到微信云存储')
  console.log('2. 确保云存储路径为: ' + CLOUD_PATH_PREFIX)
  console.log('3. 上传 uploadCertificates 云函数')
  console.log('4. 在云函数测试中，使用 cloud-function-data.json 的内容调用云函数')
}

main()
