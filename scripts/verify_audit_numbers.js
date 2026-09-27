const fs = require('fs');
const path = require('path');

const intermediate = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'audit_intermediate.json'), 'utf8'));
const detailed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'detailed_mockup_classification.json'), 'utf8'));

const s1Results = detailed.sheet1AuditResults;
console.log('Sheet 1 Results Count:', s1Results.length);
console.log('Sheet 1 Classifications:', {
  A: s1Results.filter(r => r.classification.startsWith('A')).length,
  B: s1Results.filter(r => r.classification === 'B').length,
  C: s1Results.filter(r => r.classification === 'C').length,
  D: s1Results.filter(r => r.classification === 'D').length,
  E: s1Results.filter(r => r.classification === 'E').length,
  F: s1Results.filter(r => r.classification === 'F').length,
  G: s1Results.filter(r => r.classification === 'G').length,
});

const s2Results = detailed.sheet2AuditResults;
console.log('Sheet 2 Classifications:', {
  A: s2Results.filter(r => r.classification === 'A').length,
  other: s2Results.filter(r => r.classification !== 'A').length
});

const s3Results = detailed.sheet3AuditResults;
console.log('Sheet 3 Classifications:', {
  A: s3Results.filter(r => r.classification === 'A').length,
  other: s3Results.filter(r => r.classification !== 'A').length
});
