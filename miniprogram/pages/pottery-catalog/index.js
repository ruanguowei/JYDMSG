// pages/pottery-catalog/index.js

// 分类顺序和描述
const CATEGORY_CONFIG = {
  '技艺': {
    order: 1,
    name: '技艺',
    icon: '◈',
    description: '传承传统技艺，展现匠心精神'
  },
  '文脉': {
    order: 2,
    name: '文脉',
    icon: '◇',
    description: '延续文化脉络，诠释时代精神'
  },
  '算法': {
    order: 3,
    name: '算法',
    icon: '◆',
    description: '数字技术赋能，创新艺术表达'
  },
  '产业': {
    order: 4,
    name: '产业',
    icon: '◈',
    description: '产教融合发展，服务产业升级'
  },
  '视界': {
    order: 5,
    name: '视界',
    icon: '◇',
    description: '拓展艺术视野，探索无限可能'
  }
};

// 滑动窗口大小（前后各保留几页）
const WINDOW_SIZE = 5;

// 每批次加载数量
const BATCH_SIZE = 20;

// 翻页阈值（滑动距离超过此值触发翻页）
const FLIP_THRESHOLD = 80;

Page({
  data: {
    loading: true,
    loadingText: '正在加载画册...',
    loadingProgress: 0,
    
    currentPage: 0,
    totalPages: 0,
    
    // 当前渲染的页面列表（滑动窗口）
    pageList: [],
    
    // 当前页面数据
    currentPageData: null,
    prevPageData: null,
    nextPageData: null,
    
    // 完整的页面索引（不含实际数据）
    pageIndex: [],
    
    // 分类数据缓存
    categoryDataCache: {},
    
    // 目录信息
    catalogSections: [],
    showCatalog: false,
    
    // 搜索相关
    searchKeyword: '',
    searchResults: [],
    
    // 3D翻书相关
    isFlipping: false,
    flipAngle: 0,
    flipDirection: '',
    flipStyle: '',
    pageAnimClass: '',
    showFlipHint: true,
    globalCurrentPage: 0,
    
    // 图片预览
    showImagePreview: false,
    previewImageUrl: '',
    
    // 内存监控
    memoryWarning: false
  },
  
  // 触摸相关变量
  touchStartX: 0,
  touchStartY: 0,
  touchStartTime: 0,
  isTouching: false,
  
  // 翻页音效
  flipSound: null,
  flipSoundReady: false,
  
  // 原图预览URL（用于释放）
  currentPreviewUrl: null,

  // 生命周期
  onLoad: function() {
    this._isPageActive = true;
    this._timers = new Set();
    this.initFlipSound();
    this.initCatalog();
  },
  
  // 初始化翻页音效（进入画册时加载一次，退出时释放）
  initFlipSound() {
    this.flipSound = wx.createInnerAudioContext();
    this.flipSound.src = '/audio/page-flip.mp3';
    this.flipSound.volume = 0.4;
    
    // 预加载音频文件到内存（只记录首次加载）
    this.flipSound.onCanplay(() => {
      if (!this.flipSoundReady) {
        console.log('[翻页音效] 已加载到内存');
        this.flipSoundReady = true;
      }
    });
    
    // 监听错误，如果本地文件不存在则静默处理
    this.flipSound.onError((err) => {
      console.log('[翻页音效] 加载失败，已禁用音效', err);
      const failedSound = this.flipSound;
      this.flipSound = null;
      this.flipSoundReady = false;
      if (failedSound) {
        failedSound.destroy();
      }
    });
  },
  
  // 播放翻页音效（使用已加载的音频）
  playFlipSound() {
    if (this.flipSound && this.flipSoundReady) {
      try {
        this.flipSound.stop();
        this.flipSound.seek(0);
        this.flipSound.play();
      } catch (e) {
        // 忽略播放错误
      }
    }
  },

  onUnload: function() {
    this._isPageActive = false;
    this.clearAllTimers();

    // 页面卸载时清理所有资源
    this.clearAllCache();
    
    // 销毁音频对象（退出画册时释放）
    if (this.flipSound) {
      this.flipSound.destroy();
      this.flipSound = null;
      this.flipSoundReady = false;
      console.log('[翻页音效] 已释放');
    }
    
    // 释放原图预览缓存
    this.releasePreviewImage();
    
    console.log('[页面卸载] 所有资源已释放');
  },
  
  onHide: function() {
    // 页面隐藏时释放部分内存
    this.releaseMemory();
  },

  onMemoryWarning: function(res) {
    console.warn('[内存警告] level:', res.level);
    this.setData({ memoryWarning: true });
    // 主动释放内存
    this.releaseMemory();
  },

  // ==================== 初始化 ====================
  
  async initCatalog() {
    try {
      this.setData({ 
        loading: true, 
        loadingText: '正在获取作品数据...',
        loadingProgress: 10 
      });

      // 1. 获取分类统计信息
      const indexResult = await this.fetchCatalogIndex();
      if (!this._isPageActive) {
        return;
      }
      if (!indexResult.success) {
        throw new Error(indexResult.message || '获取索引失败');
      }

      this.setData({ loadingProgress: 30 });

      // 2. 构建页面索引
      const pageIndex = this.buildPageIndex(indexResult.data);
      
      this.setData({ 
        loadingProgress: 50,
        loadingText: '正在构建画册...'
      });

      // 3. 加载首屏数据
      await this.loadInitialData(pageIndex);
      if (!this._isPageActive) {
        return;
      }

      this.setData({ 
        loadingProgress: 100,
        loading: false 
      });

    } catch (error) {
      if (!this._isPageActive) {
        return;
      }
      console.error('[初始化失败]', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 获取分类索引信息（调用独立云函数）
  async fetchCatalogIndex() {
    return new Promise((resolve) => {
      wx.cloud.callFunction({
        name: 'fetchCatalogIndex',  // 独立云函数
        data: {},
        success: res => {
          if (res.result && res.result.success) {
            resolve(res.result);
          } else {
            resolve({ success: false, message: (res.result && res.result.message) || '请求失败' });
          }
        },
        fail: err => {
          console.error('[fetchCatalogIndex] 失败:', err);
          resolve({ success: false, message: err.errMsg });
        }
      });
    });
  },

  // 按分类获取作品列表（调用独立云函数）
  async fetchCatalogWorks(category, page = 0, pageSize = 20) {
    return new Promise((resolve) => {
      wx.cloud.callFunction({
        name: 'fetchCatalogWorks',  // 独立云函数
        data: { category, page, pageSize },
        success: res => {
          if (res.result && res.result.success) {
            resolve(res.result);
          } else {
            resolve({ success: false, message: (res.result && res.result.message) || '请求失败' });
          }
        },
        fail: err => {
          console.error('[fetchCatalogWorks] 失败:', err);
          resolve({ success: false, message: err.errMsg });
        }
      });
    });
  },

  // 获取单个作品详情（调用独立云函数）
  async fetchCatalogDetail(workId) {
    return new Promise((resolve) => {
      wx.cloud.callFunction({
        name: 'fetchCatalogDetail',  // 独立云函数
        data: { workId },
        success: res => {
          if (res.result && res.result.success) {
            resolve(res.result);
          } else {
            resolve({ success: false, message: (res.result && res.result.message) || '请求失败' });
          }
        },
        fail: err => {
          console.error('[fetchCatalogDetail] 失败:', err);
          resolve({ success: false, message: err.errMsg });
        }
      });
    });
  },

  // 构建页面索引
  buildPageIndex(data) {
    const { categories, works } = data;
    const pageIndex = [];
    const worksById = new Map();
    const pageByWorkId = new Map();
    const worksByCategory = {};
    let pageNum = 0;

    works.forEach(work => {
      worksById.set(work._id, work);
      if (!worksByCategory[work.category]) {
        worksByCategory[work.category] = [];
      }
      worksByCategory[work.category].push(work);
    });

    // 封面页
    pageIndex.push({
      pageIndex: pageNum++,
      type: 'cover'
    });

    // 按分类顺序构建
    const orderedCategories = Object.keys(CATEGORY_CONFIG).sort(
      (a, b) => CATEGORY_CONFIG[a].order - CATEGORY_CONFIG[b].order
    );

    const catalogSections = [];

    orderedCategories.forEach(category => {
      const categoryInfo = categories.find(c => c.category === category);
      if (!categoryInfo || categoryInfo.count === 0) return;

      const config = CATEGORY_CONFIG[category];
      
      // 记录分类起始页
      const startPage = pageNum;

      // 分类过渡页
      pageIndex.push({
        pageIndex: pageNum++,
        type: 'divider',
        category: category,
        categoryName: config.name,
        count: categoryInfo.count,
        description: config.description
      });

      // 该分类的作品页（先只记录索引）
      const categoryWorks = worksByCategory[category] || [];
      categoryWorks.forEach((work, idx) => {
        const workPageIndex = pageNum;
        pageIndex.push({
          pageIndex: pageNum++,
          type: 'work',
          category: category,
          workId: work._id,
          workIndex: idx,
          // 基础信息（用于目录显示）
          artworkName: work.artworkName
        });
        pageByWorkId.set(work._id, workPageIndex);
      });

      catalogSections.push({
        category: category,
        categoryName: config.name,
        count: categoryInfo.count,
        startPage: startPage
      });
    });

    // 尾页
    pageIndex.push({
      pageIndex: pageNum++,
      type: 'ending'
    });

    // 保存索引
    this.fullPageIndex = pageIndex;
    this.allWorks = works;
    this.worksById = worksById;
    this.pageByWorkId = pageByWorkId;

    this.setData({
      totalPages: pageIndex.length,
      catalogSections: catalogSections
    });

    console.log('[页面索引构建完成] 总页数:', pageIndex.length);
    return pageIndex;
  },

  // 加载首屏数据
  async loadInitialData(pageIndex) {
    // 加载前 WINDOW_SIZE * 2 + 1 页的数据
    const endPage = Math.min(WINDOW_SIZE * 2 + 1, pageIndex.length);
    const initialPages = this.buildPageListForRange(0, endPage);
    
    this.setData({
      pageList: initialPages,
      currentPage: 0,
      totalPages: pageIndex.length
    });

    this.windowStart = 0;
    this.windowEnd = endPage;
    
    // 初始化当前页面数据
    this.updateCurrentPageData(0);
  },

  // 构建指定范围的页面列表
  buildPageListForRange(start, end) {
    const pages = [];
    const pageIndex = this.fullPageIndex;

    for (let i = start; i < end && i < pageIndex.length; i++) {
      const indexItem = pageIndex[i];
      
      if (indexItem.type === 'work') {
        // 查找完整的作品数据
        const work = this.worksById && this.worksById.get(indexItem.workId);
        if (work) {
          pages.push({
            ...indexItem,
            artworkName: this.formatArtworkName(work.artworkName),
            authorName: this.formatArray(work.authorName),
            schoolName: work.schoolName,
            advisorName: this.formatArray(work.advisorName),
            artworkDescription: work.artworkDescription,
            imageUrl: this.getCompressedImageUrl(work.perspectiveImage),
            originalImageUrl: work.perspectiveImage,  // 保存原图URL用于预览
            dimensions: work.dimensions,
            dimensionText: this.formatDimensions(work.dimensions),
            craftMaterial: this.formatCraftMaterial(work.craftMaterial),
            year: work.createYear || '2025'
          });
        } else {
          pages.push(indexItem);
        }
      } else {
        pages.push(indexItem);
      }
    }

    return pages;
  },

  // ==================== 页面滑动处理 ====================

  onPageChange(e) {
    const current = e.detail.current;
    const source = e.detail.source;
    
    // 只处理用户主动滑动
    if (source !== 'touch' && source !== 'autoplay') return;
    
    this.setData({ currentPage: current });
    
    // 检查是否需要更新滑动窗口
    this.checkAndUpdateWindow(current);
  },

  onAnimationFinish(e) {
    // 动画结束后的处理（如预加载下一页图片）
    const current = e.detail.current;
    this.preloadNearbyImages(current);
  },

  // 检查并更新滑动窗口
  checkAndUpdateWindow(current) {
    const pageIndex = this.fullPageIndex;
    const totalPages = pageIndex.length;
    
    // 计算理想窗口范围
    const idealStart = Math.max(0, current - WINDOW_SIZE);
    const idealEnd = Math.min(totalPages, current + WINDOW_SIZE + 1);

    // 判断是否需要更新窗口
    const needUpdate = idealStart !== this.windowStart || idealEnd !== this.windowEnd;
    
    if (!needUpdate) return;

    console.log(`[窗口更新] 当前页: ${current}, 新窗口: ${idealStart}-${idealEnd}`);

    // 构建新的页面列表
    const newPageList = this.buildPageListForRange(idealStart, idealEnd);

    // 计算新的 currentPage 在新列表中的索引
    const newCurrentIndex = current - idealStart;

    this.windowStart = idealStart;
    this.windowEnd = idealEnd;

    this.setData({
      pageList: newPageList,
      currentPage: newCurrentIndex
    });

    // 主动释放不在窗口内的数据
    this.releaseDistantData(idealStart, idealEnd);
  },

  // ==================== 3D翻书触摸事件 ====================

  onTouchStart(e) {
    if (this.data.isFlipping) return;
    
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
    this.isTouching = true;
    
    // 隐藏翻页提示
    if (this.data.showFlipHint) {
      this.setData({ showFlipHint: false });
    }
  },

  onTouchMove(e) {
    if (!this.isTouching || this.data.isFlipping) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    
    // 如果垂直滑动大于水平滑动，不处理翻页
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    
    // 计算翻页角度（最大180度）
    const maxDelta = 200;
    const angle = Math.min(Math.abs(deltaX) / maxDelta * 180, 180);
    
    if (deltaX < -10) {
      // 向左滑 - 下一页
      if (this.data.currentPage < this.data.totalPages - 1) {
        this.setData({
          flipAngle: -angle,
          flipDirection: 'flip-next'
        });
      }
    } else if (deltaX > 10) {
      // 向右滑 - 上一页
      if (this.data.currentPage > 0) {
        this.setData({
          flipAngle: angle,
          flipDirection: 'flip-prev'
        });
      }
    }
  },

  onTouchEnd(e) {
    if (!this.isTouching) return;
    this.isTouching = false;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const duration = Date.now() - this.touchStartTime;
    
    // 计算当前全局页码
    const globalPage = this.windowStart + this.data.currentPage;
    
    // 快速滑动或滑动距离超过阈值
    const isQuickFlip = duration < 300 && Math.abs(deltaX) > 50;
    const isLongFlip = Math.abs(deltaX) > FLIP_THRESHOLD;
    
    if (isQuickFlip || isLongFlip) {
      if (deltaX < 0 && globalPage < this.data.totalPages - 1) {
        // 翻到下一页
        this.flipToPage(globalPage + 1, 'next');
      } else if (deltaX > 0 && globalPage > 0) {
        // 翻到上一页
        this.flipToPage(globalPage - 1, 'prev');
      } else {
        // 恢复原位
        this.resetFlip();
      }
    } else {
      // 恢复原位
      this.resetFlip();
    }
  },

  flipToPage(targetGlobalPage, direction) {
    // 检查全局边界
    if (targetGlobalPage < 0 || targetGlobalPage >= this.data.totalPages) {
      this.resetFlip();
      return;
    }
    
    // 播放翻页音效
    this.playFlipSound();
    
    this.setData({
      isFlipping: true,
      flipAngle: direction === 'next' ? -15 : 15,
      pageAnimClass: ''
    });

    // 动画完成后更新页面
    this.schedule(() => {
      // 先更新滑动窗口
      this.checkAndUpdateWindow(targetGlobalPage);
      
      // 窗口更新后计算在窗口内的索引
      const newCurrentInWindow = targetGlobalPage - this.windowStart;
      
      this.setData({
        currentPage: newCurrentInWindow,
        isFlipping: false,
        flipAngle: 0,
        flipDirection: '',
        pageAnimClass: 'page-enter'
      });
      
      // 更新当前页面数据
      this.updateCurrentPageData(newCurrentInWindow);
      
      // 清除动画类
      this.schedule(() => {
        this.setData({ pageAnimClass: '' });
      }, 500);
    }, 300);
  },

  schedule(callback, delay) {
    if (!this._timers) {
      this._timers = new Set();
    }

    const timer = setTimeout(() => {
      this._timers.delete(timer);
      if (this._isPageActive) {
        callback();
      }
    }, delay);
    this._timers.add(timer);
    return timer;
  },

  clearAllTimers() {
    if (!this._timers) {
      return;
    }
    this._timers.forEach(timer => clearTimeout(timer));
    this._timers.clear();
  },

  resetFlip() {
    this.setData({
      flipAngle: 0,
      flipDirection: '',
      isFlipping: false
    });
  },

  updateCurrentPageData(pageIndex) {
    const pageList = this.data.pageList;
    const currentData = pageList[pageIndex] || null;
    const prevData = pageIndex > 0 ? pageList[pageIndex - 1] : null;
    const nextData = pageIndex < pageList.length - 1 ? pageList[pageIndex + 1] : null;
    
    // 计算全局页码
    const globalPage = (this.windowStart || 0) + pageIndex;
    
    // 释放之前预览的原图缓存
    this.releasePreviewImage();
    
    this.setData({
      currentPageData: currentData,
      prevPageData: prevData,
      nextPageData: nextData,
      globalCurrentPage: globalPage
    });
    
    // 预加载附近图片
    this.preloadNearbyImages(pageIndex);
  },
  
  // 释放原图预览缓存
  releasePreviewImage() {
    if (this.currentPreviewUrl) {
      console.log('[内存释放] 释放原图缓存:', this.currentPreviewUrl);
      this.currentPreviewUrl = null;
    }
  },

  // ==================== 导航功能 ====================

  goPrevPage() {
    const globalPage = this.windowStart + this.data.currentPage;
    if (globalPage > 0 && !this.data.isFlipping) {
      this.flipToPage(globalPage - 1, 'prev');
    }
  },

  goNextPage() {
    const globalPage = this.windowStart + this.data.currentPage;
    if (globalPage < this.data.totalPages - 1 && !this.data.isFlipping) {
      this.flipToPage(globalPage + 1, 'next');
    }
  },

  goToStart() {
    this.jumpToPage(0);
    this.setData({ showFlipHint: true });
  },

  showCatalogModal() {
    this.setData({ showCatalog: true });
  },

  hideCatalogModal() {
    this.setData({ 
      showCatalog: false,
      searchKeyword: '',
      searchResults: []
    });
  },

  preventBubble() {
    // 阻止事件冒泡
  },

  // ==================== 搜索功能 ====================
  
  onSearchInput(e) {
    const keyword = e.detail.value.trim();
    this.setData({ searchKeyword: keyword });
    
    if (keyword) {
      this.doSearch(keyword);
    } else {
      this.setData({ searchResults: [] });
    }
  },
  
  onSearchConfirm(e) {
    const keyword = e.detail.value.trim();
    if (keyword) {
      this.doSearch(keyword);
    }
  },
  
  clearSearch() {
    this.setData({ 
      searchKeyword: '',
      searchResults: []
    });
  },
  
  doSearch(keyword) {
    if (!this.allWorks || !keyword) return;
    
    const lowerKeyword = keyword.toLowerCase();
    const results = [];
    
    // 在所有作品中模糊匹配
    this.allWorks.forEach(work => {
      const name = (work.artworkName || '').toLowerCase();
      if (name.includes(lowerKeyword)) {
        // 查找该作品对应的页面索引
        const pageIndex = this.pageByWorkId && this.pageByWorkId.get(work._id);
        if (typeof pageIndex === 'number') {
          results.push({
            _id: work._id,
            artworkName: this.formatArtworkName(work.artworkName),
            authorName: this.formatArray(work.authorName),
            pageIndex: pageIndex
          });
        }
      }
    });
    
    // 限制显示数量
    this.setData({ searchResults: results.slice(0, 20) });
  },
  
  jumpToWork(e) {
    const targetPage = e.currentTarget.dataset.page;
    this.jumpToPage(targetPage);
    this.hideCatalogModal();
  },

  jumpToCategory(e) {
    const targetPage = e.currentTarget.dataset.page;
    this.jumpToPage(targetPage);
    this.hideCatalogModal();
  },

  jumpToPage(targetPage) {
    // 更新窗口到目标页附近
    const pageIndex = this.fullPageIndex;
    const totalPages = pageIndex.length;
    
    const idealStart = Math.max(0, targetPage - WINDOW_SIZE);
    const idealEnd = Math.min(totalPages, targetPage + WINDOW_SIZE + 1);
    
    const newPageList = this.buildPageListForRange(idealStart, idealEnd);
    const newCurrentIndex = targetPage - idealStart;

    this.windowStart = idealStart;
    this.windowEnd = idealEnd;

    this.setData({
      pageList: newPageList,
      currentPage: newCurrentIndex
    });
    
    // 更新当前页面数据
    this.updateCurrentPageData(newCurrentIndex);
  },

  goToHome() {
    wx.switchTab({
      url: '/pages/home/index'
    });
  },

  // ==================== 图片处理 ====================

  getCompressedImageUrl(url) {
    if (!url) return '';
    // 云存储图片添加压缩参数（宽度800，质量75%）
    if (url.includes('cloud://') || url.includes('tcb.qcloud.la')) {
      return url + '?imageMogr2/thumbnail/800x/quality/75';
    }
    return url;
  },

  preloadNearbyImages(current) {
    const pageList = this.data.pageList;
    
    // 预加载前后2页的图片
    for (let i = -2; i <= 2; i++) {
      const idx = current + i;
      if (idx >= 0 && idx < pageList.length) {
        const page = pageList[idx];
        if (page.type === 'work' && page.imageUrl) {
          wx.getImageInfo({
            src: page.imageUrl,
            success: () => {},
            fail: () => {}
          });
        }
      }
    }
  },

  onImageTap(e) {
    const originalUrl = e.currentTarget.dataset.originalUrl;
    if (originalUrl) {
      // 记录当前预览的原图URL
      this.currentPreviewUrl = originalUrl;
      
      // 使用微信原生预览（支持缩放、保存等功能）
      wx.previewImage({
        urls: [originalUrl],
        current: originalUrl,
        success: () => {
          console.log('[图片预览] 加载原图:', originalUrl);
        }
      });
    }
  },
  
  hideImagePreview() {
    this.setData({
      showImagePreview: false,
      previewImageUrl: ''
    });
  },

  onImageError(e) {
    const index = e.currentTarget.dataset.index;
    console.warn('[图片加载失败] pageIndex:', index);
  },

  // ==================== 内存管理 ====================

  releaseDistantData(keepStart, keepEnd) {
    // 清理不在窗口范围内的缓存数据
    const totalPages = this.fullPageIndex ? this.fullPageIndex.length : 0;
    
    console.log(`[内存管理] 保留窗口: ${keepStart}-${keepEnd}, 总页数: ${totalPages}`);
    
    // 如果收到内存警告，缩小窗口大小
    if (this.data.memoryWarning) {
      console.log('[内存警告] 缩小数据窗口');
      this.setData({ memoryWarning: false });
      
      // 只保留当前页前后各2页
      const current = this.data.currentPage;
      const minStart = Math.max(0, this.windowStart + current - 2);
      const minEnd = Math.min(totalPages, this.windowStart + current + 3);
      
      if (minEnd - minStart < this.data.pageList.length) {
        const reducedList = this.buildPageListForRange(minStart, minEnd);
        const newCurrentIndex = (this.windowStart + current) - minStart;
        
        this.windowStart = minStart;
        this.windowEnd = minEnd;
        
        this.setData({
          pageList: reducedList,
          currentPage: newCurrentIndex
        });
        
        this.updateCurrentPageData(newCurrentIndex);
      }
    }
  },

  releaseMemory() {
    console.log('[释放内存] 执行内存清理');
    
    // 主动触发垃圾回收（通过清空不需要的引用）
    if (this.allWorks && this.allWorks.length > 100) {
      // 只保留当前窗口需要的作品数据
      const currentIds = new Set();
      const pageList = this.data.pageList || [];
      pageList.forEach(page => {
        if (page.workId) currentIds.add(page.workId);
      });
      
      // 标记其他作品的大字段为null（不删除，因为可能还需要）
      this.allWorks.forEach(work => {
        if (!currentIds.has(work._id)) {
          work._tempReleased = true;
        }
      });
    }
    
    // 检查存储缓存
    wx.getStorageInfo({
      success: (res) => {
        if (res.currentSize > 30 * 1024) {
          console.log('[存储缓存] 当前大小:', res.currentSize, 'KB');
        }
      }
    });
  },

  clearAllCache() {
    // 清理所有缓存数据
    this.fullPageIndex = null;
    this.allWorks = null;
    this.worksById = null;
    this.pageByWorkId = null;
    this.categoryDataCache = {};
    this.windowStart = 0;
    this.windowEnd = 0;
    
    console.log('[缓存已清理] 所有数据引用已释放');
  },

  // ==================== 工具函数 ====================

  formatArray(arr) {
    if (!arr) return '';
    if (Array.isArray(arr)) {
      return arr.join('、');
    }
    return String(arr);
  },

  // 格式化材质（去掉末尾标点）
  formatCraftMaterial(material) {
    if (!material) return '陶瓷';
    let text = material.trim();
    // 去掉末尾标点符号
    const punctuation = /[。，！？；：、《》“”‘’（）【】.,!?;:"'()\[\]]+$/;
    text = text.replace(punctuation, '');
    return text || '陶瓷';
  },

  // 格式化作品名称（处理书名号）
  formatArtworkName(name) {
    if (!name) return '未命名作品';
    const trimmed = name.trim();
    // 如果已有书名号，直接返回
    if (trimmed.startsWith('《') && trimmed.endsWith('》')) {
      return trimmed;
    }
    // 否则添加书名号
    return `《${trimmed}》`;
  },

  // 格式化尺寸显示（支持多组）
  formatDimensions(dimensions) {
    if (!dimensions) return '';
    
    // 格式化单组尺寸
    const formatOne = (dim) => {
      if (!dim) return '';
      const parts = [];
      if (dim.length) parts.push(`长${dim.length}cm`);
      if (dim.width) parts.push(`宽${dim.width}cm`);
      if (dim.height) parts.push(`高${dim.height}cm`);
      return parts.join('×');
    };
    
    // dimensions 是数组，显示全部
    if (Array.isArray(dimensions) && dimensions.length > 0) {
      const results = dimensions.map(formatOne).filter(s => s);
      return results.join('；');  // 多组用分号分隔
    }
    
    // 单个对象
    return formatOne(dimensions);
  },

  // ==================== 分享功能 ====================

  onShareAppMessage() {
    // 获取当前页面的作品图片作为分享图
    const currentPageData = this.data.pageList[this.data.currentPage];
    const shareImageUrl = (currentPageData && currentPageData.type === 'work') 
      ? currentPageData.imageUrl 
      : '';
    
    return {
      title: '第二届全国大学生陶艺作品展 - 作品画册',
      path: '/pages/pottery-catalog/index',
      imageUrl: shareImageUrl
    };
  },

  onShareTimeline() {
    const currentPageData = this.data.pageList[this.data.currentPage];
    const shareImageUrl = (currentPageData && currentPageData.type === 'work') 
      ? currentPageData.imageUrl 
      : '';
    
    return {
      title: '第二届全国大学生陶艺作品展 - 作品画册',
      query: '',
      imageUrl: shareImageUrl
    };
  }
});
