// Offline SDK substitute. No credentials, HTTP client or real SDK can be loaded.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const clone = value => structuredClone(value);

function createOfflineCloud(initial, writableCollections) {
  const data = clone(initial), writes = [], attemptedWrites = [];
  const writable = new Set(writableCollections);
  let lock = Promise.resolve(), generatedId = 0;
  function database(journal) {
    function assertWrite(name, id) {
      attemptedWrites.push({ collection: name, id });
      if (!writable.has(name)) throw new Error(`离线模拟禁止写入受保护表：${name}`);
      if (journal && !journal.has(JSON.stringify([name, id]))) {
        const index = data[name].findIndex(row => row._id === id);
        journal.set(JSON.stringify([name, id]), { name, id, index, row: clone(data[name][index]) });
      }
      writes.push({ collection: name, id });
    }
    return {
      command: { neq: value => ({ operation: 'neq', value }) },
      collection(name) {
        if (!data[name]) data[name] = [];
        function query(state = {}) {
          const matching = () => {
            let rows = data[name].filter(row => Object.entries(state.filter || {}).every(([key, value]) =>
              value && value.operation === 'neq' ? row[key] !== value.value : row[key] === value));
            if (state.order) {
              const [key, direction] = state.order;
              rows = rows.slice().sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (direction === 'desc' ? -1 : 1));
            }
            return rows;
          };
          return {
            where: filter => query({ ...state, filter }),
            orderBy: (key, direction) => query({ ...state, order: [key, direction] }),
            skip: skip => query({ ...state, skip }),
            limit: limit => query({ ...state, limit }),
            field: () => query(state),
            async count() { return { total: matching().length }; },
            async get() { const skip = state.skip || 0; return { data: clone(matching().slice(skip, skip + (state.limit ?? Infinity))) }; },
            async add({ data: row }) {
              const id = row._id || `offline-${++generatedId}`;
              assertWrite(name, id);
              data[name].push({ ...clone(row), _id: id });
              return { _id: id };
            },
            doc(id) {
              return {
                async get() { return { data: clone(data[name].find(row => row._id === id)) }; },
                async set({ data: row }) {
                  assertWrite(name, id);
                  const index = data[name].findIndex(item => item._id === id);
                  if (index < 0) data[name].push({ ...clone(row), _id: id });
                  else data[name][index] = { ...clone(row), _id: id };
                  return { stats: { updated: 1 } };
                },
                async update({ data: patch }) {
                  assertWrite(name, id);
                  const row = data[name].find(item => item._id === id);
                  if (!row) throw new Error(`模拟记录不存在：${name}/${id}`);
                  for (const [key, value] of Object.entries(clone(patch))) {
                    const parts = key.split('.');
                    let target = row;
                    for (const part of parts.slice(0, -1)) target = target[part] || (target[part] = {});
                    target[parts[parts.length - 1]] = value;
                  }
                  return { stats: { updated: 1 } };
                },
                async remove() {
                  assertWrite(name, id);
                  const index = data[name].findIndex(row => row._id === id);
                  if (index >= 0) data[name].splice(index, 1);
                  return { stats: { removed: index >= 0 ? 1 : 0 } };
                }
              };
            }
          };
        }
        return query();
      },
      runTransaction(callback) {
        const run = lock.then(async () => {
          const undo = new Map();
          const writeStart = writes.length;
          try { return await callback(database(undo)); }
          catch (error) {
            for (const { name, id, index, row } of [...undo.values()].reverse()) {
              const current = data[name].findIndex(item => item._id === id);
              if (current >= 0) data[name].splice(current, 1);
              if (index >= 0) data[name].splice(index, 0, row);
            }
            writes.length = writeStart;
            throw error;
          }
        });
        lock = run.catch(() => {});
        return run;
      }
    };
  }
  const db = database();
  return { data, writes, attemptedWrites, db, cloud: {
    DYNAMIC_CURRENT_ENV: 'OFFLINE_ONLY',
    init(options) { if (options.env !== 'OFFLINE_ONLY') throw new Error('模拟环境拒绝真实环境ID'); },
    database: () => db,
    getTempFileURL: async ({ fileList }) => ({ fileList: fileList.map(fileID => ({ fileID, tempFileURL: 'https://offline.tcb.qcloud.la/' + encodeURIComponent(fileID) })) }),
    getWXContext: () => ({ OPENID: 'offline-expert' })
  } };
}

function loadOfflineFunction(filename, cloud) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const localRequire = createRequire(file), module = { exports: {} };
    cache.set(file, module);
    function safeRequire(name) {
      if (name === 'wx-server-sdk') return cloud;
      if (name.startsWith('.')) return load(localRequire.resolve(name));
      if (['crypto', 'node:crypto', 'path', 'node:path'].includes(name)) return localRequire(name);
      throw new Error(`离线模拟禁止加载外部依赖：${name}`);
    }
    const quiet = { log() {}, warn() {}, error() {} };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports, require: safeRequire, console: quiet, Date, Buffer, setTimeout }, { filename: file });
    return module.exports;
  }
  return load(path.resolve(filename)).main;
}
module.exports = { createOfflineCloud, loadOfflineFunction };
