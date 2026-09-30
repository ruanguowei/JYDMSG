const fs = require('fs');
const path = require('path');

const CATEGORY_MAPPINGS = [
  { aliases: ['technique', '技艺', '技艺类', '传统·匠心传承'], category: '传统·匠心传承', prefix: 'CT' },
  { aliases: ['culture', '文脉', '文脉类', '当代·当代表达'], category: '当代·当代表达', prefix: 'DD' },
  { aliases: ['algorithm', '算法', '算法类', '数字·数字传媒'], category: '数字·数字传媒', prefix: 'SZ' },
  { aliases: ['industry', '产业', '产业类', '产业·产业制造'], category: '产业·产业制造', prefix: 'CY' },
  { aliases: ['vision', '视界', '视界类', '国际·全球视野'], category: '国际·全球视野', prefix: 'GJ' },
];

function findCategoryMapping(category) {
  const value = String(category || '').trim().toLowerCase();
  return CATEGORY_MAPPINGS.find(item => item.aliases.some(alias => alias.toLowerCase() === value)) || null;
}

function migrateWorkCode(workCode, prefix) {
  const value = String(workCode || '').trim();
  if (!value) return { value, changed: false, warning: '' };

  const match = /^POT2026-([A-Z]{2})-(\d{6})$/.exec(value);
  if (!match) {
    return { value, changed: false, warning: `无法识别作品编号格式：${value}` };
  }

  const migrated = `POT2026-${prefix}-${match[2]}`;
  return { value: migrated, changed: migrated !== value, warning: '' };
}

function migrateRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { record, changed: false, warning: '记录不是对象' };
  }
  if (record.editionId && record.editionId !== 'pottery-2026') {
    return { record, changed: false, warning: '' };
  }

  const mapping = findCategoryMapping(record.category);
  if (!mapping) {
    return {
      record,
      changed: false,
      warning: `无法识别作品类别：${String(record.category || '')}`,
    };
  }

  const workCodeResult = migrateWorkCode(record.workCode, mapping.prefix);
  const migrated = {
    ...record,
    category: mapping.category,
    workCode: workCodeResult.value,
  };
  const changed = migrated.category !== record.category || workCodeResult.changed;
  return { record: migrated, changed, warning: workCodeResult.warning };
}

function extractRecords(document) {
  if (Array.isArray(document)) {
    return { records: document, rebuild: records => records };
  }
  if (document && Array.isArray(document.data)) {
    return { records: document.data, rebuild: records => ({ ...document, data: records }) };
  }
  throw new Error('仅支持 JSON 数组，或包含 data 数组的 JSON 对象');
}

function migrateDocument(document) {
  const { records, rebuild } = extractRecords(document);
  const results = records.map(migrateRecord);
  const warnings = results
    .map((result, index) => result.warning ? { index, warning: result.warning } : null)
    .filter(Boolean);
  const workCodeCounts = results.reduce((counts, result) => {
    const workCode = String((result.record && result.record.workCode) || '').trim();
    if (workCode) counts[workCode] = (counts[workCode] || 0) + 1;
    return counts;
  }, {});
  const duplicateWorkCodes = Object.keys(workCodeCounts).filter(workCode => workCodeCounts[workCode] > 1);

  return {
    document: rebuild(results.map(result => result.record)),
    summary: {
      total: records.length,
      changed: results.filter(result => result.changed).length,
      unchanged: results.filter(result => !result.changed).length,
      duplicateWorkCodes,
      warnings,
    },
  };
}

function printUsage() {
  console.log([
    '2026 类别与作品编号离线迁移工具',
    '',
    '只预览：',
    '  node scripts/migrate-2026-category-export.js <备份.json>',
    '',
    '生成迁移后的新文件（不会覆盖原文件）：',
    '  node scripts/migrate-2026-category-export.js <备份.json> --output <新文件.json>',
  ].join('\n'));
}

function main() {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  const outputIndex = args.indexOf('--output');
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : '';

  if (!inputPath || ['-h', '--help'].includes(inputPath)) {
    printUsage();
    return;
  }

  const absoluteInput = path.resolve(inputPath);
  const document = JSON.parse(fs.readFileSync(absoluteInput, 'utf8'));
  const result = migrateDocument(document);
  console.log(JSON.stringify(result.summary, null, 2));

  if (!outputPath) {
    console.log('当前为只预览模式，未生成文件，也未连接云数据库。');
    return;
  }

  const absoluteOutput = path.resolve(outputPath);
  if (absoluteOutput === absoluteInput) throw new Error('输出文件不能与原备份文件相同');
  if (fs.existsSync(absoluteOutput)) throw new Error(`输出文件已存在，拒绝覆盖：${absoluteOutput}`);
  fs.writeFileSync(absoluteOutput, `${JSON.stringify(result.document, null, 2)}\n`, 'utf8');
  console.log(`迁移后的副本已生成：${absoluteOutput}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  CATEGORY_MAPPINGS,
  findCategoryMapping,
  migrateDocument,
  migrateRecord,
  migrateWorkCode,
};
