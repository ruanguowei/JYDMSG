const { calculateRubric } = require('../../cloudfunctions/common/rubric');
const {
  CERTIFICATE_TYPES,
  buildCertificateRecord
} = require('../../cloudfunctions/common/certificate');

const CATEGORIES = ['technique', 'culture', 'algorithm', 'industry', 'vision'];
const PROTECTED_REGIONS = ['香港', '澳门', '台湾'];

function pad(number, size = 6) {
  return String(number).padStart(size, '0');
}

function categoryCode(category) {
  return {
    technique: 'JY',
    culture: 'WM',
    algorithm: 'SF',
    industry: 'CY',
    vision: 'SJ'
  }[category] || 'QT';
}

function workCodeFor(index, category) {
  return `POT2026-${categoryCode(category)}-${pad(index)}`;
}

function generateSyntheticWorks(count = 650) {
  const works = [];

  for (let index = 1; index <= count; index += 1) {
    const category = CATEGORIES[(index - 1) % CATEGORIES.length];
    const participantIndex = Math.ceil(index / 2);
    const protectedRegion = index % 53 === 0 ? PROTECTED_REGIONS[index % PROTECTED_REGIONS.length] : '';

    works.push({
      _id: `submission-${index}`,
      editionId: 'pottery-2026',
      schemaVersion: 2,
      workCode: workCodeFor(index, category),
      name: `测试用户${pad(participantIndex, 4)}`,
      phone: `13${pad(participantIndex, 9)}`,
      idNumber: `ID${pad(participantIndex, 12)}`,
      school: protectedRegion ? `${protectedRegion}测试学校` : `测试学校${participantIndex % 30}`,
      schoolProvinces: protectedRegion || `省份${index % 31}`,
      artworkName: `合成作品${pad(index, 4)}`,
      category,
      workType: index % 10 === 0 ? 'video' : 'regular',
      qualification: index % 97 !== 0,
      createdAt: index,
      updatedAt: index,
      video: index % 10 === 0
        ? {
          fileId: `cloud://test/videos/${workCodeFor(index, category)}.mp4`,
          sizeBytes: 49 * 1024 * 1024,
          format: 'mp4',
          uploadStatus: 'uploaded'
        }
        : null
    });
  }

  // 注入一组重复报名，清洗应保留 updatedAt 更新的一条。
  works.push({
    ...works[0],
    _id: 'submission-duplicate-old',
    workCode: works[0].workCode,
    artworkName: '合成重复旧作品',
    updatedAt: 0
  });

  return works;
}

function cleanSubmissions(works) {
  const groups = new Map();

  for (const work of works) {
    if (work.qualification === false) {
      continue;
    }
    const key = work.workCode || `${work.name}_${work.school}_${work.idNumber}_${work.artworkName}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(work);
  }

  const cleaned = [];
  let duplicates = 0;

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    cleaned.push(sorted[0]);
    duplicates += Math.max(0, sorted.length - 1);
  }

  return {
    cleaned,
    duplicates
  };
}

function gradeFor(work, expertIndex) {
  const bucket = (Number(work.workCode.slice(-2)) + expertIndex) % 4;
  return ['A', 'B', 'C', 'D'][bucket];
}

function scoreWorks(works, phase, expertCount = 3) {
  return works.map(work => {
    if (work.qualification === false) {
      return {
        ...work,
        evaluations: [],
        qualification: false
      };
    }

    const evaluations = [];
    for (let expertIndex = 0; expertIndex < expertCount; expertIndex += 1) {
      const gradeScores = {
        themeFit: gradeFor(work, expertIndex),
        creativity: gradeFor(work, expertIndex + 1),
        craftsmanship: gradeFor(work, expertIndex + 2),
        aesthetics: gradeFor(work, expertIndex + 3)
      };
      const deductions = {
        aiNotLabeled: work.workType === 'video' && expertIndex === 0,
        missingCreativeStatement: Number(work.workCode.slice(-3)) % 41 === 0
      };
      const rubric = calculateRubric(gradeScores, deductions);
      evaluations.push({
        expertCode: `${phase}-expert-${expertIndex + 1}`,
        rubricVersion: rubric.rubricVersion,
        gradeScores: rubric.gradeScores,
        scores: rubric.scores,
        rawTotalScore: rubric.rawTotalScore,
        finalScore: rubric.finalScore,
        deductions: rubric.deductions
      });
    }

    const averageScore = evaluations.reduce((sum, item) => sum + item.finalScore, 0) / evaluations.length;
    return {
      ...work,
      evaluations,
      averageScore
    };
  });
}

function selectPreliminary(scoredWorks) {
  const protectedWorks = scoredWorks.filter(work =>
    PROTECTED_REGIONS.some(region => String(work.schoolProvinces || '').includes(region))
  );
  const ordinaryWorks = scoredWorks
    .filter(work => !protectedWorks.includes(work))
    .sort((a, b) => b.averageScore - a.averageScore);

  const selected = [...ordinaryWorks.slice(0, 480), ...protectedWorks]
    .sort((a, b) => b.averageScore - a.averageScore);

  return selected.map((work, index) => ({
    ...work,
    preliminaryRank: index + 1
  }));
}

function selectFinal(scoredWorks) {
  const sorted = [...scoredWorks]
    .sort((a, b) => b.averageScore - a.averageScore)
  const selected = sorted.slice(0, 320);

  if (!selected.some(work => work.workType === 'video')) {
    const bestVideo = sorted.find(work => work.workType === 'video');
    if (bestVideo) {
      selected[selected.length - 1] = bestVideo;
    }
  }

  return selected
    .sort((a, b) => b.averageScore - a.averageScore)
    .map((work, index) => ({
      ...work,
      overallRank: index + 1,
      shortlisted: true,
      status: index < 10 ? '卓越创作奖' : (index < 30 ? '新锐突破奖' : (index < 80 ? '优秀潜力奖' : '入围'))
    }));
}

function issueCertificates(finalWorks) {
  const records = [];

  for (const work of finalWorks) {
    const shortlisted = buildCertificateRecord({
      editionId: 'pottery-2026',
      workCode: work.workCode,
      certificateType: CERTIFICATE_TYPES.SHORTLISTED,
      fileId: `cloud://test/certificates/${work.workCode}-shortlisted.png`,
      fileName: `${work.workCode}-入围证书.png`,
      existingRecords: records,
      createdBy: 'simulator'
    });
    records.push(shortlisted);

    if (work.status !== '入围') {
      const award = buildCertificateRecord({
        editionId: 'pottery-2026',
        workCode: work.workCode,
        certificateType: CERTIFICATE_TYPES.AWARD,
        awardStatus: work.status,
        fileId: `cloud://test/certificates/${work.workCode}-award.png`,
        fileName: `${work.workCode}-获奖证书.png`,
        existingRecords: records,
        createdBy: 'simulator'
      });
      records.push(award);
    }
  }

  // 注入一条替换证书，验证版本递增。
  const firstAward = records.find(record => record.certificateType === CERTIFICATE_TYPES.AWARD);
  if (firstAward) {
    records.push(buildCertificateRecord({
      editionId: 'pottery-2026',
      workCode: firstAward.workCode,
      certificateType: CERTIFICATE_TYPES.AWARD,
      awardStatus: firstAward.awardStatus,
      fileId: `cloud://test/certificates/${firstAward.workCode}-award-v2.png`,
      fileName: `${firstAward.workCode}-获奖证书-v2.png`,
      existingRecords: records,
      createdBy: 'simulator'
    }));
  }

  return records;
}

function simulateFullFlow(count = 650) {
  const submissions = generateSyntheticWorks(count);
  const { cleaned, duplicates } = cleanSubmissions(submissions);
  const preliminaryScored = scoreWorks(cleaned, 'preliminary', 3);
  const preliminary = cleaned.length >= 640 ? selectPreliminary(preliminaryScored) : preliminaryScored;
  const finalScored = scoreWorks(preliminary, 'final', 5);
  const finalResults = selectFinal(finalScored);
  const certificates = issueCertificates(finalResults);

  const workCodes = new Set(finalResults.map(work => work.workCode));
  const duplicateWorkCodes = finalResults.length - workCodes.size;
  const rankContinuity = finalResults.every((work, index) => work.overallRank === index + 1);
  const videoCount = submissions.filter(work => work.workType === 'video').length;
  const finalVideoCount = finalResults.filter(work => work.workType === 'video').length;

  return {
    submissions,
    cleaned,
    preliminary,
    finalScored,
    finalResults,
    certificates,
    report: {
      inputCount: submissions.length,
      cleanedCount: cleaned.length,
      duplicateRemoved: duplicates,
      preliminaryCount: preliminary.length,
      finalScoringCount: finalScored.length,
      finalResultCount: finalResults.length,
      certificateCount: certificates.length,
      duplicateWorkCodes,
      rankContinuity,
      videoCount,
      finalVideoCount,
      categories: CATEGORIES.reduce((summary, category) => {
        summary[category] = finalResults.filter(work => work.category === category).length;
        return summary;
      }, {})
    }
  };
}

module.exports = {
  generateSyntheticWorks,
  simulateFullFlow
};
