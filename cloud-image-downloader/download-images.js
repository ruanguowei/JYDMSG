#!/usr/bin/env node

const WeChatCloudDownloader = require('./wechat-cloud-downloader');
const path = require('path');

/**
 * 简化的使用脚本
 * 使用方法: node download-images.js [输入文件] [输出文件] [环境ID]
 */

async function main() {
  // 获取命令行参数
  const args = process.argv.slice(2);
  const inputFile = args[0] || './database_export.json';
  const outputFile = args[1] || './database_with_local_images.json';
  const envId = args[2] || process.env.WECHAT_CLOUD_ENV_ID;

  // 检查环境ID
  if (!envId) {
    console.error('❌ 错误: 请提供云开发环境ID');
    console.log('使用方法:');
    console.log('  node download-images.js [输入文件] [输出文件] [环境ID]');
    console.log('或者设置环境变量: WECHAT_CLOUD_ENV_ID=your-env-id');
    process.exit(1);
  }

  // 检查输入文件
  if (!require('fs').existsSync(inputFile)) {
    console.error(`❌ 错误: 输入文件不存在: ${inputFile}`);
    process.exit(1);
  }

  console.log('🚀 微信云存储图片下载工具');
  console.log('========================');
  console.log(`📁 输入文件: ${inputFile}`);
  console.log(`📁 输出文件: ${outputFile}`);
  console.log(`🌐 环境ID: ${envId}`);
  console.log('');

  // 创建下载器实例
  const downloader = new WeChatCloudDownloader({
    envId: envId,
    outputDir: './downloaded_images'
  });

  try {
    // 处理文件
    const result = await downloader.processDatabaseFile(inputFile, outputFile);

    if (result.success) {
      console.log('');
      console.log('🎉 处理完成！');
      console.log(`📊 统计信息:`);
      console.log(`   - 总图片数: ${result.totalImages}`);
      console.log(`   - 成功下载: ${result.successCount}`);
      console.log(`   - 下载失败: ${result.failCount}`);
      console.log(`   - 成功率: ${((result.successCount / result.totalImages) * 100).toFixed(2)}%`);
      console.log('');
      console.log(`📁 图片保存目录: ${downloader.outputDir}`);
      console.log(`📄 处理后的数据: ${outputFile}`);
      
      // 生成报告
      downloader.generateReport(result);
      
    } else {
      console.error('💥 处理失败:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 程序执行失败:', error.message);
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('💥 未处理的错误:', error);
  process.exit(1);
});
