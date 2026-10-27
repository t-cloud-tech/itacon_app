const fs = require('fs');
const path = require('path');
const { createPaidPdfBuffer, createPoPdfBuffer } = require('../functions/generatePaidPurchaseOrderPdf');

const backupDir = path.join(__dirname, 'backup');
const files = fs.readdirSync(backupDir).filter(f => f.startsWith('orders_backup_')).sort();
const latestFile = path.join(backupDir, files[files.length - 1]);
const allOrders = JSON.parse(fs.readFileSync(latestFile, 'utf8'));

const o9095 = allOrders.find(o => (o.orderReference || '').includes('9095'));
const o5765 = allOrders.find(o => (o.orderReference || '').includes('5765'));

async function test() {
  console.log('Rendering 9095 paid PO...');
  const buf9095 = await createPaidPdfBuffer(o9095, null, null);
  fs.writeFileSync('scripts/test_9095_paid.pdf', buf9095);
  console.log(`Rendered 9095 paid PDF: ${buf9095.length} bytes`);

  console.log('Rendering 5765 unpaid PO...');
  const buf5765 = await createPoPdfBuffer(o5765, null, null, { isPaid: false });
  fs.writeFileSync('scripts/test_5765_unpaid.pdf', buf5765);
  console.log(`Rendered 5765 unpaid PDF: ${buf5765.length} bytes`);
}

test().catch(console.error);
