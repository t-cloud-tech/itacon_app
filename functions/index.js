const { generatePurchaseOrderPdf } = require('./generatePurchaseOrderPdf');
const { sendOrderWhatsApp } = require('./sendOrderWhatsApp');
const { sendRegionalGreetings } = require('./sendRegionalGreetings');

exports.generatePurchaseOrderPdf = generatePurchaseOrderPdf;
exports.sendOrderWhatsApp = sendOrderWhatsApp;
exports.sendRegionalGreetings = sendRegionalGreetings;
