// update-award-status.js
// 用于调用云函数更新获奖状态的测试脚本
// 使用方法：在微信开发者工具中运行，或使用云函数测试工具

const fs = require('fs');
const path = require('path');

// 读取获奖名单JSON文件
const awardListPath = path.join(__dirname, '其他文件', '获奖名单.json');

try {
  // 读取获奖名单
  const awardListJson = fs.readFileSync(awardListPath, 'utf8');
  const awardList = JSON.parse(awardListJson);
  
  console.log('✅ 成功读取获奖名单');
  console.log('技艺类:', awardList.技艺类.length, '件');
  console.log('文脉类:', awardList.文脉类.length, '件');
  console.log('算法类:', awardList.算法类.length, '件');
  console.log('产业类:', awardList.产业类.length, '件');
  console.log('');
  
  // 准备云函数调用参数
  const cloudFunctionParams = {
    awardList: awardList,
    mode: 'best-effort'  // 执行模式：best-effort（尽力而为）、all-or-nothing（全部成功才执行）、stop-on-error（遇到错误停止）
  };
  
  console.log('云函数调用参数已准备');
  console.log('执行模式:', cloudFunctionParams.mode);
  console.log('');
  console.log('========================================');
  console.log('请在微信开发者工具中调用云函数：');
  console.log('函数名: updateAwardStatus');
  console.log('参数:', JSON.stringify(cloudFunctionParams, null, 2));
  console.log('========================================');
  
  // 如果是在微信开发者工具环境中，可以直接调用
  if (typeof wx !== 'undefined' && wx.cloud) {
    wx.cloud.callFunction({
      name: 'updateAwardStatus',
      data: cloudFunctionParams,
      success: res => {
        console.log('✅ 云函数调用成功');
        console.log('返回结果:', JSON.stringify(res.result, null, 2));
      },
      fail: err => {
        console.error('❌ 云函数调用失败:', err);
      }
    });
  } else {
    console.log('');
    console.log('注意：此脚本需要在微信开发者工具中运行，或手动复制参数到云函数测试工具');
  }
  
} catch (error) {
  console.error('❌ 读取获奖名单失败:', error.message);
  console.error('请确保文件路径正确:', awardListPath);
}






