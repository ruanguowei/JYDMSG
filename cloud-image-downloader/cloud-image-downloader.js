const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { promisify } = require('util');

/**
 * 云存储图片下载工具
 * 用于将数据库中的云存储路径替换为本地下载的图片文件
 */
class CloudImageDownloader {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './downloaded_images';
    this.tempUrlCache = new Map(); // 缓存临时URL
    this.downloadedFiles = new Map(); // 记录已下载的文件
    this.ensureOutputDir();
  }

  /**
   * 确保输出目录存在
   */
  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 从云存储路径获取临时URL
   * 注意：这里需要您提供实际的云存储API调用方法
   * 由于这是Node.js环境，您可能需要使用云开发SDK或其他HTTP客户端
   */
  async getTempFileURL(fileID) {
    if (this.tempUrlCache.has(fileID)) {
      return this.tempUrlCache.get(fileID);
    }

    // 这里需要您根据实际的云存储API来实现
    // 示例：使用微信云开发SDK
    try {
      // 假设您有云开发的环境ID和密钥
      const tempURL = await this.callCloudAPI(fileID);
      this.tempUrlCache.set(fileID, tempURL);
      return tempURL;
    } catch (error) {
      console.error(`获取临时URL失败: ${fileID}`, error);
      return null;
    }
  }

  /**
   * 调用云存储API获取临时URL
   * 您需要根据实际情况实现这个方法
   */
  async callCloudAPI(fileID) {
    // 这里需要您实现具体的云存储API调用
    // 示例代码（需要根据实际情况修改）：
    /*
    const cloud = require('wx-server-sdk');
    cloud.init({
      env: 'your-env-id' // 您的云开发环境ID
    });
    
    const result = await cloud.getTempFileURL({
      fileList: [fileID]
    });
    
    return result.fileList[0].tempFileURL;
    */
    
    // 临时返回，您需要替换为实际的API调用
    throw new Error('请实现 callCloudAPI 方法');
  }

  /**
   * 下载图片文件
   */
  async downloadImage(url, filename) {
    const filePath = path.join(this.outputDir, filename);
    
    // 如果文件已存在，直接返回路径
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`下载失败: ${response.statusCode}`));
          return;
        }

        const writeStream = fs.createWriteStream(filePath);
        response.pipe(writeStream);

        writeStream.on('finish', () => {
          console.log(`图片下载完成: ${filename}`);
          resolve(filePath);
        });

        writeStream.on('error', (error) => {
          reject(error);
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 从数据库数据中提取所有云存储路径
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
   * 生成文件名
   */
  generateFilename(fileID, index = 0) {
    // 从云存储路径中提取文件名
    const pathParts = fileID.split('/');
    const originalName = pathParts[pathParts.length - 1];
    
    // 如果没有扩展名，添加.jpg
    const ext = path.extname(originalName) || '.jpg';
    const nameWithoutExt = path.basename(originalName, ext);
    
    return `${nameWithoutExt}_${index}${ext}`;
  }

  /**
   * 下载所有云存储图片
   */
  async downloadAllImages(data) {
    const cloudPaths = this.extractCloudPaths(data);
    console.log(`找到 ${cloudPaths.length} 个云存储路径`);

    const downloadPromises = cloudPaths.map(async (fileID, index) => {
      try {
        // 获取临时URL
        const tempURL = await this.getTempFileURL(fileID);
        if (!tempURL) {
          console.warn(`无法获取临时URL: ${fileID}`);
          return { fileID, localPath: null, error: '无法获取临时URL' };
        }

        // 生成文件名
        const filename = this.generateFilename(fileID, index);
        
        // 下载图片
        const localPath = await this.downloadImage(tempURL, filename);
        
        return { fileID, localPath, tempURL };
      } catch (error) {
        console.error(`下载图片失败: ${fileID}`, error);
        return { fileID, localPath: null, error: error.message };
      }
    });

    const results = await Promise.all(downloadPromises);
    
    // 记录下载结果
    results.forEach(result => {
      if (result.localPath) {
        this.downloadedFiles.set(result.fileID, result.localPath);
      }
    });

    return results;
  }

  /**
   * 替换数据中的云存储路径为本地路径
   */
  replaceCloudPaths(data) {
    const replacedData = JSON.parse(JSON.stringify(data)); // 深拷贝
    
    function replace(obj) {
      if (typeof obj === 'string' && obj.startsWith('cloud://')) {
        const localPath = this.downloadedFiles.get(obj);
        return localPath || obj; // 如果找不到本地路径，保持原路径
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
   * 处理数据库数据文件
   */
  async processDatabaseFile(inputFile, outputFile) {
    try {
      console.log(`开始处理文件: ${inputFile}`);
      
      // 读取数据库数据
      const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
      
      // 下载所有图片
      console.log('开始下载图片...');
      const downloadResults = await this.downloadAllImages(data);
      
      const successCount = downloadResults.filter(r => r.localPath).length;
      const failCount = downloadResults.length - successCount;
      
      console.log(`图片下载完成: 成功 ${successCount} 个，失败 ${failCount} 个`);
      
      // 替换路径
      console.log('开始替换路径...');
      const replacedData = this.replaceCloudPaths(data);
      
      // 保存处理后的数据
      fs.writeFileSync(outputFile, JSON.stringify(replacedData, null, 2), 'utf8');
      
      console.log(`处理完成，结果保存到: ${outputFile}`);
      
      return {
        success: true,
        totalImages: downloadResults.length,
        successCount,
        failCount,
        outputFile
      };
      
    } catch (error) {
      console.error('处理文件失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成处理报告
   */
  generateReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      totalImages: results.totalImages,
      successCount: results.successCount,
      failCount: results.failCount,
      successRate: results.totalImages > 0 ? (results.successCount / results.totalImages * 100).toFixed(2) + '%' : '0%',
      outputDirectory: this.outputDir,
      downloadedFiles: Array.from(this.downloadedFiles.entries()).map(([fileID, localPath]) => ({
        originalPath: fileID,
        localPath: localPath
      }))
    };
    
    const reportFile = path.join(this.outputDir, 'download_report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
    
    console.log(`处理报告已保存到: ${reportFile}`);
    return report;
  }
}

// 使用示例
async function main() {
  const downloader = new CloudImageDownloader({
    outputDir: './downloaded_images'
  });

  // 处理数据库文件
  const result = await downloader.processDatabaseFile(
    './database_export.json',  // 输入文件路径
    './database_with_local_images.json'  // 输出文件路径
  );

  if (result.success) {
    console.log('处理成功！');
    downloader.generateReport(result);
  } else {
    console.error('处理失败:', result.error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = CloudImageDownloader;
