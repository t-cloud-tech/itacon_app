const functions = require('firebase-functions');
const admin = require('firebase-admin');
const PDFDocument = require('pdfkit');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Cloud Function triggered on Firestore order document update.
 * When status transitions to 'confirmed' and poDocumentUrl is empty,
 * generates a corporate Purchase Order PDF using pdfkit and uploads to Firebase Storage.
 */
exports.generatePurchaseOrderPdf = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const orderId = context.params.orderId;

    // Trigger condition: status changed to 'confirmed' and PDF not yet generated
    if (afterData.status !== 'confirmed' || afterData.poDocumentUrl) {
      return null;
    }

    console.log(`[PDF Generator] Triggered for confirmed PO: ${orderId} (${afterData.orderReference})`);

    try {
      const pdfBuffer = await createPdfBuffer(afterData);

      // Save generated PDF buffer to Firebase Storage under purchase_orders/{orderId}.pdf
      const bucket = admin.storage().bucket();
      const filePath = `purchase_orders/${orderId}.pdf`;
      const file = bucket.file(filePath);

      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            orderId: orderId,
            orderReference: afterData.orderReference || ''
          }
        },
        public: true
      });

      // Get public download URL
      const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      // Update orders/{orderId} with poDocumentUrl
      await change.after.ref.update({
        poDocumentUrl: downloadUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[PDF Generator] Successfully generated and attached PDF: ${downloadUrl}`);
      return downloadUrl;
    } catch (err) {
      console.error(`[PDF Generator] Failed to generate PDF for ${orderId}:`, err);
      throw err;
    }
  });

function createPdfBuffer(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const primaryColor = '#0B192C';
      const accentColor = '#FF6B00';
      const textSubtle = '#475569';

      // Header Section
      doc.fillColor(primaryColor).fontSize(20).text('ITACON GRANITO PVT. LTD.', 40, 40, { bold: true });
      doc.fontSize(9).fillColor(textSubtle).text('8-A National Highway, Ceramic Zone, Morbi - 363642, Gujarat, India');
      doc.text('Email: orders@itacongranito.com | Phone: +91 98765 43210');

      doc.fillColor(accentColor).fontSize(16).text('PURCHASE ORDER ESTIMATE', 360, 40, { align: 'right' });
      doc.fillColor(textSubtle).fontSize(9).text(`PO Ref: #${order.orderReference || order.id}`, 360, 62, { align: 'right' });
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 360, 75, { align: 'right' });

      doc.moveTo(40, 95).lineTo(555, 95).strokeColor('#CBD5E1').stroke();

      // Vendor & Ship-To Blocks
      let y = 110;
      doc.fillColor(primaryColor).fontSize(11).text('FACTORY / VENDOR DETAILS:', 40, y, { underline: true });
      doc.text('SHIP-TO / CUSTOMER DETAILS:', 300, y, { underline: true });

      y += 18;
      doc.fontSize(9).fillColor('#1E293B');
      doc.text('ITACON Granito Dispatch Works', 40, y);
      doc.text(`Customer Name: ${order.userCategory || 'Client'} (${order.userId || 'N/A'})`, 300, y);

      y += 14;
      doc.text('Factory Unit 2, Jetpar Road', 40, y);
      doc.text(`Delivery Address: ${order.deliveryAddress || order.deliveryLocation?.address || 'Site Delivery'}`, 300, y);

      y += 14;
      doc.text('Morbi, Gujarat - 363642', 40, y);
      doc.text(`State Code: ${order.stateCode || 'GJ'}`, 300, y);

      // Requisitioner Bar
      y += 30;
      doc.rect(40, y, 515, 24).fill('#F1F5F9');
      doc.fillColor(primaryColor).fontSize(9).text(
        `Sales Representative: ${order.salesPersonId || 'Direct Factory'}    |    Payment Terms: B2B Wire / RTGS    |    Order Type: ${(order.orderType || 'ready_stock').toUpperCase()}`,
        50,
        y + 7
      );

      // Itemized Table
      y += 35;
      doc.rect(40, y, 515, 20).fill(primaryColor);
      doc.fillColor('#FFFFFF').fontSize(9);
      doc.text('#', 45, y + 5);
      doc.text('Item Description (Size & Finish)', 70, y + 5);
      doc.text('Qty (Boxes / Sq.Ft)', 280, y + 5);
      doc.text('Rate (₹/Sq.Ft)', 410, y + 5);
      doc.text('Total (₹)', 490, y + 5);

      y += 20;
      const items = order.orderItems || order.items || [];
      items.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(40, y, 515, 22).fill(bg);

        doc.fillColor('#1E293B').fontSize(8.5);
        doc.text(`${idx + 1}`, 45, y + 6);
        doc.text(`${item.productName || item.tileName || 'Tile Item'} (${item.size || '600x1200'} ${item.surface || ''})`, 70, y + 6);

        const boxes = item.quantityBoxes || item.quantity || 0;
        const sqFt = item.quantitySqFt || (boxes * 15.5);
        doc.text(`${boxes} Boxes (${sqFt.toFixed(1)} sq.ft)`, 280, y + 6);

        const rate = item.unitPrice || 0;
        doc.text(`₹${rate.toFixed(2)}`, 410, y + 6);

        const lineTot = item.lineTotal || (sqFt * rate);
        doc.text(`₹${lineTot.toFixed(2)}`, 490, y + 6);

        y += 22;
      });

      // Total Breakdown (No Freight Line)
      y += 15;
      const subtotal = order.subtotal || 0;
      const discount = order.discount || 0;
      const taxAmount = order.taxAmount || order.tax || ((subtotal - discount) * 0.18);
      const totalAmount = order.totalAmount || order.total || (subtotal - discount + taxAmount);

      doc.fontSize(9).fillColor(textSubtle);
      doc.text('Subtotal:', 380, y);
      doc.text(`₹${subtotal.toFixed(2)}`, 480, y, { align: 'right' });

      if (discount > 0) {
        y += 14;
        doc.text('Applied Discount:', 380, y);
        doc.text(`- ₹${discount.toFixed(2)}`, 480, y, { align: 'right' });
      }

      y += 14;
      doc.text('18% GST (CGST+SGST/IGST):', 380, y);
      doc.text(`₹${taxAmount.toFixed(2)}`, 480, y, { align: 'right' });

      y += 16;
      doc.rect(370, y, 185, 24).fill('#F1F5F9');
      doc.fillColor(primaryColor).fontSize(10).text('Final Total Amount:', 380, y + 6, { bold: true });
      doc.fillColor(accentColor).fontSize(11).text(`₹${totalAmount.toFixed(2)}`, 475, y + 5, { bold: true, align: 'right' });

      // Footer: Digital Acceptance & Terms
      y += 45;
      doc.fillColor(primaryColor).fontSize(9).text('DIGITAL ACCEPTANCE CONFIRMATION', 40, y, { underline: true });
      y += 14;
      doc.fillColor(textSubtle).fontSize(8);
      const confirmedDate = order.confirmedAt ? new Date(order.confirmedAt.toDate ? order.confirmedAt.toDate() : order.confirmedAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
      doc.text(`Digitally Accepted by Customer on ${confirmedDate} via ITACON Mobile Client.`);
      doc.text('Terms: Breakage during transit is subject to insurance claim. Quoted rates are valid for 7 days.');

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
