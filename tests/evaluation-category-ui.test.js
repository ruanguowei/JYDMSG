const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
function fixture() {
 let page;const requests=[];const nav=[];
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../miniprogram/pages/expert-evaluation/index.js'),'utf8'),{
  require:createRequire(path.resolve(__dirname,'../miniprogram/pages/expert-evaluation/index.js')),
  getApp:()=>({globalData:{}}),Page:p=>{page=p;},wx:{ cloud:{callFunction:r=>requests.push(r)},navigateTo:r=>nav.push(r),showToast:()=>{}},setTimeout,clearTimeout,console
 });
 page.setData=p=>Object.assign(page.data,p);page._isPageActive=true;page.data.expertInfo={expertCode:'e'};
 return {page,requests,nav};
}
function result(category, n=8) {
 return { result:{success:true,data:Array.from({length:n},(_,i)=>({id:String(i),category})),categories:[{key:'technique',name:'传统类'},{key:'culture',name:'当代类'}],statistics:{total:n,evaluated:0,unevaluated:n}} };
}
test('快速切换类别时丢弃旧响应，只打开当前类别第一件并保留5件待评缓存',()=>{
 const {page,requests,nav}=fixture();
 page.selectCategory({currentTarget:{dataset:{category:'technique'}}});
 page.selectCategory({currentTarget:{dataset:{category:'culture'}}});
 requests[1].success(result('culture'));requests[0].success(result('technique'));
 assert.equal(page.data.submissions.length,5);assert.ok(page.data.submissions.every(w=>w.category==='culture'));
 assert.equal(nav.length,1);assert.match(nav[0].url,/submissionId=0&category=culture/);
});
test('隐藏页面的迟到响应不更新UI；只允许打开当前类别作品并防止连点',()=>{
 const {page,requests,nav}=fixture();
 page.selectCategory({currentTarget:{dataset:{category:'technique'}}});
 page.onHide();requests[0].success(result('technique'));assert.equal(page.data.submissions.length,0);
 page._isPageActive=true;page.fetchSubmissions();requests[1].success(result('technique'));
 page.navigateToScoring({currentTarget:{dataset:{id:'bad'}}});assert.equal(nav.length,1);
 page.navigateToScoring({currentTarget:{dataset:{id:'0'}}});page.navigateToScoring({currentTarget:{dataset:{id:'0'}}});
 assert.equal(nav.length,1);assert.match(nav[0].url,/category=technique/);
});
test('连续300轮切换和加载只保留一批，首页不请求作品详情',()=>{
 const {page,requests}=fixture();page.fetchSubmissions();assert.equal(requests[0].data.summaryOnly,true);
 requests[0].success(result('technique'));assert.equal(page.data.submissions.length,0);
 for(let i=0;i<300;i++){
  page.onHide();page.onShow();assert.equal(page.data.selectedCategory,'');assert.equal(requests.at(-1).data.summaryOnly,true);
  const key=i%2?'culture':'technique';page.selectCategory({currentTarget:{dataset:{category:key}}});
  requests.at(-1).success(result(key,50));assert.equal(page.data.submissions.length,5);
 }
 page.onUnload();assert.equal(page._submissionsRequestPending,false);
});


test('类别没有待评作品时留在类别页，不跳转详情',()=>{
 const {page,requests,nav}=fixture();
 page.selectCategory({currentTarget:{dataset:{category:'technique'}}});
 requests[0].success(result('technique',0));
 assert.equal(nav.length,0);assert.equal(page.data.selectedCategory,'');
 assert.equal(requests.at(-1).data.summaryOnly,true);
});

test('导航失败后可以重新点击类别进入详情',()=>{
 const {page,requests,nav}=fixture();
 const event={currentTarget:{dataset:{category:'technique'}}};
 page.selectCategory(event);requests[0].success(result('technique'));
 nav[0].fail();assert.equal(page._navigating,false);assert.ok(page.data.listError);
 page.selectCategory(event);requests[1].success(result('technique'));
 assert.equal(nav.length,2);
});
