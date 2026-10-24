const fs = require('fs');
const path = require('path');

const AUDIT_FILE = path.join(__dirname, '..', 'image_cleanup_final_303', 'audit', 'audit_303_products.json');

if (fs.existsSync(AUDIT_FILE)) {
  const data = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
  console.log('Total items in audit_303_products.json:', data.length);
  const sample = data.slice(0, 5);
  console.log('Sample:', JSON.stringify(sample, null, 2));

  // Check if adhesives were in it
  const adh = data.filter(d => (d.id && d.id.includes('ADH')) || (d.name && d.name.toLowerCase().includes('adhesive')));
  console.log('Adhesives in audit_303_products.json:', adh.length);

  // Check if there are 303 or what IDs exist
  const first50Ids = data.map(d => d.id || d.productId);
  console.log('First 10 IDs:', first50Ids.slice(0, 10));
  console.log('Last 10 IDs:', first50Ids.slice(-10));
} else {
  console.log('AUDIT_FILE does not exist.');
}
