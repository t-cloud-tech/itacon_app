const fs = require('fs');
const path = require('path');

const backupDir = path.join(__dirname, 'backup');
const files = fs.readdirSync(backupDir).filter(f => f.startsWith('orders_backup_')).sort();
const latestFile = path.join(backupDir, files[files.length - 1]);
const allOrders = JSON.parse(fs.readFileSync(latestFile, 'utf8'));

for (const ord of allOrders) {
  const ref = ord.orderReference || ord.id;
  if (ref.includes('9095') || ref.includes('5765')) {
    console.log('======================================================');
    console.log(`ORDER REF: ${ref} (ID: ${ord.id})`);
    console.log('Status:', ord.status);
    console.log('Payment Status:', ord.paymentStatus);
    console.log('Subtotal:', ord.subtotal);
    console.log('Tax Amount:', ord.taxAmount);
    console.log('Total Amount:', ord.totalAmount);
    console.log('Total:', ord.total);
    console.log('Basic Amount:', ord.basicAmount);
    console.log('Insurance Amount:', ord.insuranceAmount);
    console.log('Basic Plus Insurance:', ord.basicPlusInsurance);
    console.log('Packaging Charges:', ord.packagingCharges);
    console.log('Quotation Mode:', ord.quotationMode);
    console.log('Quotation ID:', ord.quotationId);
    console.log('Items:', JSON.stringify(ord.items || ord.orderItems, null, 2));
  }
}
