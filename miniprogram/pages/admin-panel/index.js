// pages/admin-panel/index.js
const app = getApp()

Page({
  data: {
    adminAccount: '',
    exporting: {
      submissions: false,
      preliminary: false,
      final: false
    },
    cleaning: false,  // 数据清洗状态
    generating: {
      preliminary: false,  // 生成初评结果表
      startFinal: false,  // 开始终评
      final: false  // 生成终评结果表
    },
    stats: {
      totalSubmissions: 0,
      preliminaryCount: 0,
      finalCount: 0,
      expertCount: 0
    },
    exportHistory: []
  },

  onLoad: function() {
    this.checkAdminStatus();
    this.loadStats();
    this.loadExportHistory();
  },

  // 检查管理员登录状态
  checkAdminStatus: function() {
    const adminInfo = wx.getStorageSync('adminInfo');
    if (!adminInfo || !adminInfo.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      wx.navigateBack();
      return;
    }
    
    this.setData({
      adminAccount: adminInfo.account
    });
  },

  // 加载统计数据
  loadStats: function() {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'getAdminStats'
      },
      success: res => {
        if (res.result && res.result.success) {
          this.setData({
            stats: res.result.data
          });
        }
      },
      fail: err => {
        console.error('加载统计数据失败', err);
      }
    });
  },

  // 加载导出历史
  loadExportHistory: function() {
    const history = wx.getStorageSync('exportHistory') || [];
    this.setData({
      exportHistory: history.slice(0, 5) // 只显示最近5条
    });
  },

  // 添加导出记录
  addExportHistory: function(name, status) {
    const now = new Date();
    const timeStr = `${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    let history = wx.getStorageSync('exportHistory') || [];
    history.unshift({
      name: name,
      time: timeStr,
      status: status
    });
    
    // 最多保存20条记录
    if (history.length > 20) {
      history = history.slice(0, 20);
    }
    
    wx.setStorageSync('exportHistory', history);
    this.loadExportHistory();
  },

  // 数据清洗（危险操作）
  cleanData: function() {
    wx.showModal({
      title: '⚠️ 危险操作警告',
      content: '【数据清洗】会执行以下操作：\n\n' +
               '1. 从原表读取所有作品\n' +
               '2. 按姓名+学校+身份证号去重\n' +
               '3. 清空清洗表(pottery_submissions_clean)\n' +
               '4. 写入清洗后的数据\n\n' +
               '⚠️ 警告：\n' +
               '• 清洗表中的所有初评评分将永久丢失！\n' +
               '• 如果您已手动修改过评分数据，修改将丢失！\n\n' +
               '✅ 建议：只在初评开始前执行一次\n' +
               '❌ 避免：初评过程中或已手动修改评分后执行\n\n' +
               '确定要继续吗？',
      confirmText: '确认',
      confirmColor: '#e74c3c',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doCleanData();
        }
      }
    });
  },

  // 执行数据清洗
  doCleanData: function() {
    this.setData({ cleaning: true });
    wx.showLoading({ title: '清洗中...', mask: true });

    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'cleanSubmissionsData' },
      timeout: 120000,  // 120秒超时（单位：毫秒）
      success: res => {
        this.setData({ cleaning: false });
        wx.hideLoading();

        if (res.result && res.result.success) {
          const data = res.result.data;
          wx.showModal({
            title: '✅ 清洗成功',
            content: `原始数据：${data.originalCount}条\n` +
                    `清洗后：${data.cleanedCount}条\n` +
                    `删除重复：${data.duplicateCount}条\n\n` +
                    `评分表(pottery_submissions_clean)已生成，\n` +
                    `可在云开发控制台查看。`,
            showCancel: false
          });
          this.addExportHistory('数据清洗', '成功');
          this.loadStats(); // 刷新统计
        } else {
          wx.showToast({
            title: res.result.message || '清洗失败',
            icon: 'none',
            duration: 2000
          });
          this.addExportHistory('数据清洗', '失败');
        }
      },
      fail: err => {
        this.setData({ cleaning: false });
        wx.hideLoading();
        console.error('数据清洗失败', err);
        wx.showToast({
          title: '清洗失败',
          icon: 'none'
        });
        this.addExportHistory('数据清洗', '失败');
      }
    });
  },

  // 导出报名数据
  exportSubmissions: function() {
    this.setData({
      'exporting.submissions': true
    });
    wx.showLoading({ title: '导出中...', mask: true });

    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'exportCleanedSubmissions'
      },
      timeout: 120000,  // 120秒超时
      success: res => {
        this.setData({
          'exporting.submissions': false
        });
        wx.hideLoading();

        if (res.result && res.result.success) {
          wx.showModal({
            title: '✅ 导出成功',
            content: `已导出 ${res.result.recordCount} 条数据\n` +
                    `文件：${res.result.fileName}\n\n` +
                    `请到云存储下载CSV文件。`,
            confirmText: '知道了',
            showCancel: false
          });
          this.addExportHistory('报名数据', '成功');
        } else {
          wx.showToast({
            title: res.result.message || '导出失败',
            icon: 'none',
            duration: 2000
          });
          this.addExportHistory('报名数据', '失败');
        }
      },
      fail: err => {
        this.setData({
          'exporting.submissions': false
        });
        wx.hideLoading();
        console.error('导出报名数据失败', err);
        wx.showToast({
          title: '导出失败',
          icon: 'none'
        });
        this.addExportHistory('报名数据', '失败');
      }
    });
  },

  // 生成初评结果表（危险操作）
  generatePreliminaryTable: function() {
    wx.showModal({
      title: '⚠️ 危险操作警告',
      content: '【生成初评结果表】会执行以下操作：\n\n' +
               '1. 从清洗表读取所有初评评分\n' +
               '2. 按类别筛选前520件（技艺182+文脉182+算法78+产业78）\n' +
               '3. 加上港澳台作品（约20件）\n' +
               '4. 清空初评结果表(pottery_submissions_preliminary)\n' +
               '5. 写入筛选后的约540件作品\n\n' +
               '⚠️ 警告：\n' +
               '• 初评结果表将被清空并重新生成！\n' +
               '• 如果您对初评结果表有手动修改，修改将丢失！\n\n' +
               '✅ 建议：只在初评完成后执行一次\n' +
               '❌ 避免：如果已手动修改评分数据\n\n' +
               '确定要继续吗？',
      confirmText: '确认',
      confirmColor: '#e74c3c',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doGeneratePreliminaryTable();
        }
      }
    });
  },

  // 执行生成初评结果表
  doGeneratePreliminaryTable: function() {
    this.setData({ 'generating.preliminary': true });
    wx.showLoading({ title: '生成中...', mask: true });

    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'generatePreliminaryTable' },
      timeout: 120000,  // 120秒超时
      success: res => {
        this.setData({ 'generating.preliminary': false });
        wx.hideLoading();

        if (res.result && res.result.success) {
          const data = res.result.data;
          wx.showModal({
            title: '✅ 生成成功',
            content: `初评结果表已生成！\n\n` +
                    `总数：${data.totalCount}件\n` +
                    `普通作品：${data.regularCount}件\n` +
                    `港澳台：${data.hkMacauTaiwanCount}件\n\n` +
                    `按类别分配（普通作品）：\n` +
                    `技艺${data.byCategory.technique}、文脉${data.byCategory.culture}、算法${data.byCategory.algorithm}、产业${data.byCategory.industry}\n\n` +
                    `表名：pottery_submissions_preliminary\n` +
                    `可在云开发控制台查看。`,
            showCancel: false
          });
          this.addExportHistory('生成初评结果', '成功');
          this.loadStats();
        } else {
          wx.showToast({
            title: res.result.message || '生成失败',
            icon: 'none',
            duration: 2000
          });
          this.addExportHistory('生成初评结果', '失败');
        }
      },
      fail: err => {
        this.setData({ 'generating.preliminary': false });
        wx.hideLoading();
        console.error('生成初评结果表失败', err);
        wx.showToast({
          title: '生成失败',
          icon: 'none'
        });
        this.addExportHistory('生成初评结果', '失败');
      }
    });
  },

  // 开始终评（危险操作）
  startFinalEvaluation: function() {
    wx.showModal({
      title: '⚠️ 危险操作警告',
      content: '【开始终评】会执行以下操作：\n\n' +
               '1. 从初评结果表读取520件作品\n' +
               '2. 加上港澳台作品（约20件）\n' +
               '3. 清空终评评分表(pottery_submissions_for_final)\n' +
               '4. 复制作品基本信息（不包含评分记录）\n' +
               '5. 写入约540件干净的作品\n\n' +
               '⚠️ 警告：\n' +
               '• 终评评分表中的所有终评评分将永久丢失！\n' +
               '• 如果您已手动修改过终评评分，修改将丢失！\n\n' +
               '✅ 建议：只在初评完成后执行一次\n' +
               '❌ 避免：终评过程中或已手动修改评分后执行\n\n' +
               '确定要继续吗？',
      confirmText: '确认',
      confirmColor: '#e74c3c',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doStartFinalEvaluation();
        }
      }
    });
  },

  // 执行开始终评
  doStartFinalEvaluation: function() {
    this.setData({ 'generating.startFinal': true });
    wx.showLoading({ title: '准备中...', mask: true });

    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'startFinalEvaluation' },
      timeout: 120000,
      success: res => {
        this.setData({ 'generating.startFinal': false });
        wx.hideLoading();

        if (res.result && res.result.success) {
          const data = res.result.data;
          wx.showModal({
            title: '✅ 开始终评成功',
            content: `终评评分表已生成！\n\n` +
                    `总数：${data.totalCount}件\n` +
                    `普通作品：${data.regularCount}件\n` +
                    `港澳台：${data.hkMacauTaiwanCount}件\n\n` +
                    `表名：pottery_submissions_for_final\n` +
                    `可在云开发控制台查看。\n\n` +
                    `终评评委现在可以开始评分。`,
            showCancel: false
          });
          this.addExportHistory('开始终评', '成功');
          this.loadStats();
        } else {
          wx.showToast({
            title: res.result.message || '操作失败',
            icon: 'none',
            duration: 2000
          });
          this.addExportHistory('开始终评', '失败');
        }
      },
      fail: err => {
        this.setData({ 'generating.startFinal': false });
        wx.hideLoading();
        console.error('开始终评失败', err);
        wx.showToast({
          title: '操作失败',
          icon: 'none'
        });
        this.addExportHistory('开始终评', '失败');
      }
    });
  },

  // 导出初评结果
  exportPreliminaryResults: function() {
    this.setData({
      'exporting.preliminary': true
    });
    wx.showLoading({ title: '导出中...', mask: true });

    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'exportPreliminaryResults'
      },
      timeout: 120000,  // 120秒超时
      success: res => {
        wx.hideLoading();
        this.setData({
          'exporting.preliminary': false
        });

        if (res.result && res.result.success) {
          wx.showToast({
            title: '导出成功',
            icon: 'success'
          });
          this.addExportHistory('初评结果', '成功');
          
          if (res.result.downloadUrl) {
            this.showDownloadDialog(res.result.downloadUrl, res.result.fileName);
          }
        } else {
          wx.showToast({
            title: res.result.message || '导出失败',
            icon: 'none'
          });
          this.addExportHistory('初评结果', '失败');
        }
      },
      fail: err => {
        wx.hideLoading();
        this.setData({
          'exporting.preliminary': false
        });
        console.error('导出初评结果失败', err);
        wx.showToast({
          title: '导出失败',
          icon: 'none'
        });
        this.addExportHistory('初评结果', '失败');
      }
    });
  },

  // 生成终评结果表（危险操作）
  generateFinalTable: function() {
    wx.showModal({
      title: '⚠️ 危险操作警告',
      content: '【生成终评结果表】会执行以下操作：\n\n' +
               '1. 从终评评分表读取所有终评评分\n' +
               '2. 按类别筛选前291件（技艺91+文脉98+算法49+产业53）\n' +
               '3. 应用地域均衡规则（不足4件的省份递补）\n' +
               '4. 加上港澳台作品（约20件）\n' +
               '5. 清空终评结果表(pottery_submissions_final)\n' +
               '6. 写入最终约311件入围作品\n\n' +
               '⚠️ 警告：\n' +
               '• 终评结果表将被清空并重新生成！\n' +
               '• 如果您对终评结果表有手动修改，修改将丢失！\n\n' +
               '✅ 建议：只在终评完成后执行一次\n' +
               '❌ 避免：已手动修改终评评分后重复执行\n\n' +
               '确定要继续吗？',
      confirmText: '确认',
      confirmColor: '#e74c3c',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doGenerateFinalTable();
        }
      }
    });
  },

  // 执行生成终评结果表
  doGenerateFinalTable: function() {
    this.setData({ 'generating.final': true });
    wx.showLoading({ title: '生成中...', mask: true });

    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'generateFinalRanking' },
      timeout: 120000,  // 120秒超时
      success: res => {
        this.setData({ 'generating.final': false });
        wx.hideLoading();

        if (res.result && res.result.success) {
          const data = res.result.data;
          wx.showModal({
            title: '✅ 生成成功',
            content: `终评结果表已生成！\n\n` +
                    `总数：${data.totalCount}件\n` +
                    `普通作品：${data.regularCount}件\n` +
                    `港澳台：${data.hkMacauTaiwanCount}件\n` +
                    `地域递补：${data.supplementedCount}件\n\n` +
                    `表名：pottery_submissions_final\n` +
                    `可在云开发控制台查看。`,
            showCancel: false
          });
          this.addExportHistory('生成终评结果', '成功');
          this.loadStats();
        } else {
          wx.showToast({
            title: res.result.message || '生成失败',
            icon: 'none',
            duration: 2000
          });
          this.addExportHistory('生成终评结果', '失败');
        }
      },
      fail: err => {
        this.setData({ 'generating.final': false });
        wx.hideLoading();
        console.error('生成终评结果表失败', err);
        wx.showToast({
          title: '生成失败',
          icon: 'none'
        });
        this.addExportHistory('生成终评结果', '失败');
      }
    });
  },

  // 导出终评结果
  exportFinalResults: function() {
    this.setData({
      'exporting.final': true
    });
    wx.showLoading({ title: '导出中...', mask: true });

    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'exportFinalResults'
      },
      timeout: 120000,  // 120秒超时
      success: res => {
        wx.hideLoading();
        this.setData({
          'exporting.final': false
        });

        if (res.result && res.result.success) {
          wx.showToast({
            title: '导出成功',
            icon: 'success'
          });
          this.addExportHistory('终评结果', '成功');
          
          if (res.result.downloadUrl) {
            this.showDownloadDialog(res.result.downloadUrl, res.result.fileName);
          }
        } else {
          wx.showToast({
            title: res.result.message || '导出失败',
            icon: 'none'
          });
          this.addExportHistory('终评结果', '失败');
        }
      },
      fail: err => {
        wx.hideLoading();
        this.setData({
          'exporting.final': false
        });
        console.error('导出终评结果失败', err);
        wx.showToast({
          title: '导出失败',
          icon: 'none'
        });
        this.addExportHistory('终评结果', '失败');
      }
    });
  },

  // 显示下载对话框
  showDownloadDialog: function(fileId, fileName) {
    wx.showModal({
      title: '导出成功',
      content: `文件：${fileName}\n\n已保存到云存储，请到云开发控制台下载`,
      confirmText: '知道了',
      showCancel: false
    });
  },

  // 退出登录
  logout: function() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出管理员面板吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('adminInfo');
          wx.showToast({
            title: '已退出',
            icon: 'success'
          });
          
          setTimeout(() => {
            wx.navigateBack();
          }, 1000);
        }
      }
    });
  },

  // 返回结果页
  backToResults: function() {
    wx.navigateBack();
  }
})

