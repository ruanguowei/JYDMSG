const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findTagErrors } = require('../scripts/check-wxml-syntax');

test('比较运算符不会截断引号内的属性或自闭合图片', () => {
  const source = `<view wx:if="{{items.length > 1}}"><image wx:if="{{index >= current - 1 && index <= current + 1}}" src="image.jpg" /><text wx:if='{{score > 0}}'>有效</text></view>`;
  assert.deepEqual(findTagErrors(source), []);
});

test('注释内的标签不参与配对，多行和单双引号属性均可解析', () => {
  const source = `<!-- <view><image /></bad> -->
<view title="包含 '单引号' 和 > 的说明">
  <image
    title='包含 "双引号" 和 < 的说明'
    src="image.jpg"
  />
</view>`;
  assert.deepEqual(findTagErrors(source), []);
});

test('即使属性含比较运算符，真正缺失结束标签仍会失败', () => {
  const errors = findTagErrors('<view wx:if="{{score > 0}}"><text>缺少结束标签</text>');
  assert.ok(errors.some(error => error.includes('未关闭标签 <view>')));
});

test('真正错误的标签配对和多余结束标签仍会失败', () => {
  assert.ok(findTagErrors('<view><text>错配</view>').length > 0);
  assert.ok(findTagErrors('</view>').length > 0);
});

test('旧专家评分页的完整模板不再被比较表达式误报', () => {
  const source = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/expert-scoring/index.wxml'), 'utf8');
  assert.deepEqual(findTagErrors(source), []);
});
