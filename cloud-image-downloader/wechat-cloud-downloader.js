const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * 微信云开发图片下载工具
 * 专门用于处理微信云存储中的图片下载和路径替换
 */
class WeChatCloudDownloader {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './downloaded_images';
    this.envId = options.envId; // 云开发环境ID
    this.tempUrlCache = new Map();
    this.downloadedFiles = new Map();
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 使用微信云开发API获取临时URL
   * 需要先安装 wx-server-sdk: npm install wx-server-sdk
   */
  async getTempFileURL(fileID) {
    if (this.tempUrlCache.has(fileID)) {
      return this.tempUrlCache.get(fileID);
    }

    try {
      // 动态导入 wx-server-sdk
      const cloud = require('wx-server-sdk');
      
      // 初始化云开发
      cloud.init({
        env: this.envId || cloud.DYNAMIC_CURRENT_ENV
      });

      // 获取临时URL
      const result = await cloud.getTempFileURL({
        fileList: [fileID]
      });

      if (result.fileList && result.fileList.length > 0) {
        const tempURL = result.fileList[0].tempFileURL;
        this.tempUrlCache.set(fileID, tempURL);
        return tempURL;
      } else {
        throw new Error('无法获取临时URL');
      }
    } catch (error) {
      console.error(`获取临时URL失败: ${fileID}`, error);
      return null;
    }
  }

  /**
   * 下载图片文件
   */
  async downloadImage(url, filename) {
    const filePath = path.join(this.outputDir, filename);
    
    if (fs.existsSync(filePath)) {
      console.log(`文件已存在，跳过下载: ${filename}`);
      return filePath;
    }

    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      const request = protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`下载失败: HTTP ${response.statusCode}`));
          return;
        }

        const writeStream = fs.createWriteStream(filePath);
        response.pipe(writeStream);

        writeStream.on('finish', () => {
          console.log(`✓ 图片下载完成: ${filename}`);
          resolve(filePath);
        });

        writeStream.on('error', (error) => {
          fs.unlink(filePath, () => {}); // 删除部分下载的文件
          reject(error);
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      // 设置超时
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('下载超时'));
      });
    });
  }

  /**
   * 从数据中提取所有云存储路径
   */
  extractCloudPaths(data) {
    const cloudPaths = new Set();
    
    function traverse(obj) {
      if (typeof obj === 'string' && obj.startsWith('cloud://')) {
        cloudPaths.add(obj);
      } else if (Array.isArray(obj)) {
        obj.forEach(item => traverse(item));
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(value => traverse(value));
      }
    }
    
    traverse(data);
    return Array.from(cloudPaths);
  }

  /**
   * 生成安全的文件名
   */
  generateFilename(fileID, index = 0) {
    // 从云存储路径中提取信息
    const pathParts = fileID.split('/');
    const originalName = pathParts[pathParts.length - 1];
    
    // 清理文件名，移除特殊字符
    let cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // 如果没有扩展名，添加.jpg
    if (!path.extname(cleanName)) {
      cleanName += '.jpg';
    }
    
    // 如果文件名太长，截断
    const ext = path.extname(cleanName);
    const nameWithoutExt = path.basename(cleanName, ext);
    if (nameWithoutExt.length > 50) {
      cleanName = nameWithoutExt.substring(0, 50) + ext;
    }
    
    return `${index.toString().padStart(3, '0')}_${cleanName}`;
  }

  /**
   * 批量下载图片
   */
  async downloadAllImages(data) {
    const cloudPaths = this.extractCloudPaths(data);
    console.log(`🔍 找到 ${cloudPaths.length} 个云存储路径`);

    if (cloudPaths.length === 0) {
      console.log('ℹ️  没有找到云存储路径');
      return [];
    }

    const downloadPromises = cloudPaths.map(async (fileID, index) => {
      try {
        console.log(`📥 正在处理: ${fileID}`);
        
        // 获取临时URL
        const tempURL = await this.getTempFileURL(fileID);
        if (!tempURL) {
          throw new Error('无法获取临时URL');
        }

        // 生成文件名
        const filename = this.generateFilename(fileID, index);
        
        // 下载图片
        const localPath = await this.downloadImage(tempURL, filename);
        
        return { 
          fileID, 
          localPath, 
          tempURL, 
          filename,
          success: true 
        };
      } catch (error) {
        console.error(`❌ 下载失败: ${fileID}`, error.message);
        return { 
          fileID, 
          localPath: null, 
          error: error.message,
          success: false 
        };
      }
    });

    const results = await Promise.all(downloadPromises);
    
    // 记录成功下载的文件
    results.forEach(result => {
      if (result.success && result.localPath) {
        this.downloadedFiles.set(result.fileID, result.localPath);
      }
    });

    return results;
  }

  /**
   * 替换数据中的云存储路径
   */
  replaceCloudPaths(data) {
    const replacedData = JSON.parse(JSON.stringify(data));
    
    function replace(obj) {
      if (typeof obj === 'string' && obj.startsWith('cloud://')) {
        const localPath = this.downloadedFiles.get(obj);
        if (localPath) {
          // 返回相对路径
          return path.relative(process.cwd(), localPath).replace(/\\/g, '/');
        }
        return obj; // 如果找不到本地路径，保持原路径
      } else if (Array.isArray(obj)) {
        return obj.map(item => replace(item));
      } else if (obj && typeof obj === 'object') {
        const newObj = {};
        for (const [key, value] of Object.entries(obj)) {
          newObj[key] = replace(value);
        }
        return newObj;
      }
      return obj;
    }
    
    return replace(replacedData);
  }

  /**
   * 处理数据库文件
   */
  async processDatabaseFile(inputFile, outputFile) {
    try {
      console.log(`🚀 开始处理文件: ${inputFile}`);
      
      // 检查输入文件是否存在
      if (!fs.existsSync(inputFile)) {
        throw new Error(`输入文件不存在: ${inputFile}`);
      }
      
      // 读取数据库数据
      console.log('📖 读取数据库数据...');
      const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
      
      // 下载所有图片
      console.log('📥 开始下载图片...');
      const downloadResults = await this.downloadAllImages(data);
      
      const successCount = downloadResults.filter(r => r.success).length;
      const failCount = downloadResults.length - successCount;
      
      console.log(`📊 下载统计: 成功 ${successCount} 个，失败 ${failCount} 个`);
      
      // 替换路径
      console.log('🔄 开始替换路径...');
      const replacedData = this.replaceCloudPaths(data);
      
      // 保存处理后的数据
      console.log('💾 保存处理后的数据...');
      fs.writeFileSync(outputFile, JSON.stringify(replacedData, null, 2), 'utf8');
      
      console.log(`✅ 处理完成！结果保存到: ${outputFile}`);
      
      return {
        success: true,
        totalImages: downloadResults.length,
        successCount,
        failCount,
        outputFile,
        downloadResults
      };
      
    } catch (error) {
      console.error('❌ 处理文件失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成详细的处理报告
   */
  generateReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalImages: results.totalImages,
        successCount: results.successCount,
        failCount: results.failCount,
        successRate: results.totalImages > 0 ? 
          ((results.successCount / results.totalImages) * 100).toFixed(2) + '%' : '0%'
      },
      outputDirectory: this.outputDir,
      downloadedFiles: Array.from(this.downloadedFiles.entries()).map(([fileID, localPath]) => ({
        originalPath: fileID,
        localPath: localPath,
        relativePath: path.relative(process.cwd(), localPath).replace(/\\/g, '/')
      })),
      failedDownloads: results.downloadResults
        .filter(r => !r.success)
        .map(r => ({
          originalPath: r.fileID,
          error: r.error
        }))
    };
    
    const reportFile = path.join(this.outputDir, 'download_report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
    
    console.log(`📋 处理报告已保存到: ${reportFile}`);
    return report;
  }
}

// 使用示例
async function main() {
  // 配置参数
  const config = {
    envId: 'your-env-id', // 替换为您的云开发环境ID
    outputDir: './downloaded_images'
  };

  const downloader = new WeChatCloudDownloader(config);

  // 处理数据库文件
  const result = await downloader.processDatabaseFile(
    './database_export.json',  // 输入文件路径
    './database_with_local_images.json'  // 输出文件路径
  );

  if (result.success) {
    console.log('🎉 处理成功！');
    downloader.generateReport(result);
  } else {
    console.error('💥 处理失败:', result.error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = WeChatCloudDownloader;
