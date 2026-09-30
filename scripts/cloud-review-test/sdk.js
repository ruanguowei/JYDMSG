// Every business collection is mapped to an isolated live test collection.
// Unknown names, including the original submissions collection, are rejected.
const real = require('wx-server-sdk');
real.init({ env: real.DYNAMIC_CURRENT_ENV });
const names = {
  experts: 'review_probe_0912a_experts', exhibition_editions: 'review_probe_0912a_config',
  edition_controls: 'review_probe_0912a_controls', expertLoginLogs: 'review_probe_0912a_logs',
  pottery_submissions_clean_2026: 'review_probe_0912a_clean',
  pottery_submissions_for_final_2026: 'review_probe_0912a_final'
};
function scoped(db) {
  return {
    command: db.command,
    collection(name) {
      if (!Object.hasOwnProperty.call(names, name)) throw new Error('TEST_COLLECTION_DENIED');
      return db.collection(names[name]);
    },
    runTransaction: callback => db.runTransaction(tx => callback(scoped(tx)))
  };
}
module.exports = {
  init() {}, DYNAMIC_CURRENT_ENV: real.DYNAMIC_CURRENT_ENV,
  database: () => scoped(real.database()),
  getWXContext: () => ({}),
  getTempFileURL: args => real.getTempFileURL(args)
};
