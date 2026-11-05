const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createPoPdfBuffer, calculatePoAmounts } = require('../functions/generatePaidPurchaseOrderPdf');

function unwrap(f) {
  const r = {};
  for (const k in f) {
    const v = f[k];
    if (v.stringValue !== undefined) r[k] = v.stringValue;
    else if (v.integerValue !== undefined) r[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) r[k] = Number(v.doubleValue);
    else if (v.booleanValue !== undefined) r[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) r[k] = v.timestampValue;
    else if (v.arrayValue !== undefined) r[k] = (v.arrayValue.values || []).map(x => x.mapValue ? unwrap(x.mapValue.fields) : Object.values(x)[0]);
    else if (v.mapValue !== undefined) r[k] = unwrap(v.mapValue.fields);
  }
  return r;
}

async function run() {
  const o1 = unwrap(JSON.parse(fs.readFileSync('order_9095.json')).fields);
  o1.id = '0ojuR1bFjuXW0OEfQp44';
  o1.orderReference = o1.orderReference || 'ITC-PO-2026-9095';
  o1.salesRepName = 'Direct Factory';
  o1.orderItems = (o1.orderItems || []).map(it => ({
    ...it,
    hsnCode: it.hsnCode || '69072100',
    gradeLabel: it.gradeLabel || 'Premium',
  }));

  const o2 = unwrap(JSON.parse(fs.readFileSync('order_5765.json')).fields);
  o2.id = 'k4UmJDSM8IEHQDiwjcqq';
  o2.orderReference = o2.orderReference || 'ITC-PO-2026-5765';
  o2.salesRepName = o2.salespersonName || 'Direct Factory';
  o2.orderItems = (o2.orderItems || []).map(it => ({
    ...it,
    hsnCode: it.hsnCode || '69072100',
    gradeLabel: it.gradeLabel || 'Premium',
  }));

  const sub9095 = {
    utrNumber: '5468795758',
    paymentDate: new Date('2026-10-26T10:19:00Z'),
    verifiedAt: new Date('2026-10-26T04:51:00Z'),
    verifiedBy: 'Authorized Accounts Team',
    submittedAmount: 7708.69,
  };

  const custProfile = {
    name: 'Tirth Kalpesh Patel',
    companyName: 'Dero By Zero',
    phone: '+919624818476',
    gstin: '24AAAFT2820R1Z0',
  };

  const bankConfig = {
    bankName: 'HDFC Bank Ltd',
    accountName: 'ITACON GRANITO PRIVATE LIMITED',
    accountNumber: '50200088991122',
    ifscCode: 'HDFC0001234',
    branch: 'Morbi Main Branch',
  };

  // Generate Paid PO
  const paidBuf = await createPoPdfBuffer(o1, sub9095, custProfile, { isPaid: true });
  fs.writeFileSync('paid_po_9095_fixed.pdf', paidBuf);
  const paidSha = crypto.createHash('sha256').update(paidBuf).digest('hex');
  console.log(`Generated paid_po_9095_fixed.pdf: ${paidBuf.length} bytes, SHA-256: ${paidSha}`);

  // Generate Unpaid PO
  const unpaidBuf = await createPoPdfBuffer(o2, null, custProfile, { isPaid: false, bankConfig });
  fs.writeFileSync('unpaid_po_5765_fixed.pdf', unpaidBuf);
  const unpaidSha = crypto.createHash('sha256').update(unpaidBuf).digest('hex');
  console.log(`Generated unpaid_po_5765_fixed.pdf: ${unpaidBuf.length} bytes, SHA-256: ${unpaidSha}`);

  // Also generate Unpaid PO for 9095 to test 100% same-order comparison between Paid and Unpaid!
  const unpaid9095Buf = await createPoPdfBuffer(o1, null, custProfile, { isPaid: false, bankConfig });
  fs.writeFileSync('unpaid_po_9095_fixed.pdf', unpaid9095Buf);
  console.log(`Generated unpaid_po_9095_fixed.pdf: ${unpaid9095Buf.length} bytes`);
}

run().catch(console.error);

