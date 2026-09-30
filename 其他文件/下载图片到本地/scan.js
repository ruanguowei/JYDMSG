/**
 * 简单的证书文件夹扫描脚本
 * 运行: node scan.js
 */
const fs = require('fs')
const path = require('path')

const CLOUD_PREFIX = 'cloud://jdzyzdmsg-5g4rgrjl2008796f.6a64-jdzyzdmsg-5g4rgrjl2008796f-1378111268/证书/第二届/大陶展证书'

const result = { shortlisted: [], award: [] }

// 扫描入围证书: 入围证书扫描/省份/学校/姓名.jpg
const shortlistedPath = path.join(__dirname, '大陶展证书', '入围证书扫描')
if (fs.existsSync(shortlistedPath)) {
  const provinces = fs.readdirSync(shortlistedPath).filter(f => fs.statSync(path.join(shortlistedPath, f)).isDirectory())
  console.log('入围证书省份:', provinces)
  
  for (const province of provinces) {
    const schools = fs.readdirSync(path.join(shortlistedPath, province)).filter(f => fs.statSync(path.join(shortlistedPath, province, f)).isDirectory())
    for (const school of schools) {
      const files = fs.readdirSync(path.join(shortlistedPath, province, school)).filter(f => /\.(jpg|png|jpeg)$/i.test(f))
      for (const file of files) {
        const name = path.basename(file, path.extname(file))
        result.shortlisted.push({
          province, school, name, fileName: file,
          fileID: `${CLOUD_PREFIX}/入围证书扫描/${province}/${school}/${file}`
        })
      }
    }
  }
}

// 扫描获奖证书: 获奖证书扫描/奖项/学校 姓名.jpg
const awardPath = path.join(__dirname, '大陶展证书', '获奖证书扫描')
if (fs.existsSync(awardPath)) {
  const awardFolders = fs.readdirSync(awardPath).filter(f => fs.statSync(path.join(awardPath, f)).isDirectory())
  console.log('获奖证书文件夹:', awardFolders)
  
  for (const awardFolder of awardFolders) {
    const files = fs.readdirSync(path.join(awardPath, awardFolder)).filter(f => /\.(jpg|png|jpeg)$/i.test(f))
    for (const file of files) {
      const baseName = path.basename(file, path.extname(file))
      const parts = baseName.split(' ')
      const name = parts.length >= 2 ? parts[parts.length - 1] : baseName
      const school = parts.length >= 2 ? parts.slice(0, -1).join(' ') : ''
      result.award.push({
        awardFolder, school, name, fileName: file,
        fileID: `${CLOUD_PREFIX}/获奖证书扫描/${awardFolder}/${file}`
      })
    }
  }
}

console.log(`\n入围证书: ${result.shortlisted.length} 个`)
console.log(`获奖证书: ${result.award.length} 个`)

// 保存结果
fs.writeFileSync('certificate_list.json', JSON.stringify(result, null, 2), 'utf8')
console.log('\n已保存到 certificate_list.json')
