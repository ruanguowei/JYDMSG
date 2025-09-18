// pages/appointment/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    year: 0,
    month: 0,
    days: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    timeSlots: [
      { time: '09:00-10:00', available: true, selected: false },
      { time: '10:00-11:00', available: true, selected: false },
      { time: '11:00-12:00', available: true, selected: false },
      { time: '14:00-15:00', available: true, selected: false },
      { time: '15:00-16:00', available: true, selected: false },
      { time: '16:00-17:00', available: true, selected: false }
    ],
    reason: '',
    visitors: '',
    visitorRange: Array.from({length: 100}, (_, i) => i + 1), // 1-100的数组
    visitorIndex: 0, // 默认选择第一个值（1人）
    selectedDate: null,
    selectedTimeIndex: -1,
    reservationName: '', // 预约人姓名
    reservationPhone: '', // 联系方式
    showSuccessModal: false,
    showErrorModal: false,
    errorMessage: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.initCalendar();
    
    // 初始化参观人数为1
    this.setData({
      visitors: '1'
    });
  },

  /**
   * 初始化日历
   */
  initCalendar() {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    this.setData({
      year,
      month
    });
    
    this.generateDays(year, month);
  },

  /**
   * 生成日历天数
   */
  generateDays(year, month) {
    const days = [];
    const date = new Date(year, month - 1, 1);
    const today = new Date();
    
    // 获取月初是星期几
    const firstDay = date.getDay();
    
    // 填充月初前的空白
    for (let i = 0; i < firstDay; i++) {
      days.push({
        date: 0,
        available: false,
        selected: false,
        current: false
      });
    }
    
    // 获取当月天数
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(year, month - 1, i);
      const isToday = today.getFullYear() === year && 
                    today.getMonth() === month - 1 && 
                    today.getDate() === i;
      
      // 假设周一和今天及之前的日期不可预约，周六周日可以预约
      const isMonday = currentDate.getDay() === 1; // 周一
      const isPast = currentDate < new Date(today.setHours(0, 0, 0, 0));
      const available = !isPast && !isMonday; // 周一不可预约，周六周日可以预约
      
      days.push({
        date: i,
        available: available,
        selected: false,
        current: isToday
      });
    }
    
    this.setData({ days });
  },

  /**
   * 切换到上个月
   */
  prevMonth() {
    let { year, month } = this.data;
    
    if (month === 1) {
      year--;
      month = 12;
    } else {
      month--;
    }
    
    this.setData({
      year,
      month
    });
    
    this.generateDays(year, month);
  },

  /**
   * 切换到下个月
   */
  nextMonth() {
    let { year, month } = this.data;
    
    if (month === 12) {
      year++;
      month = 1;
    } else {
      month++;
    }
    
    this.setData({
      year,
      month
    });
    
    this.generateDays(year, month);
  },

  /**
   * 选择日期
   */
  selectDate(e) {
    const { date, available } = e.currentTarget.dataset;
    
    if (date === 0 || !available) {
      return;
    }
    
    const { days, year, month } = this.data;
    const newDays = days.map(day => {
      return {
        ...day,
        selected: day.date === date
      };
    });
    
    this.setData({
      days: newDays,
      selectedDate: {
        year,
        month,
        day: date
      }
    });

    // 重置时段选择并更新可用性
    const now = new Date();
    const selectedDateObj = new Date(year, month - 1, date);
    const isToday = now.getFullYear() === year && 
                   now.getMonth() === month - 1 && 
                   now.getDate() === date;
    
    const timeSlots = this.data.timeSlots.map(slot => {
      let available = true;
      
      // 如果是今天，检查时间段是否已过
      if (isToday) {
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute; // 转换为分钟
        
        // 解析时间段的开始时间
        const timeRange = slot.time.split('-')[0]; // 取开始时间，如 "09:00"
        const [hour, minute] = timeRange.split(':').map(Number);
        const slotTime = hour * 60 + minute;
        
        // 如果时间段已过，则不可预约
        if (slotTime <= currentTime) {
          available = false;
        }
      }
      
      return {
        ...slot,
        selected: false,
        available: available
      };
    });
    
    this.setData({
      timeSlots,
      selectedTimeIndex: -1
    });
  },

  /**
   * 选择时段
   */
  selectTimeSlot(e) {
    const { index } = e.currentTarget.dataset;
    const { timeSlots } = this.data;
    
    if (!timeSlots[index].available) {
      return;
    }
    
    const newTimeSlots = timeSlots.map((slot, i) => {
      return {
        ...slot,
        selected: i === index
      };
    });
    
    this.setData({
      timeSlots: newTimeSlots,
      selectedTimeIndex: index
    });
  },

  /**
   * 选择参观人数
   */
  onVisitorChange(e) {
    const index = e.detail.value;
    const visitors = this.data.visitorRange[index].toString();
    
    this.setData({
      visitorIndex: index,
      visitors: visitors
    });
  },

  /**
   * 输入来访事由
   */
  inputReason(e) {
    this.setData({
      reason: e.detail.value
    });
  },

  /**
   * 输入预约人姓名
   */
  inputReservationName(e) {
    this.setData({
      reservationName: e.detail.value
    });
  },

  /**
   * 输入联系方式
   */
  inputReservationPhone(e) {
    this.setData({
      reservationPhone: e.detail.value
    });
  },

  /**
   * 显示错误弹窗
   */
  showError(message) {
    this.setData({
      showErrorModal: true,
      errorMessage: message
    });
  },

  /**
   * 关闭错误弹窗
   */
  closeErrorModal() {
    this.setData({
      showErrorModal: false,
      errorMessage: ''
    });
  },

  /**
   * 提交预约
   */
  submitAppointment() {
    const { selectedDate, selectedTimeIndex, reason, visitors, reservationName, reservationPhone } = this.data;
    
    // 验证表单
    if (!selectedDate) {
      this.showError('请选择预约日期');
      return;
    }
    
    if (selectedTimeIndex === -1) {
      this.showError('请选择预约时段');
      return;
    }
    
    if (!reservationName || reservationName.trim() === '') {
      this.showError('请填写预约人姓名');
      return;
    }
    
    if (!reservationPhone || reservationPhone.trim() === '') {
      this.showError('请填写联系方式');
      return;
    }
    
    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(reservationPhone)) {
      this.showError('请输入正确的手机号码');
      return;
    }
    
    if (!reason || reason.trim() === '') {
      this.showError('请填写来访事由');
      return;
    }
    
    // 调用云函数提交预约
    wx.showLoading({
      title: '提交中...',
    });
    
    // 构建预约数据
    const appointmentData = {
      date: `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`,
      time: this.data.timeSlots[selectedTimeIndex].time,
      reason: reason.trim(),
      visitors: parseInt(visitors),
      reservationName: reservationName.trim(),
      reservationPhone: reservationPhone.trim(),
      status: 'approved', // 预约状态：直接设为已通过(approved)
      createTime: new Date().getTime()
    };
    
    // 调用云函数
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'createAppointment',
        data: appointmentData
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          // 显示成功弹窗
          this.setData({
            showSuccessModal: true
          });
        } else {
          this.showError('预约失败，请重试');
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('预约失败', err);
        this.showError('网络异常，请重试');
      }
    });
  },

  /**
   * 关闭成功弹窗
   */
  closeSuccessModal() {
    this.setData({
      showSuccessModal: false
    });
    
    // 返回上一页
    wx.navigateBack();
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    return;
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

  }
})