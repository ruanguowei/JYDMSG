Page({
  data: {
    artwork: {
      id: '',
      title: '山水之间',
      rating: '4.8',
      ratingCount: 56,
      imageUrl: '../../images/artwork.jpg',
      tags: ['绘画', '风景', '水墨'],
      author: {
        name: '张三',
        department: '陶瓷艺术学院',
        grade: '2022'
      },
      description: '这件作品受中国传统山水画启发，融合了现代艺术的表现手法。我尝试通过色彩的变化和空间的层次，表达出山水之间的自然之美和内在精神。画面中的山峦起伏，水流潺潺，试图营造出一种宁静与流动并存的和谐感，引导观者进入一个远离尘嚣的精神世界。',
      comment: {
        content: '作品在传统与现代的融合上做得相当出色，笔触细腻而富有表现力。构图上层次分明，意境深远，是一件非常优秀的青年艺术家作品。',
        author: '李教授',
        department: '美术学院'
      }
    },
    showRatingModal: false,
    currentRating: 0
  },

  onLoad: function(options) {
    // 获取作品ID参数
    const artworkId = options.id;
    if (artworkId) {
      this.setData({
        'artwork.id': artworkId
      });
      // 根据ID获取作品数据
      this.fetchArtworkDetail(artworkId);
    }
  },

  // 获取作品详情数据
  fetchArtworkDetail: function(id) {
    // 从云数据库获取作品详情
    wx.cloud.callFunction({
      name: 'getArtworkDetail',
      data: { id },
      success: res => {
        if (res.result && res.result.data) {
          this.setData({
            artwork: res.result.data
          });
        }
      },
      fail: err => {
        console.error('获取作品详情失败', err);
        wx.showToast({
          title: '加载数据失败',
          icon: 'none'
        });
      }
    });
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack();
  },

  // 显示评分弹窗
  showRatingModal: function() {
    this.setData({
      showRatingModal: true
    });
  },

  // 隐藏评分弹窗
  hideRatingModal: function() {
    this.setData({
      showRatingModal: false,
      currentRating: 0
    });
  },

  // 设置当前评分
  setRating: function(e) {
    const rating = e.currentTarget.dataset.rating;
    this.setData({
      currentRating: rating
    });
  },

  // 提交评分
  submitRating: function() {
    if (this.data.currentRating === 0) {
      wx.showToast({
        title: '请先选择评分',
        icon: 'none'
      });
      return;
    }

    const { id } = this.data.artwork;
    const { currentRating } = this.data;

    // 调用云函数提交评分
    wx.cloud.callFunction({
      name: 'submitRating',
      data: {
        artworkId: id,
        rating: currentRating
      },
      success: res => {
        wx.showToast({
          title: '评分成功',
          icon: 'success'
        });
        // 更新评分显示
        this.fetchArtworkDetail(id);
        // 隐藏弹窗
        this.hideRatingModal();
      },
      fail: err => {
        console.error('提交评分失败', err);
        wx.showToast({
          title: '评分失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 分享功能
  onShareAppMessage: function() {
    const { id, title, imageUrl } = this.data.artwork;
    return {
      title: `【景德镇艺术职业大学美术馆】${title}`,
      path: `/pages/artwork-detail/index?id=${id}`,
      imageUrl: imageUrl
    };
  }
}); 