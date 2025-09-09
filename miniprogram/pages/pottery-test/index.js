// pages/pottery-test/index.js
Page({
  data: {
    result: '',
    loading: false,
    queryResult: '',
    queryLoading: false
  },

  // 调用上传测试数据的云函数
  uploadTestData() {
    this.setData({
      loading: true,
      result: '正在上传测试数据...'
    });

    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'uploadTestPotteryData'
      },
      success: res => {
        console.log('云函数调用成功:', res);
        this.setData({
          result: JSON.stringify(res.result, null, 2)
        });
      },
      fail: err => {
        console.error('云函数调用失败:', err);
        this.setData({
          result: '云函数调用失败: ' + JSON.stringify(err)
        });
      },
      complete: () => {
        this.setData({
          loading: false
        });
      }
    });
  },
  
  // 查询最新数据
  queryLatestData() {
    this.setData({
      queryLoading: true,
      queryResult: '正在查询最新数据...'
    });
    
    // 获取数据库引用
    const db = wx.cloud.database();
    
    // 查询最新记录
    db.collection('pottery_submissions')
      .orderBy('createdAt', 'desc') // 按创建时间降序排列
      .limit(1) // 只获取一条记录
      .get()
      .then(res => {
        console.log('查询结果:', res.data);
        
        if (res.data && res.data.length > 0) {
          // 格式化JSON数据便于阅读
          this.setData({
            queryResult: JSON.stringify(res.data[0], null, 2)
          });
        } else {
          this.setData({
            queryResult: '未找到记录'
          });
        }
      })
      .catch(err => {
        console.error('查询失败:', err);
        this.setData({
          queryResult: '查询失败: ' + JSON.stringify(err)
        });
      })
      .finally(() => {
        this.setData({
          queryLoading: false
        });
      });
  }
}); 