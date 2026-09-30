// pages/admin-panel/index.js
const app = getApp()

Page({
  openTieReview: function(e) {
    wx.navigateTo({ url: '/pages/admin-tie-review/index?operation=' + e.currentTarget.dataset.operation });
  },
  getTieResolution: function() {
    const operation = this.data.adminOperation;
    return wx.getStorageSync(`tieResolution:${operation.editionId || 'pottery-2026'}:${operation.selectedOperation}`) || null;
  },
  data: {
    adminAccount: '',
    environment: {
      envId: '',
      envVersion: '',
      label: '环境识别中',
      isProduction: false
    },
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
    contentAdmin: {
      type: 'artist',
      loading: false,
      saving: false,
      importPreviewing: false,
      importing: false,
      list: [],
      form: {
        id: '',
        title: '',
        name: '',
        artistId: '',
        artistName: '',
        period: '',
        category: '',
        material: '',
        size: '',
        intro: '',
        biography: '',
        avatar: '',
        coverImage: '',
        cover: '',
        url: '',
        year: '',
        editionId: '',
        editionNumber: '',
        description: '',
        sortOrder: 0,
        status: 'draft'
      },
      importText: '',
      importPreview: null
    },
    adminOperation: {
      selectedOperation: 'cleanSubmissionsData',
      editionId: 'pottery-2026',
      previewing: false,
      backingUp: false,
      confirming: false,
      executing: false,
      previewResult: null,
      backupResult: null,
      confirmationResult: null,
      passphrase: '',
      confirmationCode: '',
      executeResult: null,
      operations: [
        { name: 'cleanSubmissionsData', label: '数据清洗' },
        { name: 'generatePreliminaryTable', label: '生成初评结果表' },
        { name: 'startFinalEvaluation', label: '开始终评' },
        { name: 'generateFinalRanking', label: '生成终评结果表' },
        { name: 'clearCleanTable', label: '清空初评清洗表' },
        { name: 'clearPreliminaryTable', label: '清空初评结果表' },
        { name: 'clearFinalScoringTable', label: '清空终评评分表' },
        { name: 'clearFinalResultsTable', label: '清空终评结果表' },
        { name: 'updateAwardStatus', label: '批量更新奖项' },
        { name: 'uploadCertificates', label: '批量上传或替换证书' }
      ]
    },
    exportHistory: []
  },

  onLoad: function() {
    this.loadEnvironmentInfo();
    this.checkAdminStatus();
    this.loadStats();
    this.loadExportHistory();
    this.loadContentList();
  },

  loadEnvironmentInfo: function() {
    const globalData = app.globalData || {};
    const envVersion = globalData.envVersion || 'unknown';
    const envId = globalData.cloudEnv || '';
    const isProduction = envId === 'jdzyzdmsg-5g4rgrjl2008796f';

    this.setData({
      environment: {
        envId,
        envVersion,
        label: isProduction ? '生产环境' : '测试环境',
        isProduction
      }
    });
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

  getAdminPayload: function() {
    const adminInfo = wx.getStorageSync('adminInfo') || {};
    return {
      account: adminInfo.account || this.data.adminAccount,
      id: adminInfo.id || ''
    };
  },

  updateAdminOperation: function(e) {
    const index = Number(e.detail.value || 0);
    const operation = this.data.adminOperation.operations[index] || this.data.adminOperation.operations[0];
    this.setData({
      'adminOperation.selectedOperation': operation.name,
      'adminOperation.previewResult': null,
      'adminOperation.backupResult': null,
      'adminOperation.confirmationResult': null,
      'adminOperation.confirmationCode': '',
      'adminOperation.executeResult': null
    });
  },

  startDangerousOperationPreview: function(e) {
    if (this.data.adminOperation.previewing || this.data.adminOperation.executing) return;
    const operationName = e.currentTarget.dataset.operation;
    if (!operationName) {
      wx.showToast({
        title: '缺少操作类型',
        icon: 'none'
      });
      return;
    }

    this.setData({
      'adminOperation.selectedOperation': operationName,
      'adminOperation.confirmationCode': '',
      'adminOperation.previewResult': null,
      'adminOperation.backupResult': null,
      'adminOperation.confirmationResult': null,
      'adminOperation.confirmationCode': '',
      'adminOperation.executeResult': null
    });

    this.previewDangerousOperation();
    wx.pageScrollTo({ selector: '#evaluation-operations', duration: 300 });
  },

  updateAdminOperationEdition: function(e) {
    this.setData({
      'adminOperation.editionId': e.detail.value.trim(),
      'adminOperation.previewResult': null,
      'adminOperation.backupResult': null,
      'adminOperation.confirmationResult': null,
      'adminOperation.passphrase': e.detail.value.trim(),
      'adminOperation.confirmationCode': '',
      'adminOperation.executeResult': null
    });
  },

  updateAdminOperationPassphrase: function(e) {
    this.setData({
      'adminOperation.passphrase': e.detail.value.trim()
    });
  },

  updateAdminOperationConfirmationCode: function(e) {
    this.setData({
      'adminOperation.confirmationCode': e.detail.value.trim()
    });
  },

  previewDangerousOperation: function() {
    this.setData({ 'adminOperation.previewing': true });
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'manageAdminOperation',
        action: 'preview',
        operationName: this.data.adminOperation.selectedOperation,
        editionId: this.data.adminOperation.editionId || 'pottery-2026',
        environment: this.data.environment.envId || 'unknown',
        admin: this.getAdminPayload()
      },
      success: res => {
        const result = res.result || {};
        this.setData({ 'adminOperation.previewing': false });
        if (result.success) {
          this.setData({
            'adminOperation.previewResult': result.data,
            'adminOperation.backupResult': null,
            'adminOperation.confirmationResult': null,
            'adminOperation.confirmationCode': '',
            'adminOperation.executeResult': null
          });
          wx.showToast({
            title: '预检完成',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: result.errMsg || '预检失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        this.setData({ 'adminOperation.previewing': false });
        wx.showToast({
          title: err.errMsg || '预检失败',
          icon: 'none'
        });
      }
    });
  },

  backupDangerousOperation: function() {
    const preview = this.data.adminOperation.previewResult;
    if (!preview || !preview.operationId) {
      wx.showToast({ title: '请先生成预检报告', icon: 'none' });
      return;
    }

    this.setData({ 'adminOperation.backingUp': true });
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'manageAdminOperation',
        action: 'backup',
        operationName: this.data.adminOperation.selectedOperation,
        editionId: this.data.adminOperation.editionId || 'pottery-2026',
        environment: this.data.environment.envId || 'unknown',
        operationId: preview.operationId,
        admin: this.getAdminPayload()
      },
      success: res => {
        const result = res.result || {};
        this.setData({ 'adminOperation.backingUp': false });
        if (result.success) {
          this.setData({
            'adminOperation.backupResult': result.data,
            'adminOperation.confirmationResult': null,
            'adminOperation.confirmationCode': '',
            'adminOperation.executeResult': null
          });
          wx.showToast({ title: '备份清单已创建', icon: 'success' });
        } else {
          wx.showToast({ title: result.errMsg || '备份失败', icon: 'none' });
        }
      },
      fail: err => {
        this.setData({ 'adminOperation.backingUp': false });
        wx.showToast({ title: err.errMsg || '备份失败', icon: 'none' });
      }
    });
  },

  issueDangerousOperationConfirmation: function() {
    const backup = this.data.adminOperation.backupResult;
    if (!backup || !backup.operationId) {
      wx.showToast({ title: '请先创建备份清单', icon: 'none' });
      return;
    }

    this.setData({ 'adminOperation.confirming': true });
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'manageAdminOperation',
        action: 'issueConfirmation',
        tieResolution: this.getTieResolution(),
        operationName: this.data.adminOperation.selectedOperation,
        editionId: this.data.adminOperation.editionId || 'pottery-2026',
        operationId: backup.operationId,
        admin: this.getAdminPayload()
      },
      success: res => {
        const result = res.result || {};
        this.setData({ 'adminOperation.confirming': false });
        if (result.success) {
          this.setData({
            'adminOperation.confirmationResult': result.data,
            'adminOperation.confirmationCode': result.data.confirmationCode || '',
            'adminOperation.executeResult': null
          });
          wx.showToast({ title: '确认码已生成', icon: 'success' });
        } else {
          wx.showToast({ title: result.errMsg || '确认失败', icon: 'none' });
        }
      },
      fail: err => {
        this.setData({ 'adminOperation.confirming': false });
        wx.showToast({ title: err.errMsg || '确认失败', icon: 'none' });
      }
    });
  },

  executeDangerousOperation: function() {
    const backup = this.data.adminOperation.backupResult;
    const confirmation = this.data.adminOperation.confirmationResult;
    const passphrase = this.data.adminOperation.passphrase || '';
    const confirmationCode = this.data.adminOperation.confirmationCode || '';

    if (!backup || !backup.operationId || !confirmation) {
      wx.showToast({ title: '请先完成备份和确认码', icon: 'none' });
      return;
    }
    if (passphrase !== (this.data.adminOperation.editionId || 'pottery-2026')) {
      wx.showToast({ title: '届次口令不正确', icon: 'none' });
      return;
    }
    if (!confirmationCode) {
      wx.showToast({ title: '请输入确认码', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '最终确认',
      content: '将执行所选操作并更新当前届次数据，请核对上方影响范围与备份后确认。',
      confirmText: '确认执行',
      cancelText: '取消',
      success: modal => {
        if (!modal.confirm) return;
        this.setData({ 'adminOperation.executing': true });
        wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: {
            type: 'manageAdminOperation',
            action: 'execute',
            tieResolution: this.getTieResolution(),
            operationName: this.data.adminOperation.selectedOperation,
            editionId: this.data.adminOperation.editionId || 'pottery-2026',
            operationId: backup.operationId,
            passphrase,
            confirmationCode,
            admin: this.getAdminPayload()
          },
          success: res => {
            const result = res.result || {};
            this.setData({ 'adminOperation.executing': false });
            if (result.success) {
              this.setData({ 'adminOperation.executeResult': result.data });
              wx.showToast({ title: result.data.state === 'SUCCEEDED' ? '执行完成' : '执行未完成', icon: 'none' });
            } else {
              wx.showToast({ title: result.errMsg || '执行被拒绝', icon: 'none' });
            }
          },
          fail: err => {
            this.setData({ 'adminOperation.executing': false });
            wx.showToast({ title: err.errMsg || '执行失败', icon: 'none' });
          }
        });
      }
    });
  },

  switchContentType: function(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      'contentAdmin.type': type,
      'contentAdmin.importPreview': null
    });
    this.resetContentForm();
    this.loadContentList();
  },

  resetContentForm: function() {
    this.setData({
      'contentAdmin.form': {
        id: '',
        title: '',
        name: '',
        artistId: '',
        artistName: '',
        period: '',
        category: '',
        material: '',
        size: '',
        intro: '',
        biography: '',
        avatar: '',
        coverImage: '',
        cover: '',
        url: '',
        year: '',
        editionId: '',
        editionNumber: '',
        description: '',
        sortOrder: 0,
        status: 'draft'
      }
    });
  },

  updateContentField: function(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`contentAdmin.form.${field}`]: e.detail.value
    });
  },

  updateContentStatus: function(e) {
    this.setData({
      'contentAdmin.form.status': Number(e.detail.value) === 1 ? 'published' : 'draft'
    });
  },

  updateImportText: function(e) {
    this.setData({
      'contentAdmin.importText': e.detail.value
    });
  },

  editContentItem: function(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.contentAdmin.list[index] || {};
    this.setData({
      'contentAdmin.form': {
        ...this.data.contentAdmin.form,
        ...item,
        id: item._id || ''
      }
    });
  },

  loadContentList: function() {
    this.setData({ 'contentAdmin.loading': true });
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'manageMuseumContent',
        action: 'list',
        contentType: this.data.contentAdmin.type
      },
      success: res => {
        const result = res.result || {};
        this.setData({ 'contentAdmin.loading': false });
        if (result.success) {
          this.setData({ 'contentAdmin.list': result.data || [] });
        } else {
          wx.showToast({ title: result.errMsg || '内容列表加载失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('内容列表加载失败', err);
        this.setData({ 'contentAdmin.loading': false });
        wx.showToast({ title: '内容列表加载失败', icon: 'none' });
      }
    });
  },

  saveContentItem: function() {
    this.setData({ 'contentAdmin.saving': true });
    const form = this.data.contentAdmin.form;
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'manageMuseumContent',
        action: 'save',
        contentType: this.data.contentAdmin.type,
        id: form.id,
        data: form,
        admin: this.getAdminPayload()
      },
      success: res => {
        const result = res.result || {};
        this.setData({ 'contentAdmin.saving': false });
        if (result.success) {
          wx.showToast({ title: '保存成功', icon: 'success' });
          this.resetContentForm();
          this.loadContentList();
        } else {
          wx.showToast({ title: result.errMsg || '保存失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('保存内容失败', err);
        this.setData({ 'contentAdmin.saving': false });
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },

  toggleContentStatus: function(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status === 'published' ? 'draft' : 'published';
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'manageMuseumContent',
        action: 'updateStatus',
        contentType: this.data.contentAdmin.type,
        id,
        status,
        admin: this.getAdminPayload()
      },
      success: res => {
        const result = res.result || {};
        if (result.success) {
          wx.showToast({ title: status === 'published' ? '已发布' : '已下架', icon: 'success' });
          this.loadContentList();
        } else {
          wx.showToast({ title: result.errMsg || '状态更新失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('状态更新失败', err);
        wx.showToast({ title: '状态更新失败', icon: 'none' });
      }
    });
  },

  previewContentImport: function() {
    let rows;
    try {
      rows = JSON.parse(this.data.contentAdmin.importText || '[]');
    } catch (error) {
      wx.showToast({ title: '请输入 JSON 数组', icon: 'none' });
      return;
    }

    this.setData({ 'contentAdmin.importPreviewing': true });
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'manageMuseumContent',
        action: 'previewImport',
        contentType: this.data.contentAdmin.type,
        rows,
        admin: this.getAdminPayload()
      },
      success: res => {
        const result = res.result || {};
        this.setData({ 'contentAdmin.importPreviewing': false });
        if (result.success) {
          this.setData({ 'contentAdmin.importPreview': result.data });
        } else {
          wx.showToast({ title: result.errMsg || '导入预检失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('导入预检失败', err);
        this.setData({ 'contentAdmin.importPreviewing': false });
        wx.showToast({ title: '导入预检失败', icon: 'none' });
      }
    });
  },

  executeContentImport: function() {
    const preview = this.data.contentAdmin.importPreview;
    if (!preview || preview.failed > 0) {
      wx.showToast({ title: '请先完成无失败的预检', icon: 'none' });
      return;
    }

    let rows;
    try {
      rows = JSON.parse(this.data.contentAdmin.importText || '[]');
    } catch (error) {
      wx.showToast({ title: '请输入 JSON 数组', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认导入内容',
      content: `预计新增 ${preview.wouldCreate} 条，更新 ${preview.wouldUpdate} 条，不会删除任何已有内容。是否继续？`,
      confirmText: '确认导入',
      cancelText: '取消',
      success: res => {
        if (!res.confirm) return;

        this.setData({ 'contentAdmin.importing': true });
        wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: {
            type: 'manageMuseumContent',
            action: 'importContent',
            contentType: this.data.contentAdmin.type,
            rows,
            admin: this.getAdminPayload()
          },
          success: importRes => {
            const result = importRes.result || {};
            this.setData({ 'contentAdmin.importing': false });
            if (result.success) {
              wx.showModal({
                title: '导入完成',
                content: `新增 ${result.data.created} 条，更新 ${result.data.updated} 条。`,
                showCancel: false
              });
              this.setData({
                'contentAdmin.importPreview': null,
                'contentAdmin.importText': ''
              });
              this.loadContentList();
            } else {
              wx.showToast({ title: result.errMsg || '导入失败', icon: 'none' });
            }
          },
          fail: err => {
            console.error('内容导入失败', err);
            this.setData({ 'contentAdmin.importing': false });
            wx.showToast({ title: '导入失败', icon: 'none' });
          }
        });
      }
    });
  },

  // 加载统计数据
  loadStats: function() {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'getAdminStats', editionId: this.data.adminOperation.editionId || 'pottery-2026'
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
  selectEvaluationOperation: function(operationName) {
    this.setData({
      'adminOperation.selectedOperation': operationName,
      'adminOperation.confirmationCode': '',
      'adminOperation.previewResult': null,
      'adminOperation.backupResult': null,
      'adminOperation.confirmationResult': null,
      'adminOperation.executeResult': null
    });
    wx.pageScrollTo({ selector: '#evaluation-operations', duration: 300 });
  },

  cleanData: function() {
    this.selectEvaluationOperation('cleanSubmissionsData');
  },

  // 执行数据清洗
  doCleanData: function() {
    this.selectEvaluationOperation('cleanSubmissionsData');
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
        type: 'exportCleanedSubmissions', editionId: this.data.adminOperation.editionId || 'pottery-2026'
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
    this.selectEvaluationOperation('generatePreliminaryTable');
  },

  // 执行生成初评结果表
  doGeneratePreliminaryTable: function() {
    this.selectEvaluationOperation('generatePreliminaryTable');
  },

  // 开始终评（危险操作）
  startFinalEvaluation: function() {
    this.selectEvaluationOperation('startFinalEvaluation');
  },

  // 执行开始终评
  doStartFinalEvaluation: function() {
    this.selectEvaluationOperation('startFinalEvaluation');
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
        type: 'exportPreliminaryResults', editionId: this.data.adminOperation.editionId || 'pottery-2026'
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
    this.selectEvaluationOperation('generateFinalRanking');
  },

  // 执行生成终评结果表
  doGenerateFinalTable: function() {
    this.selectEvaluationOperation('generateFinalRanking');
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
        type: 'exportFinalResults', editionId: this.data.adminOperation.editionId || 'pottery-2026', sourceKey: 'finalResults'
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

