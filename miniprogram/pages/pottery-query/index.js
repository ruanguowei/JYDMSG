// pages/pottery-query/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    submissions: [], // 所有申请记录
    loading: false,
    showDetailsModal: false,
    currentSubmission: null,
    currentIndex: -1,
    statusText: {
      'pending': '审核中',
      'approved': '已通过',
      'rejected': '未通过'
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.fetchAllSubmissions();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次进入页面时自动刷新数据
    this.fetchAllSubmissions();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.fetchAllSubmissions(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 获取用户的所有参展申请记录
   */
  fetchAllSubmissions(callback) {
    this.setData({ loading: true });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'fetchAllSubmissions'
      },
      success: res => {
        console.log('获取申请记录成功', res);
        if (res.result && res.result.success) {
          // 查询成功，显示结果
          this.setData({
            submissions: res.result.data || []
          });
        } else {
          // 查询失败
          this.showToast('获取申请记录失败');
          console.error('获取申请记录失败', res);
        }
      },
      fail: err => {
        console.error('调用云函数失败', err);
        this.showToast('网络请求失败，请稍后重试');
      },
      complete: () => {
        this.setData({ loading: false });
        if (typeof callback === 'function') {
          callback();
        }
      }
    });
  },

  /**
   * 显示申请详情
   */
  showDetails(e) {
    const index = e.currentTarget.dataset.index;
    const submission = this.data.submissions[index];
    
    this.setData({
      currentSubmission: submission,
      currentIndex: index,
      showDetailsModal: true
    });
  },

  /**
   * 隐藏详情弹窗
   */
  hideDetails() {
    this.setData({
      showDetailsModal: false
    });
  },

  /**
   * 确认删除申请记录
   */
  confirmDelete(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除作品"${name}"的申请记录吗？删除后将无法恢复。`,
      confirmText: '删除',
      confirmColor: '#E64340',
      success: res => {
        if (res.confirm) {
          this.deleteSubmission(id);
        }
      }
    });
  },

  /**
   * 删除申请记录
   */
  deleteSubmission(id) {
    wx.showLoading({
      title: '删除中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'deleteSubmission',
        data: {
          submissionId: id
        }
      },
      success: res => {
        console.log('删除结果', res);
        if (res.result && res.result.success) {
          // 删除成功，刷新列表
          this.showToast('删除成功');
          this.fetchAllSubmissions();
        } else {
          this.showToast('删除失败，请重试');
          console.error('删除失败', res);
        }
      },
      fail: err => {
        console.error('调用云函数失败', err);
        this.showToast('网络错误，请重试');
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  /**
   * 预览图片
   */
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = e.currentTarget.dataset.urls;
    
    wx.previewImage({
      current: url,
      urls: urls
    });
  },

  /**
   * 显示修改选项弹窗
   */
  showEditOptions(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    const index = e.currentTarget.dataset.index;
    
    wx.showActionSheet({
      itemList: ['修改申请', '删除申请'],
      success: res => {
        if (res.tapIndex === 0) {
          // 用户选择了"修改申请"
          this.navigateToEdit(id, index);
        } else if (res.tapIndex === 1) {
          // 用户选择了"删除申请"
          this.confirmDelete({
            currentTarget: {
              dataset: {
                id: id,
                name: name
              }
            }
          });
        }
      }
    });
  },

  /**
   * 跳转到修改页面
   */
  navigateToEdit(id, index) {
    const submission = this.data.submissions[index];
    
    // 将申请数据存储到缓存中，供修改页面使用
    wx.setStorageSync('editSubmission', submission);
    
    // 跳转到提交页面，并传递编辑模式参数
    wx.navigateTo({
      url: `/pages/pottery-submission/index?mode=edit&id=${id}`
    });
  },

  /**
   * 显示提示信息
   */
  showToast(title) {
    wx.showToast({
      title: title,
      icon: 'none',
      duration: 2000
    });
  }
})