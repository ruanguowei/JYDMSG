const real=require('wx-server-sdk');real.init({env:real.DYNAMIC_CURRENT_ENV});
const allowed=new Set(['experts','exhibition_editions','edition_controls','pottery_submissions_clean_2026']);
function wrap(db){return{command:db.command,collection(name){if(!allowed.has(name))throw Error('PROTECTED_COLLECTION');return db.collection(name);},runTransaction:fn=>db.runTransaction(tx=>fn(wrap(tx)))};}
module.exports={init(){},DYNAMIC_CURRENT_ENV:real.DYNAMIC_CURRENT_ENV,database:()=>wrap(real.database()),getWXContext:()=>({}),getTempFileURL:args=>real.getTempFileURL(args)};
