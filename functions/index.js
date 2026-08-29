const { generatePurchaseOrderPdf } = require('./generatePurchaseOrderPdf');
const { sendOrderWhatsApp } = require('./sendOrderWhatsApp');

exports.generatePurchaseOrderPdf = generatePurchaseOrderPdf;
exports.sendOrderWhatsApp = sendOrderWhatsApp;
