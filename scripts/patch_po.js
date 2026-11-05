const fs = require('fs');
let code = fs.readFileSync('functions/generatePaidPurchaseOrderPdf.js', 'utf8');

// Normalize line endings to LF for clean regex/string replacement, then write back with original line endings
const isCRLF = code.includes('\r\n');
if (isCRLF) {
  code = code.replace(/\r\n/g, '\n');
}

// 1. Packaging formula in calculatePoAmounts
const oldCalcPack = `  let packaging = 0;
  if (order.packagingCharges !== undefined && order.packagingCharges !== null && Number(order.packagingCharges) > 0) {
    packaging = Number(order.packagingCharges);
  }`;
const newCalcPack = `  let packaging = 0;
  if (order.packagingCharges !== undefined && order.packagingCharges !== null && Number(order.packagingCharges) > 0) {
    packaging = Number(order.packagingCharges);
  } else {
    const originalSubtotal = Number(order.subtotal || 0);
    if (originalSubtotal > basic) {
      packaging = Math.round((originalSubtotal - basic) * 100) / 100;
    }
  }`;
if (!code.includes(oldCalcPack)) {
  console.error('Failed to find oldCalcPack');
  process.exit(1);
}
code = code.replace(oldCalcPack, newCalcPack);

// 2. drawUnpaidWatermark font
const oldWatermark = `function drawUnpaidWatermark(doc) {
  doc.save();
  doc.rotate(-45, { origin: [297.5, 421] });
  doc.fontSize(80).fillColor('#94A3B8').fillOpacity(0.12);
  doc.text('UNPAID', 47.5, 380, { align: 'center', width: 500 });
  doc.restore();
  doc.fillOpacity(1.0);
}`;
const newWatermark = `function drawUnpaidWatermark(doc) {
  doc.save();
  doc.rotate(-45, { origin: [297.5, 421] });
  doc.font('Helvetica-Bold').fontSize(80).fillColor('#94A3B8').fillOpacity(0.12);
  doc.text('UNPAID', 47.5, 380, { align: 'center', width: 500 });
  doc.restore();
  doc.fillOpacity(1.0);
}`;
if (!code.includes(oldWatermark)) {
  console.error('Failed to find oldWatermark');
  process.exit(1);
}
code = code.replace(oldWatermark, newWatermark);

// 3. Fonts in createPoPdfBuffer
const oldFonts = `      if (!isPaid && hasNotoSans) {
        doc.registerFont('NotoSans', notoRegularPath);
        doc.registerFont('NotoSans-Bold', notoBoldPath);
      }

      const regularFont = (!isPaid && hasNotoSans) ? 'NotoSans' : 'Helvetica';
      const boldFont = (!isPaid && hasNotoSans) ? 'NotoSans-Bold' : 'Helvetica-Bold';
      const useRupeeSymbol = (!isPaid && hasNotoSans);

      if (!isPaid) {
        drawUnpaidWatermark(doc, boldFont);
        doc.on('pageAdded', () => {
          drawUnpaidWatermark(doc, boldFont);
        });
      }`;
const newFonts = `      // Reference font setup: Helvetica standard PostScript font family ensures identical,
      // reliable rendering, 100% clean pdftotext extraction, and exact parity across both apps.
      const regularFont = 'Helvetica';
      const boldFont = 'Helvetica-Bold';
      const useRupeeSymbol = false;

      if (!isPaid) {
        drawUnpaidWatermark(doc);
        doc.on('pageAdded', () => {
          drawUnpaidWatermark(doc);
        });
      }`;
if (!code.includes(oldFonts)) {
  console.error('Failed to find oldFonts');
  process.exit(1);
}
code = code.replace(oldFonts, newFonts);

// 4. Document title
const oldTitle = `doc.fillColor(primaryNavy).fontSize(13).text(isPaid ? 'OFFICIAL PAID PURCHASE ORDER' : 'OFFICIAL PURCHASE ORDER (ESTIMATE)', 36, y, { bold: true });`;
const newTitle = `doc.fillColor(primaryNavy).fontSize(13).text('OFFICIAL PURCHASE ORDER', 36, y, { bold: true });`;
if (!code.includes(oldTitle)) {
  console.error('Failed to find oldTitle');
  process.exit(1);
}
code = code.replace(oldTitle, newTitle);

// 5. Table header & rows
const oldTableBlock = `      doc.rect(36, y, 523, 20).fill(primaryNavy);
      doc.fillColor('#FFFFFF').fontSize(8.5);
      doc.text('#', 42, y + 5, { bold: true });
      doc.text('Tile Product & Finish', 62, y + 5, { bold: true });
      doc.text('HSN', 182, y + 5, { bold: true });
      doc.text('Size', 245, y + 5, { bold: true });
      doc.text('Quantity (Boxes)', 320, y + 5, { bold: true });
      const isMrpLinked = order.quotationMode === 'mrp';
      doc.text(isPaid ? (isMrpLinked ? 'MRP (Rs./Sq.Ft)' : 'Rate (Rs./Sq.Ft)') : 'Rate (₹/Sq.Ft)', 425, y + 5, { bold: true });
      doc.text(isPaid ? 'Total (Rs.)' : 'Total (₹)', 495, y + 5, { bold: true, align: 'right', width: 55 });

      y += 20;
      const items = order.orderItems || order.items || [];
      items.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(36, y, 523, 20).fill(bg);

        doc.fillColor(textDark).fontSize(8);
        doc.text(\`\${idx + 1}\`, 42, y + 5);

        const prodName = item.productName || item.tileName || 'Ceramic Tile Item';
        const finish = item.surface || item.finish || 'Standard';
        const grade = item.gradeLabel || item.grade || '';
        doc.fontSize(6.5).text(\`\${prodName} (\${finish})\${grade ? \` - \${grade}\` : ''}\`, 62, y + 2.5, { width: 116, height: 18, lineGap: 0, ellipsis: true });
        doc.fontSize(8);
        doc.text(item.hsnCode || '-', 182, y + 5, { width: 60, lineBreak: false });

        const size = item.size || '600x1200';
        doc.text(size, 245, y + 5);

        const boxes = item.quantityBoxes || item.quantity || 0;
        const sqft = item.totalSqft || item.quantitySqFt || (boxes * (item.sqftPerBox || 15.5));
        doc.text(\`\${boxes} Boxes\`, 320, y + 5);

        const hasMrp = isPaid && isMrpLinked && Number(item.mrp) > 0;
        const unitRate = hasMrp
          ? Number(item.mrp)
          : Number(item.unitPrice || item.ratePerSqFt || item.rate || item.price || 0);
        doc.text(formatInr(unitRate, useRupeeSymbol), 425, y + 5);

        const lineTotal = hasMrp
          ? Number(sqft) * unitRate
          : Number(item.lineTotal || item.totalPrice || item.total || (sqft * unitRate));
        doc.text(formatInr(lineTotal, useRupeeSymbol), 485, y + 5, { align: 'right', width: 65 });

        y += 20;
      });`;

const newTableBlock = `      doc.rect(36, y, 523, 20).fill(primaryNavy);
      doc.fillColor('#FFFFFF').fontSize(8.5);
      doc.text('#', 42, y + 5, { bold: true });
      doc.text('Tile Product & Finish', 62, y + 5, { bold: true });
      doc.text('HSN', 182, y + 5, { bold: true });
      doc.text('Size', 245, y + 5, { bold: true });
      doc.text('Quantity (Boxes)', 320, y + 5, { bold: true });
      const isMrpLinked = order.quotationMode === 'mrp';
      const items = order.orderItems || order.items || [];
      const mrpSum = items.reduce((sum, it) => {
        const b = it.quantityBoxes || it.quantity || 0;
        const s = it.totalSqft || it.quantitySqFt || (b * (it.sqftPerBox || 15.5));
        return sum + (s * (Number(it.mrp) || 0));
      }, 0);
      const hasMrp = isMrpLinked && items.some((it) => Number(it.mrp) > 0) && Math.abs(calc.basicAmount - mrpSum) < 1;
      const rateHeader = hasMrp ? 'MRP (Rs./Sq.Ft)' : 'Rate (Rs./Sq.Ft)';
      doc.text(rateHeader, 425, y + 5, { bold: true });
      doc.text('Total (Rs.)', 495, y + 5, { bold: true, align: 'right', width: 55 });

      y += 20;
      items.forEach((item, idx) => {
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(36, y, 523, 20).fill(bg);

        doc.fillColor(textDark).fontSize(8);
        doc.text(\`\${idx + 1}\`, 42, y + 5);

        const prodName = item.productName || item.tileName || 'Ceramic Tile Item';
        const finish = item.surface || item.finish || 'Standard';
        const grade = item.gradeLabel || item.grade || '';
        doc.fontSize(6.5).text(\`\${prodName} (\${finish})\${grade ? \` - \${grade}\` : ''}\`, 62, y + 2.5, { width: 116, height: 18, lineGap: 0, ellipsis: true });
        doc.fontSize(8);
        doc.text(item.hsnCode || '-', 182, y + 5, { width: 60, lineBreak: false });

        const size = item.size || '600x1200';
        doc.text(size, 245, y + 5);

        const boxes = item.quantityBoxes || item.quantity || 0;
        const sqft = item.totalSqft || item.quantitySqFt || (boxes * (item.sqftPerBox || 15.5));
        doc.text(\`\${boxes} Boxes\`, 320, y + 5);

        const unitRate = hasMrp
          ? Number(item.mrp)
          : Number(item.unitPrice || item.ratePerSqFt || item.rate || item.price || 0);
        doc.text(formatInr(unitRate, false), 425, y + 5);

        const lineTotal = hasMrp
          ? Number(sqft) * unitRate
          : Number(item.lineTotal || item.totalPrice || item.total || (sqft * unitRate));
        doc.text(formatInr(lineTotal, false), 485, y + 5, { align: 'right', width: 65 });

        y += 20;
      });`;

if (!code.includes(oldTableBlock)) {
  console.error('Failed to find oldTableBlock');
  process.exit(1);
}
code = code.replace(oldTableBlock, newTableBlock);

// 6. Totals section
const oldTotalsBlock = `      if (isMrpLinked || !isPaid) {
        const basicAmount = (!isPaid ? calc.basicAmount : Number(order.basicAmount || 0));
        const insuranceAmount = (!isPaid ? calc.insuranceAmount : Number(order.insuranceAmount || 0));
        const basicPlusInsurance = (!isPaid ? calc.basicPlusInsurance : Number(order.basicPlusInsurance || (basicAmount + insuranceAmount)));
        const finalTaxAmount = (!isPaid ? calc.taxAmount : taxAmount);
        const finalTotalAmount = (!isPaid ? calc.totalAmount : totalAmount);
        const packagingCharges = (!isPaid ? calc.packagingCharges : Number(order.packagingCharges || 0));

        const mrpRows = [
          ['Basic amount:', basicAmount],
          ['Insurance:', insuranceAmount],
          ['Basic + insurance:', basicPlusInsurance],
          ['18% GST:', finalTaxAmount],
        ];
        mrpRows.forEach(([label, val], i) => {
          if (i > 0) y += 14;
          doc.font(regularFont).fillColor(textSubtle).text(label, summaryX, y);
          doc.font(boldFont).fillColor(textDark).text(formatInr(val, useRupeeSymbol), valX, y, { align: 'right', width: valW });
        });
        y += 16;
        doc.rect(summaryX - 10, y, 239, 24).fill('#F1F5F9');
        doc.rect(summaryX - 10, y, 239, 24).strokeColor(borderSubtle).lineWidth(0.8).stroke();
        doc.fillColor(primaryNavy).font(boldFont).fontSize(9.5).text('Estimated total*:', summaryX, y + 6);
        doc.fillColor(accentOrange).font(boldFont).fontSize(10).text(formatInr(finalTotalAmount, useRupeeSymbol), valX, y + 6, { align: 'right', width: valW });
        doc.fillColor(textSubtle).font(regularFont).fontSize(7).text(\`*Premium packaging charges: \${formatInr(packagingCharges, useRupeeSymbol)}\`, summaryX, y + 28);
        y += 10;
      } else {
        doc.text('Subtotal:', summaryX, y);
        doc.fillColor(textDark).text(formatInr(subtotal), valX, y, { align: 'right', width: valW });

        if (discount > 0) {
          y += 14;
          doc.fillColor(textSubtle).text('Applied Discount:', summaryX, y);
          doc.fillColor(statusSuccess).text(\`- \${formatInr(discount)}\`, valX, y, { align: 'right', width: valW });
        }

        y += 14;
        if (isInterState) {
          doc.fillColor(textSubtle).text('IGST (18%):', summaryX, y);
          doc.fillColor(textDark).text(formatInr(taxAmount), valX, y, { align: 'right', width: valW });
        } else {
          doc.fillColor(textSubtle).text('CGST (9%) + SGST (9%):', summaryX, y);
          doc.fillColor(textDark).text(formatInr(taxAmount), valX, y, { align: 'right', width: valW });
        }

        y += 16;
        doc.rect(summaryX - 10, y, 239, 24).fill('#F1F5F9');
        doc.rect(summaryX - 10, y, 239, 24).strokeColor(borderSubtle).lineWidth(0.8).stroke();
        doc.fillColor(primaryNavy).fontSize(9.5).text('Confirmed PO Grand Total:', summaryX, y + 6, { bold: true });
        doc.fillColor(accentOrange).fontSize(10).text(formatInr(totalAmount), valX, y + 6, { bold: true, align: 'right', width: valW });
      }`;

const newTotalsBlock = `      const basicAmount = calc.basicAmount;
      const insuranceAmount = calc.insuranceAmount;
      const basicPlusInsurance = calc.basicPlusInsurance;
      const finalTaxAmount = calc.taxAmount;
      const finalTotalAmount = calc.totalAmount;
      const packagingCharges = calc.packagingCharges;

      const mrpRows = [
        ['Basic amount:', basicAmount],
        ['Insurance:', insuranceAmount],
        ['Basic + insurance:', basicPlusInsurance],
        ['18% GST:', finalTaxAmount],
      ];
      mrpRows.forEach(([label, val], i) => {
        if (i > 0) y += 14;
        doc.font(regularFont).fillColor(textSubtle).text(label, summaryX, y);
        doc.font(boldFont).fillColor(textDark).text(formatInr(val, false), valX, y, { align: 'right', width: valW });
      });
      y += 16;
      doc.rect(summaryX - 10, y, 239, 24).fill('#F1F5F9');
      doc.rect(summaryX - 10, y, 239, 24).strokeColor(borderSubtle).lineWidth(0.8).stroke();
      doc.fillColor(primaryNavy).font(boldFont).fontSize(9.5).text('Estimated total*:', summaryX, y + 6);
      doc.fillColor(accentOrange).font(boldFont).fontSize(10).text(formatInr(finalTotalAmount, false), valX, y + 6, { align: 'right', width: valW });
      doc.fillColor(textSubtle).font(regularFont).fontSize(7).text(\`*Premium packaging charges: \${formatInr(packagingCharges, false)}\`, summaryX, y + 28);
      y += 10;`;

if (!code.includes(oldTotalsBlock)) {
  console.error('Failed to find oldTotalsBlock');
  process.exit(1);
}
code = code.replace(oldTotalsBlock, newTotalsBlock);

// 7. Footer terms
const oldFooterTerms = `      y += (isPaid ? 86 : 94);
      doc.fillColor(textSubtle).fontSize(isPaid ? 7 : 8);
      if (!isPaid && hasNotoSans) {
        doc.font('NotoSans');
      }
      doc.text(
        isPaid
          ? 'Terms: 1. This document serves as the official ITACON GRANITO Paid Purchase Order confirmation. ' +
            '2. Factory dispatch is scheduled per confirmed logistics slot. ' +
            '3. Transit insurance applies per ITACON B2B standard policy. ' +
            '4. Generated electronically via ITACON Production System.'
          : 'Terms: 1. This document is an official Purchase Order Estimate for proforma payment remittance. ' +
            '2. Pricing and inventory allocation are held for 7 calendar days from order date. ' +
            '3. Transit insurance (0.35%) applies per ITACON B2B standard logistics policy. ' +
            '4. Order processing and production scheduling begin immediately upon bank payment verification.',
        36,
        y,
        { width: 523, lineGap: 1.5 }
      );`;

const newFooterTerms = `      y += (isPaid ? 86 : 94);
      doc.fillColor(textSubtle).fontSize(7.5);
      doc.font(regularFont);
      doc.text(
        'Terms: 1. This document serves as the official ITACON GRANITO Purchase Order confirmation. ' +
        '2. Factory dispatch is scheduled per confirmed logistics slot. ' +
        '3. Transit insurance (0.35%) applies per ITACON B2B standard logistics policy. ' +
        '4. Generated electronically via ITACON Production System.',
        36,
        y,
        { width: 523, lineGap: 1.5 }
      );`;

if (!code.includes(oldFooterTerms)) {
  console.error('Failed to find oldFooterTerms');
  process.exit(1);
}
code = code.replace(oldFooterTerms, newFooterTerms);

// 8. In handleGenerateUnpaidPoPdf: quotation recovery step 6b
const oldUnpaidCall = `  // Generate PDF buffer using shared template with unpaid configuration
  const pdfBuffer = await createPoPdfBuffer(await enrichItemsWithProductDetails(db, orderData), null, customerProfile, {
    isPaid: false,
    bankConfig,
  });`;

const newUnpaidCall = `  // 6b. Orders linked before MRP fields were synced: recover them from the quotation
  let orderForPdf = orderData;
  if (!orderData.quotationMode && orderData.quotationId) {
    try {
      const qDoc = await db.collection('quotations').doc(orderData.quotationId).get();
      const q = qDoc.exists ? qDoc.data() : null;
      if (q && q.quotationMode === 'mrp') {
        orderForPdf = {
          ...orderData,
          quotationMode: 'mrp',
          basicAmount: q.basicAmount,
          insuranceAmount: q.insuranceAmount,
          basicPlusInsurance: q.basicPlusInsurance,
          packagingCharges: q.packagingCharges,
          items: q.items || orderData.items,
          orderItems: q.items || orderData.orderItems,
        };
      }
    } catch (err) {
      console.warn(\`[UnpaidPO] Warning: could not load quotation \${orderData.quotationId}:\`, err);
    }
  }

  // Generate PDF buffer using shared template with unpaid configuration
  const pdfBuffer = await createPoPdfBuffer(await enrichItemsWithProductDetails(db, orderForPdf), null, customerProfile, {
    isPaid: false,
    bankConfig,
  });`;

if (!code.includes(oldUnpaidCall)) {
  console.error('Failed to find oldUnpaidCall');
  process.exit(1);
}
code = code.replace(oldUnpaidCall, newUnpaidCall);

if (isCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync('functions/generatePaidPurchaseOrderPdf.js', code);
console.log('Successfully patched functions/generatePaidPurchaseOrderPdf.js');

