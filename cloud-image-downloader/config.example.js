/**
 * 配置文件示例
 * 复制此文件为 config.js 并填入您的实际配置
 */

module.exports = {
  // 微信云开发环境ID
  envId: 'your-env-id-here',
  
  // 输出目录
  outputDir: './downloaded_images',
  
  // 下载超时时间（毫秒）
  downloadTimeout: 30000,
  
  // 并发下载数量
  concurrency: 5,
  
  // 是否生成详细日志
  verbose: true,
  
  // 文件命名规则
  naming: {
    // 是否保留原始文件名
    keepOriginalName: false,
    // 文件名前缀
    prefix: '',
    // 是否添加序号
    addIndex: true
  }
};
