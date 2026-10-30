const functions = require('firebase-functions');
const admin = require('firebase-admin');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
  admin.initializeApp();
}

// Fonts setup for unicode rupee symbol (₹) and high quality rendering in unpaid mode
const notoRegularPath = path.join(__dirname, 'fonts', 'NotoSans-Regular.ttf');
const notoBoldPath = path.join(__dirname, 'fonts', 'NotoSans-Bold.ttf');
const hasNotoSans = fs.existsSync(notoRegularPath) && fs.existsSync(notoBoldPath);

/**
 * Shared Authoritative PO Calculation Function
 * Basic amount -> +0.35% transit insurance -> Basic + 0.35% -> +18% GST -> Estimated total (+ packaging note)
 */
function calculatePoAmounts(order) {
  let basic = 0;
  if (order.basicAmount !== undefined && order.basicAmount !== null && Number(order.basicAmount) > 0) {
    basic = Number(order.basicAmount);
  } else if (order.subtotal !== undefined && order.subtotal !== null && Number(order.subtotal) > 0) {
    basic = Number(order.subtotal);
  } else {
    const items = order.orderItems || order.items || [];
    for (const item of items) {
      if (item.lineTotal !== undefined && item.lineTotal !== null && Number(item.lineTotal) > 0) {
        basic += Number(item.lineTotal);
      } else {
        const qty = Number(item.quantitySqFt || item.quantityBoxes || item.quantity || 0);
        const rate = Number(item.unitPrice || item.ratePerSqFt || item.price || 0);
        basic += (qty * rate);
      }
    }
  }
  basic = Math.round(basic * 100) / 100;

  // 0.35% transit insurance
  const insurance = Math.round(basic * 0.0035 * 100) / 100;
  const basicPlusIns = Math.round((basic + insurance) * 100) / 100;
  const gst = Math.round(basicPlusIns * 0.18 * 100) / 100;
  let total = Math.round((basicPlusIns + gst) * 100) / 100;

  let packaging = 0;
  if (order.packagingCharges !== undefined && order.packagingCharges !== null && Number(order.packagingCharges) > 0) {
    packaging = Number(order.packagingCharges);
  }

  // Preserve paid order stored total if already verified paid
  if ((order.paymentStatus || '').toLowerCase() === 'paid') {
    if (order.totalAmount !== undefined && order.totalAmount !== null && Number(order.totalAmount) > 0) {
      total = Number(order.totalAmount);
    } else if (order.total !== undefined && order.total !== null && Number(order.total) > 0) {
      total = Number(order.total);
    }
  }

  return {
    basicAmount: basic,
    insuranceAmount: insurance,
    basicPlusInsurance: basicPlusIns,
    taxAmount: gst,
    totalAmount: total,
    packagingCharges: packaging,
  };
}

function formatInr(amount, useRupeeSymbol = false) {
  const prefix = useRupeeSymbol ? '₹' : 'Rs. ';
  return prefix + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converts INR rupees to exact integer paise to eliminate floating point imprecision.
 */
function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

/**
 * Formats a Date/Timestamp to standard Indian format (e.g. 16 Oct 2026, 10:30 AM).
 */
function formatDateTime(val) {
  if (!val) return 'N/A';
  const d = val.toDate ? val.toDate() : (val instanceof Date ? val : new Date(val));
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateOnly(val) {
  if (!val) return 'N/A';
  const d = val.toDate ? val.toDate() : (val instanceof Date ? val : new Date(val));
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function parseTimestampMillis(val, fallbackNow = false) {
  if (!val) return 0;
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'number') return val;
  if (val._seconds !== undefined) return val._seconds * 1000;
  const parsed = new Date(val).getTime();
  if (!isNaN(parsed)) return parsed;
  return fallbackNow ? Date.now() : 0;
}

/**
 * Renders the official Paid Purchase Order PDF in memory using PDFKit.
 */

/**
 * Draws a light diagonal watermark on the PDF page for unpaid POs.
 */
function drawUnpaidWatermark(doc) {
  doc.save();
  doc.rotate(-45, { origin: [297.5, 421] });
  doc.fontSize(80).fillColor('#94A3B8').fillOpacity(0.12);
  doc.text('UNPAID', 47.5, 380, { align: 'center', width: 500 });
  doc.restore();
  doc.fillOpacity(1.0);
}

/**
 * Sales rep display name: the name stored on the order, else the salesPersons / users
 * record for the assigned id. Never returns the raw id.
 */
async function resolveSalesRepName(db, order) {
  const stored = order.salespersonName || order.salesPersonName;
  if (stored && String(stored).trim()) return String(stored).trim();

  const spId = order.salesPersonId || order.salespersonId;
  if (spId) {
    for (const col of ['salesPersons', 'users']) {
      try {
        const snap = await db.collection(col).doc(String(spId)).get();
        const data = snap && snap.exists ? (snap.data() || {}) : null;
        const name = data && (data.name || data.fullName || data.displayName);
        if (name && String(name).trim()) return String(name).trim();
      } catch (err) {
        console.warn(`[PaidPO] Warning: could not load ${col}/${spId}:`, err);
      }
    }
  }
  return 'Direct Factory';
}

/**
 * Adds hsnCode and tile grade to each order item from its product record
 * (products/{id}, falling back to tiles/{id}); values already on the item are kept.
 */
async function enrichItemsWithProductDetails(db, order) {
  const salesRepName = await resolveSalesRepName(db, order);
  order = { ...order, salesRepName };

  const items = order.orderItems || order.items || [];
  if (!items.length) return order;

  const cache = new Map();
  const lookup = async (productId) => {
    if (!productId) return null;
    if (!cache.has(productId)) {
      let data = null;
      for (const col of ['products', 'tiles']) {
        try {
          const snap = await db.collection(col).doc(String(productId)).get();
          if (snap && snap.exists) {
            data = snap.data() || null;
            if (data && data.hsnCode) break;
          }
        } catch (err) {
          console.warn(`[PaidPO] Warning: could not load ${col}/${productId}:`, err);
        }
      }
      cache.set(productId, data);
    }
    return cache.get(productId);
  };

  const enriched = [];
  for (const item of items) {
    const product = await lookup(item.productId || item.tileId);
    enriched.push({
      ...item,
      hsnCode: item.hsnCode || (product && product.hsnCode) || '',
      gradeLabel: item.gradeLabel || (product && (product.gradeLabel || product.grade)) || '',
    });
  }
  return { ...order, orderItems: enriched, items: enriched };
}

function createPoPdfBuffer(order, submission, customerProfile, options = {}) {
  // Server-side enforcement: Paid mode is allowed ONLY when payment status is verified paid!
  const isPaid = (options.isPaid !== false) && ((order.paymentStatus || '').toLowerCase() === 'paid');
  const bankConfig = options.bankConfig || null;
  const calc = calculatePoAmounts(order);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      if (!isPaid && hasNotoSans) {
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
      }

      const primaryNavy = '#0B192C';
      const accentOrange = '#FF6B00';
      const textDark = '#1E293B';
      const textSubtle = '#64748B';
      const statusSuccess = '#059669';
      const successBg = '#ECFDF5';
      const borderSubtle = '#CBD5E1';

      // =========================================================================
      // 1. TOP HEADER & BRANDING
      // =========================================================================
      doc.rect(36, 36, 523, 72).fill('#F8FAFC');
      doc.rect(36, 36, 523, 72).strokeColor(borderSubtle).lineWidth(1).stroke();

      doc.fillColor(primaryNavy).fontSize(16).text('ITACON GRANITO PVT. LTD.', 48, 48, { bold: true });
      doc.fontSize(8).fillColor(textSubtle).text('Survey no. 345P1P4, 345P2 and 345P4 behind Vento Ceramic, Morbi-Jetpar Road, at Rangpar, Morbi(GUJ)- 363642', 48, 68, { width: 360 });
      doc.text('Email: info@itacongranito.com | Phone: 9374490901 | GSTIN: 24AAECI4020M1ZR', 48, 90, { width: 360, lineBreak: false });

      // Top-Right Official Paid Stamp or Unpaid Badge
      if (isPaid) {
        doc.rect(417, 53, 130, 38).fill(successBg);
        doc.rect(417, 53, 130, 38).strokeColor(statusSuccess).lineWidth(1).stroke();
        doc.fillColor(statusSuccess).fontSize(11).text('PAID', 420, 57, { align: 'center', width: 124, bold: true });
        doc.fontSize(6).fillColor('#065F46').text('PAYMENT VERIFIED & CONFIRMED', 420, 70, { align: 'center', width: 124, bold: true });
        doc.fontSize(6).text(`Date: ${formatDateOnly(order.paidAt || submission?.verifiedAt || new Date())}`, 420, 79, { align: 'center', width: 124 });
      } else {
        const isUnderVerification = (order.paymentStatus || '').toLowerCase() === 'pending_verification';
        const badgeBg = isUnderVerification ? '#FFFBEB' : '#FFF7ED';
        const badgeBorder = isUnderVerification ? '#F59E0B' : '#EA580C';
        const badgeTitleColor = isUnderVerification ? '#B45309' : '#C2410C';
        const badgeTitle = isUnderVerification ? 'PAYMENT UNDER VERIFICATION' : 'UNPAID — PAYMENT PENDING';
        const badgeSubtitle = isUnderVerification ? 'TRANSACTION AUDIT IN PROGRESS' : 'OFFICIAL PURCHASE ORDER ESTIMATE';
        const badgeDateStr = formatDateOnly(submission?.submittedAt || submission?.paymentDate || order.createdAt || new Date());

        doc.rect(370, 46, 177, 52).fill(badgeBg);
        doc.rect(370, 46, 177, 52).strokeColor(badgeBorder).lineWidth(1.5).stroke();
        doc.fillColor(badgeTitleColor).font(boldFont).fontSize(9.5).text(badgeTitle, 375, 54, { align: 'center', width: 167 });
        doc.fontSize(7).fillColor(badgeTitleColor).text(badgeSubtitle, 375, 69, { align: 'center', width: 167 });
        doc.font(regularFont).fontSize(7).text(`Date: ${badgeDateStr}`, 375, 81, { align: 'center', width: 167 });
      }

      // =========================================================================
      // 2. DOCUMENT TITLE & IDENTIFIERS BAR
      // =========================================================================
      let y = 120;
      doc.fillColor(primaryNavy).fontSize(13).text(isPaid ? 'OFFICIAL PAID PURCHASE ORDER' : 'OFFICIAL PURCHASE ORDER (ESTIMATE)', 36, y, { bold: true });
      y += 18;

      doc.rect(36, y, 523, 24).fill('#F1F5F9');
      doc.fillColor(textDark).fontSize(8.5);
      const poRef = order.orderReference || order.id;
      const orderDateStr = formatDateOnly(order.createdAt || new Date());
      const utrRef = order.paymentId || submission?.utrNumber || 'N/A';

      doc.text(`PO Ref: #${poRef}`, 46, y + 7, { bold: true });
      doc.text(`Order Date: ${orderDateStr}`, 210, y + 7);
      if (isPaid) {
        doc.text(`Verified UTR: ${utrRef}`, 370, y + 7, { bold: true });
      } else {
        const isUnderVerification = (order.paymentStatus || '').toLowerCase() === 'pending_verification';
        const payStatusLabel = isUnderVerification ? 'UNDER VERIFICATION' : 'PAYMENT PENDING';
        doc.text(`Payment: ${payStatusLabel}`, 370, y + 7, { bold: true });
      }

      // =========================================================================
      // 3. VENDOR & CUSTOMER/BILLING DETAILS
      // =========================================================================
      y += 34;
      doc.rect(36, y, 255, 96).strokeColor(borderSubtle).lineWidth(0.8).stroke();
      doc.rect(299, y, 260, 96).strokeColor(borderSubtle).lineWidth(0.8).stroke();

      // Factory / Dispatch Works
      doc.fillColor(primaryNavy).fontSize(9.5).text('FACTORY / DISPATCH WORKS:', 46, y + 8, { bold: true });
      doc.fontSize(8.5).fillColor(textDark);
      doc.text('ITACON Granito Dispatch Works (Unit 2)', 46, y + 22);
      const salesRepName = order.salesRepName || order.salespersonName || order.salesPersonName || 'Direct Factory';
      doc.fontSize(7.5).text('Survey no. 345P1P4, 345P2 and 345P4 behind Vento Ceramic, Morbi-Jetpar Road, at Rangpar, Morbi(GUJ)- 363642', 46, y + 34, { width: 238, height: 22 });
      doc.fontSize(8.5);
      doc.text('GSTIN: 24AAECI4020M1ZR', 46, y + 58);
      doc.text(`Sales Rep: ${salesRepName}`, 46, y + 70);

function getFormattedDeliveryAddress(order) {
  if (typeof order.deliveryAddress === 'string' && order.deliveryAddress.trim()) {
    return order.deliveryAddress.trim();
  }
  if (order.deliveryAddress && typeof order.deliveryAddress === 'object') {
    const d = order.deliveryAddress;
    const parts = [d.address, d.city, d.state, d.pincode].filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  if (order.deliveryLocation && typeof order.deliveryLocation === 'object') {
    const loc = order.deliveryLocation;
    if (typeof loc.address === 'string' && loc.address.trim()) return loc.address.trim();
    const parts = [loc.address, loc.city, loc.state, loc.pincode].filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  if (typeof order.deliveryLocation === 'string' && order.deliveryLocation.trim()) {
    return order.deliveryLocation.trim();
  }
  return 'Site Delivery';
}

      // Customer & Delivery Address
      const cName = order.customerName || customerProfile?.name || 'Customer';
      const cCompany = order.companyName || customerProfile?.companyName || '';
      const cPhone = order.customerPhone || customerProfile?.phone || '';
      const cGst = customerProfile?.gstNumber || customerProfile?.gstin || order.gstNumber || 'Unregistered / Retail';
      const deliveryAddr = getFormattedDeliveryAddress(order);

      doc.fillColor(primaryNavy).fontSize(9.5).text('BILL-TO / SHIP-TO CUSTOMER:', 309, y + 8, { bold: true });
      doc.fontSize(8.5).fillColor(textDark);
      doc.text(`${cCompany ? `${cCompany} (${cName})` : cName}`, 309, y + 22, { bold: true });
      doc.text(`Phone: ${cPhone || 'N/A'} | Category: ${order.userCategory || 'Dealer'}`, 309, y + 34);
      doc.text(`Delivery: ${deliveryAddr.length > 55 ? deliveryAddr.substring(0, 52) + '...' : deliveryAddr}`, 309, y + 46);
      doc.text(`State Code: ${order.stateCode || 'GJ'}`, 309, y + 58);
      doc.text(`Customer GSTIN: ${cGst}`, 309, y + 70);

      // =========================================================================
      // 4. ORDERED ITEMS BREAKDOWN TABLE
      // =========================================================================
      y += 108;
      doc.rect(36, y, 523, 20).fill(primaryNavy);
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
        doc.text(`${idx + 1}`, 42, y + 5);

        const prodName = item.productName || item.tileName || 'Ceramic Tile Item';
        const finish = item.surface || item.finish || 'Standard';
        const grade = item.gradeLabel || item.grade || '';
        doc.fontSize(6.5).text(`${prodName} (${finish})${grade ? ` - ${grade}` : ''}`, 62, y + 2.5, { width: 116, height: 18, lineGap: 0, ellipsis: true });
        doc.fontSize(8);
        doc.text(item.hsnCode || '-', 182, y + 5, { width: 60, lineBreak: false });

        const size = item.size || '600x1200';
        doc.text(size, 245, y + 5);

        const boxes = item.quantityBoxes || item.quantity || 0;
        const sqft = item.quantitySqFt || (boxes * 15.5);
        doc.text(`${boxes} Boxes`, 320, y + 5);

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
      });

      // Bottom border for table
      doc.moveTo(36, y).lineTo(559, y).strokeColor(borderSubtle).lineWidth(0.8).stroke();

      // =========================================================================
      // 5. FINANCIAL TOTALS & TAX BREAKDOWN
      // =========================================================================
      y += 12;
      const subtotal = Number(order.subtotal || order.quotationBreakdown?.subtotalAmount || 0);
      const discount = Number(order.discount || order.quotationBreakdown?.discountAmount || 0);
      const taxAmount = Number(order.taxAmount || order.tax || order.quotationBreakdown?.gstAmount || ((subtotal - discount) * 0.18));
      const totalAmount = Number(order.totalAmount || order.total || order.quotationBreakdown?.finalAmount || (subtotal - discount + taxAmount));
      const stateCode = (order.stateCode || 'GJ').toUpperCase();
      const isInterState = stateCode !== 'GJ' && stateCode !== '24';

      const summaryX = 330;
      const valX = 455;
      const valW = 95;

      doc.fontSize(8.5).fillColor(textSubtle);
      if (isMrpLinked || !isPaid) {
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
        doc.fillColor(textSubtle).font(regularFont).fontSize(7).text(`*Premium packaging charges: ${formatInr(packagingCharges, useRupeeSymbol)}`, summaryX, y + 28);
        y += 10;
      } else {
        doc.text('Subtotal:', summaryX, y);
        doc.fillColor(textDark).text(formatInr(subtotal), valX, y, { align: 'right', width: valW });

        if (discount > 0) {
          y += 14;
          doc.fillColor(textSubtle).text('Applied Discount:', summaryX, y);
          doc.fillColor(statusSuccess).text(`- ${formatInr(discount)}`, valX, y, { align: 'right', width: valW });
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
      }

      if (isPaid) {
        // =========================================================================
        // 6. VERIFIED PAYMENT AUDIT BOX (PAID ORDERS ONLY)
        // =========================================================================
        y += 34;
        doc.rect(36, y, 523, 76).fill(successBg);
        doc.rect(36, y, 523, 76).strokeColor(statusSuccess).lineWidth(1).stroke();

        doc.fillColor('#065F46').fontSize(9.5).text('VERIFIED PAYMENT DETAILS & BANK RECEIPT AUDIT', 48, y + 8, { bold: true });
        doc.fillColor(textDark).fontSize(8);

        const verifiedPaidAmt = Number(order.paidAmount || submission?.submittedAmount || totalAmount);
        const paidDateStr = formatDateTime(submission?.paymentDate || order.paidAt || new Date());
        const verifiedAtStr = formatDateTime(submission?.verifiedAt || order.paidAt || new Date());
        const verifiedByStaff = submission?.verifiedBy || 'Authorized Accounts Team';

        doc.text(`Payment Mode: Bank Wire / RTGS Transfer`, 48, y + 24);
        doc.text(`Bank UTR / Transaction ID: ${utrRef}`, 48, y + 36, { bold: true });
        doc.text(`Customer Transfer Date: ${paidDateStr}`, 48, y + 48);

        doc.text(`Verified Amount Paid: ${formatInr(verifiedPaidAmt)} (IN FULL)`, 290, y + 24, { bold: true });
        doc.text(`Accounts Verification Date: ${verifiedAtStr}`, 290, y + 36);
        doc.text(`Verified By Staff ID: ${verifiedByStaff}`, 290, y + 48);

        doc.fillColor(statusSuccess).fontSize(7.5).text(
          '[AUDIT CONFIRMED] Transaction reconciled with factory accounts. Production and dispatch authorization granted.',
          48,
          y + 62,
          { bold: true }
        );
      } else {
        // =========================================================================
        // 6. PAYMENT INSTRUCTIONS & COMPANY BANK DETAILS (UNPAID ORDERS ONLY)
        // =========================================================================
        y += 34;
        const infoBg = '#F8FAFC';
        const infoBorder = '#CBD5E1';
        doc.rect(36, y, 523, 84).fill(infoBg);
        doc.rect(36, y, 523, 84).strokeColor(infoBorder).lineWidth(1).stroke();

        doc.fillColor(primaryNavy).font(boldFont).fontSize(9.5).text('PAYMENT INSTRUCTIONS & COMPANY RECEIVING BANK DETAILS', 48, y + 8);
        doc.fillColor(textDark).font(regularFont).fontSize(8);

        const bName = bankConfig?.bankName || 'HDFC Bank Ltd';
        const accName = bankConfig?.accountName || 'ITACON GRANITO PRIVATE LIMITED';
        const accNo = bankConfig?.accountNumber || '50200088991122';
        const ifsc = bankConfig?.ifscCode || 'HDFC0001234';
        const branch = bankConfig?.branch || 'Morbi Main Branch';

        doc.text(`Beneficiary: ${accName}`, 48, y + 22, { width: 235 });
        doc.text(`Bank Name: ${bName}`, 48, y + 34, { width: 235 });
        doc.font(boldFont).text(`Account No: ${accNo}`, 48, y + 46, { width: 235 });
        doc.font(regularFont).text(`IFSC Code: ${ifsc} (${branch})`, 48, y + 58, { width: 235 });

        const amountToPay = calc.totalAmount;
        doc.font(boldFont).text(`Amount to Pay: ${formatInr(amountToPay, useRupeeSymbol)}`, 290, y + 22);
        doc.font(regularFont).text(`Payment Ref: PO Ref #${poRef}`, 290, y + 34);
        doc.text(`Payment Mode: NEFT / RTGS / IMPS Bank Transfer`, 290, y + 46);

        doc.fillColor('#DC2626').font(boldFont).fontSize(7.5).text(
          'Notice: This is not a payment receipt. Order processing & dispatch starts after payment verification.',
          48,
          y + 70,
          { width: 500 }
        );
      }

      // =========================================================================
      // 7. FOOTER TERMS & CONDITIONS
      // =========================================================================
      y += (isPaid ? 86 : 94);
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
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Core generation processor: validates authoritative payment data, renders PDF,
 * uploads privately to Storage, and idempotently updates orders/{orderId}.
 */
function createPaidPdfBuffer(order, submission, customerProfile) {
  return createPoPdfBuffer(order, submission, customerProfile, { isPaid: true });
}

async function processPaidPoGeneration(orderId, orderData = null, options = {}) {
  const db = options.db || admin.firestore();
  const bucket = options.bucket || (options.storage ? options.storage.bucket(options.bucketName) : admin.storage().bucket());
  const orderRef = db.collection('orders').doc(orderId);
  const nowTimestamp = (admin.firestore && admin.firestore.FieldValue && admin.firestore.FieldValue.serverTimestamp)
    ? admin.firestore.FieldValue.serverTimestamp()
    : new Date();

  // 1. Fetch fresh order document if not provided
  let currentOrder = orderData;
  if (!currentOrder) {
    const snap = await orderRef.get();
    if (!snap.exists) {
      throw new Error(`Order ${orderId} does not exist.`);
    }
    currentOrder = snap.data() || {};
  }

  // 2. Authoritative Payment State Check
  if ((currentOrder.paymentStatus || '').toLowerCase() !== 'paid') {
    throw new Error(`Order ${orderId} is not in paid status (current: ${currentOrder.paymentStatus}).`);
  }

  // 3. Idempotency Check
  if (currentOrder.paidPoStatus === 'ready' && currentOrder.paidPoDocumentPath) {
    console.log(`[PaidPO] Document already exists for ${orderId}: ${currentOrder.paidPoDocumentPath}`);
    return {
      success: true,
      path: currentOrder.paidPoDocumentPath,
      status: 'ready',
      alreadyGenerated: true,
    };
  }

  // Generate unique generation attempt ID
  const attemptId = 'gen_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

  // Concurrency Lock: Check if already generating within the last 5 minutes
  if (currentOrder.paidPoStatus === 'generating') {
    const started = parseTimestampMillis(currentOrder.paidPoGeneratingStartedAt, true);
    if (Date.now() - started < 5 * 60 * 1000) {
      console.log(`[PaidPO] Active generation lease held for order ${orderId} by attempt ${currentOrder.paidPoGenerationAttemptId}, skipping duplicate invocation.`);
      return { success: true, status: 'generating', attemptId: currentOrder.paidPoGenerationAttemptId };
    }
    console.log(`[PaidPO] Generation lease for order ${orderId} expired (> 5 min), reclaiming lease with attempt ${attemptId}.`);
  }

  // Atomic lease acquisition: set generating status with unique attempt ID
  await orderRef.update({
    paidPoStatus: 'generating',
    paidPoGeneratingStartedAt: nowTimestamp,
    paidPoGenerationAttemptId: attemptId,
    updatedAt: nowTimestamp,
  });

  try {
    // 4. Fetch Associated Payment Submission Record
    let submission = null;
    if (currentOrder.paymentSubmissionId) {
      const subDoc = await db.collection('paymentSubmissions').doc(currentOrder.paymentSubmissionId).get();
      if (subDoc.exists) {
        submission = subDoc.data() || null;
      }
    }

    if (!submission) {
      // Fallback search by orderId in paymentSubmissions
      const qSnap = await db.collection('paymentSubmissions')
        .where('orderId', '==', orderId)
        .where('status', '==', 'verified')
        .limit(1)
        .get();
      if (!qSnap.empty) {
        submission = qSnap.docs[0].data();
      }
    }

    // 5. Verification of Authoritative Payment Data
    const confirmedTotal = Number(currentOrder.totalAmount || currentOrder.total || 0);
    const paidAmount = Number(currentOrder.paidAmount || (submission ? submission.submittedAmount : 0));

    if (confirmedTotal <= 0) {
      throw new Error(`Order ${orderId} has invalid or zero confirmed total.`);
    }

    if (toPaise(paidAmount) !== toPaise(confirmedTotal)) {
      throw new Error(
        `Paid amount ₹${paidAmount.toFixed(2)} does not match confirmed PO total ₹${confirmedTotal.toFixed(2)}.`
      );
    }

    if (submission && submission.status !== 'verified') {
      throw new Error(`Payment submission status is ${submission.status}, expected verified.`);
    }

    // 6. Fetch Customer Profile for GSTIN and Billing Details
    let customerProfile = null;
    const customerId = currentOrder.userId || currentOrder.customerId;
    if (customerId) {
      try {
        const userDoc = await db.collection('users').doc(customerId).get();
        if (userDoc.exists) {
          customerProfile = userDoc.data() || null;
        }
      } catch (err) {
        console.warn(`[PaidPO] Warning: could not load user profile for ${customerId}:`, err);
      }
    }

    // 6b. Orders linked before MRP fields were synced: recover them from the quotation
    let orderForPdf = currentOrder;
    if (!currentOrder.quotationMode && currentOrder.quotationId) {
      try {
        const qDoc = await db.collection('quotations').doc(currentOrder.quotationId).get();
        const q = qDoc.exists ? qDoc.data() : null;
        if (q && q.quotationMode === 'mrp') {
          orderForPdf = {
            ...currentOrder,
            quotationMode: 'mrp',
            basicAmount: q.basicAmount,
            insuranceAmount: q.insuranceAmount,
            basicPlusInsurance: q.basicPlusInsurance,
            packagingCharges: q.packagingCharges,
            items: q.items || currentOrder.items,
            orderItems: q.items || currentOrder.orderItems,
          };
        }
      } catch (err) {
        console.warn(`[PaidPO] Warning: could not load quotation ${currentOrder.quotationId}:`, err);
      }
    }

    // 7. Render PDF Buffer
    orderForPdf = await enrichItemsWithProductDetails(db, orderForPdf);
    const pdfBuffer = await createPaidPdfBuffer(orderForPdf, submission, customerProfile);

    // 8. Upload to Attempt-Specific Staging Object
    // Staging ensures an expired or slow generation worker cannot prematurely overwrite official output
    const stagingFilePath = `purchase_orders/${orderId}/staging/${attemptId}.pdf`;
    const stagingFile = bucket.file(stagingFilePath);

    await stagingFile.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          orderId,
          orderReference: currentOrder.orderReference || orderId,
          documentType: 'paid_purchase_order_staging',
          generationAttemptId: attemptId,
          generatedAt: new Date().toISOString(),
        },
      },
      public: false,
    });

    // 9. Atomic Concurrency Verification BEFORE Promoting to Official Storage Target
    // If a crashed lease expired and a newer attempt took over, abort immediately and purge staging object
    const freshSnap = await orderRef.get();
    const freshData = freshSnap.data() || {};
    if (freshData.paidPoGenerationAttemptId && freshData.paidPoGenerationAttemptId !== attemptId) {
      console.warn(`[PaidPO] Attempt ${attemptId} superseded by newer attempt ${freshData.paidPoGenerationAttemptId}. Purging staging and aborting storage promotion.`);
      await stagingFile.delete().catch(() => {});
      return {
        success: false,
        status: 'superseded',
        error: `Generation attempt superseded by newer attempt ${freshData.paidPoGenerationAttemptId}.`,
      };
    }

    // 10. Safe Promotion to Official Target Path
    const storageFilePath = `purchase_orders/${orderId}/paid_po.pdf`;
    const finalFile = bucket.file(storageFilePath);

    if (typeof stagingFile.copy === 'function') {
      await stagingFile.copy(finalFile);
      await stagingFile.delete().catch(() => {});
    } else {
      // Direct write fallback for mock/local test environments without copy API
      await finalFile.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            orderId,
            orderReference: currentOrder.orderReference || orderId,
            documentType: 'paid_purchase_order',
            utrNumber: currentOrder.paymentId || submission?.utrNumber || '',
            generationAttemptId: attemptId,
            generatedAt: new Date().toISOString(),
          },
        },
        public: false,
      });
      await stagingFile.delete().catch(() => {});
    }

    // Update Order Document with Definitive Path & Ready Status
    await orderRef.update({
      paidPoDocumentPath: storageFilePath,
      paidPoStatus: 'ready',
      paidPoGeneratedAt: nowTimestamp,
      paidPoError: null,
      updatedAt: nowTimestamp,
    });

    console.log(`[PaidPO] Successfully generated and stored Paid PO for ${orderId} (attempt: ${attemptId}) at ${storageFilePath}`);
    return {
      success: true,
      path: storageFilePath,
      status: 'ready',
      attemptId,
    };
  } catch (err) {
    console.error(`[PaidPO] Generation failed for order ${orderId} (attempt: ${attemptId}):`, err);

    // Record failure status on order only if this attempt still holds the lease
    try {
      const freshSnap = await orderRef.get();
      const freshData = freshSnap.data() || {};
      if (!freshData.paidPoGenerationAttemptId || freshData.paidPoGenerationAttemptId === attemptId) {
        await orderRef.update({
          paidPoStatus: 'failed',
          paidPoError: err.message || 'Unknown PDF generation error',
          updatedAt: nowTimestamp,
        });
      }
    } catch (_) {}

    return {
      success: false,
      error: err.message,
      status: 'failed',
    };
  }
}

/**
 * Cloud Function Trigger: generatePaidPurchaseOrderPdf
 * Listens for order status updates where paymentStatus transitions to 'paid'.
 */
exports.generatePaidPurchaseOrderPdf = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data() || {};
    const afterData = change.after.data() || {};
    const orderId = context.params.orderId;

    const becamePaid = beforeData.paymentStatus !== 'paid' && afterData.paymentStatus === 'paid';
    const retryRequested = afterData.paymentStatus === 'paid' && afterData.paidPoStatus === 'retry_requested';

    // Trigger condition: payment status changed to paid, or explicit retry requested
    if (!becamePaid && !retryRequested) {
      return null;
    }

    if (afterData.paidPoStatus === 'ready' && afterData.paidPoDocumentPath && !retryRequested) {
      return null;
    }

    console.log(`[PaidPO Trigger] Triggered for order ${orderId} (becamePaid: ${becamePaid}, retry: ${retryRequested})`);
    return await processPaidPoGeneration(orderId, afterData);
  });

/**
 * Handler: retryPaidPoGeneration
 */
async function handleRetryPaidPoGeneration(data, context, options = {}) {
  if (!context.auth || !context.auth.uid) {
    const err = new Error('Authentication required.');
    err.code = 'unauthenticated';
    throw err;
  }

  const callerUid = context.auth.uid;
  const db = options.db || admin.firestore();
  const { orderId } = data || {};

  if (!orderId || typeof orderId !== 'string') {
    const err = new Error('Missing or invalid orderId.');
    err.code = 'invalid-argument';
    throw err;
  }

  const orderRef = db.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    const err = new Error('Order not found.');
    err.code = 'not-found';
    throw err;
  }

  const orderData = orderDoc.data() || {};
  const isOwner = (orderData.userId === callerUid || orderData.customerId === callerUid);

  // Check Staff Authorization
  let isAuthorizedStaff = false;
  if (!isOwner) {
    const userDoc = await db.collection('users').doc(callerUid).get();
    if (userDoc && userDoc.exists) {
      const uData = userDoc.data() || {};
      const role = (uData.role || '').toLowerCase();
      const isAdmin = role === 'admin' || role === 'manager' || (context.auth.token && context.auth.token.admin === true);
      const isAssignedSp = (role === 'salesperson' && (orderData.salesPersonId === callerUid || orderData.salespersonId === callerUid));
      isAuthorizedStaff = isAdmin || isAssignedSp;
    } else if (context.auth.token) {
      const role = (context.auth.token.role || '').toLowerCase();
      const isAdmin = role === 'admin' || role === 'manager' || context.auth.token.admin === true;
      const isAssignedSp = (role === 'salesperson' && (orderData.salesPersonId === callerUid || orderData.salespersonId === callerUid));
      isAuthorizedStaff = isAdmin || isAssignedSp;
    }
  }

  if (!isOwner && !isAuthorizedStaff) {
    const err = new Error('You are not authorized to retry Paid PO generation for this order.');
    err.code = 'permission-denied';
    throw err;
  }

  if ((orderData.paymentStatus || '').toLowerCase() !== 'paid') {
    const err = new Error('Order payment is not verified as paid.');
    err.code = 'failed-precondition';
    throw err;
  }

  // 1. Rate-Limit Repeated Retries (cooldown: 60 seconds)
  const lastRetry = parseTimestampMillis(orderData.paidPoLastRetryAt, true);
  if (lastRetry > 0 && Date.now() - lastRetry < 60 * 1000) {
    const err = new Error('Retry requested too recently. Please wait at least 60 seconds between retry attempts.');
    err.code = 'resource-exhausted';
    throw err;
  }

  // 2. No Arbitrary Regeneration: if already ready and document exists in Storage, return ready
  if (orderData.paidPoStatus === 'ready' && orderData.paidPoDocumentPath) {
    const bucket = options.bucket || (options.storage ? options.storage.bucket(options.bucketName) : admin.storage().bucket());
    const file = bucket.file(orderData.paidPoDocumentPath);
    let fileExists = true;
    if (typeof file.exists === 'function') {
      const [exists] = await file.exists();
      fileExists = exists;
    }
    if (fileExists) {
      return {
        success: true,
        status: 'ready',
        path: orderData.paidPoDocumentPath,
        alreadyGenerated: true,
        message: 'Paid PO document is already generated and ready for download.',
      };
    }
  }

  // Record retry request timestamp and increment retry counter
  const nowTimestamp = (admin.firestore && admin.firestore.FieldValue && admin.firestore.FieldValue.serverTimestamp)
    ? admin.firestore.FieldValue.serverTimestamp()
    : new Date();
  const retryCount = (Number(orderData.paidPoRetryCount) || 0) + 1;

  await orderRef.update({
    paidPoStatus: 'retry_requested',
    paidPoLastRetryAt: nowTimestamp,
    paidPoRetryCount: retryCount,
    updatedAt: nowTimestamp,
  });

  const result = await processPaidPoGeneration(orderId, null, options);
  if (!result.success) {
    const err = new Error(`Paid PO generation failed: ${result.error}`);
    err.code = 'internal';
    throw err;
  }

  return result;
}

/**
 * Handler: getPaidPoDownloadUrl
 */
async function handleGetPaidPoDownloadUrl(data, context, options = {}) {
  if (!context.auth || !context.auth.uid) {
    const err = new Error('Authentication required.');
    err.code = 'unauthenticated';
    throw err;
  }

  const callerUid = context.auth.uid;
  const db = options.db || admin.firestore();
  const bucket = options.bucket || (options.storage ? options.storage.bucket(options.bucketName) : admin.storage().bucket());
  const { orderId } = data || {};

  if (!orderId || typeof orderId !== 'string') {
    const err = new Error('Missing or invalid orderId.');
    err.code = 'invalid-argument';
    throw err;
  }

  const orderDoc = await db.collection('orders').doc(orderId).get();
  if (!orderDoc.exists) {
    const err = new Error('Order not found.');
    err.code = 'not-found';
    throw err;
  }

  const orderData = orderDoc.data() || {};
  const isOwner = (orderData.userId === callerUid || orderData.customerId === callerUid);

  // Check Staff Authorization
  let isAuthorizedStaff = false;
  if (!isOwner) {
    const userDoc = await db.collection('users').doc(callerUid).get();
    if (userDoc && userDoc.exists) {
      const uData = userDoc.data() || {};
      const role = (uData.role || '').toLowerCase();
      const isAdmin = role === 'admin' || role === 'manager' || (context.auth.token && context.auth.token.admin === true);
      const isAssignedSp = (role === 'salesperson' && (orderData.salesPersonId === callerUid || orderData.salespersonId === callerUid));
      isAuthorizedStaff = isAdmin || isAssignedSp;
    } else if (context.auth.token) {
      const role = (context.auth.token.role || '').toLowerCase();
      const isAdmin = role === 'admin' || role === 'manager' || context.auth.token.admin === true;
      const isAssignedSp = (role === 'salesperson' && (orderData.salesPersonId === callerUid || orderData.salespersonId === callerUid));
      isAuthorizedStaff = isAdmin || isAssignedSp;
    }
  }

  if (!isOwner && !isAuthorizedStaff) {
    const err = new Error('You are not authorized to access this Paid PO document.');
    err.code = 'permission-denied';
    throw err;
  }

  if ((orderData.paymentStatus || '').toLowerCase() !== 'paid') {
    const err = new Error('Order payment is not verified as paid.');
    err.code = 'failed-precondition';
    throw err;
  }

  const filePath = orderData.paidPoDocumentPath || `purchase_orders/${orderId}/paid_po.pdf`;
  const file = bucket.file(filePath);

  // Check exists if file has exists method
  if (file.exists) {
    const [exists] = await file.exists();
    if (!exists) {
      const genResult = await processPaidPoGeneration(orderId, orderData, options);
      if (!genResult.success) {
        const err = new Error('Paid PO document has not been generated yet. Please try again shortly.');
        err.code = 'not-found';
        throw err;
      }
    }
  }

  // Generate 15-minute secure signed URL
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });

  return {
    success: true,
    downloadUrl: signedUrl,
    filePath,
    expiresInSeconds: 900,
  };
}

/**
 * Callable Function: retryPaidPoGenerationCallable
 * Allows authorized staff (admin/manager/assigned salesperson) or customer to safely retry failed generation.
 */
exports.retryPaidPoGenerationCallable = functions.https.onCall(async (data, context) => {
  try {
    return await handleRetryPaidPoGeneration(data, context);
  } catch (err) {
    if (err.code && functions.https.HttpsError) {
      throw new functions.https.HttpsError(err.code, err.message);
    }
    throw err;
  }
});

/**
 * Callable Function: getPaidPoDownloadUrlCallable
 * Returns a secure, short-lived (15-minute) signed URL for the Paid PO.
 */
exports.getPaidPoDownloadUrlCallable = functions.https.onCall(async (data, context) => {
  try {
    return await handleGetPaidPoDownloadUrl(data, context);
  } catch (err) {
    if (err.code && functions.https.HttpsError) {
      throw new functions.https.HttpsError(err.code, err.message);
    }
    throw err;
  }
});


/**
 * Computes deterministic content hash of order items, total amount, and payment status.
 */
function getOrderContentHash(order) {
  const items = (order.orderItems || order.items || []).map((it) => ({
    name: it.productName || it.tileName || '',
    qty: it.quantityBoxes || it.quantity || 0,
    rate: it.unitPrice || it.ratePerSqFt || it.rate || it.price || 0,
    total: it.lineTotal || it.totalPrice || it.total || 0,
  }));
  const total = Number(order.totalAmount || order.total || 0);
  const paymentStatus = order.paymentStatus || 'unpaid';
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(JSON.stringify({ items, total, paymentStatus })).digest('hex').substring(0, 16);
}

/**
 * Handler: generateUnpaidPoPdf
 * Generates or retrieves existing Unpaid Purchase Order PDF.
 * Checks caller authorization (customer owner, assigned salesperson, or admin/manager).
 * Stores document at separate path: purchase_orders/{orderId}/unpaid/{poRef}_UNPAID.pdf.
 */
async function handleGenerateUnpaidPoPdf(data, context, options = {}) {
  if (!context.auth || !context.auth.uid) {
    const err = new Error('Authentication required.');
    err.code = 'unauthenticated';
    throw err;
  }

  const callerUid = context.auth.uid;
  const db = options.db || admin.firestore();
  const bucket = options.bucket || (options.storage ? options.storage.bucket(options.bucketName) : admin.storage().bucket());
  const { orderId } = data || {};

  if (!orderId || typeof orderId !== 'string') {
    const err = new Error('Missing or invalid orderId.');
    err.code = 'invalid-argument';
    throw err;
  }

  const orderRef = db.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) {
    const err = new Error('Order not found.');
    err.code = 'not-found';
    throw err;
  }

  const orderData = orderDoc.data() || {};
  const isOwner = (orderData.userId === callerUid || orderData.customerId === callerUid);

  // Check Staff Authorization
  let isAuthorizedStaff = false;
  if (!isOwner) {
    const userDoc = await db.collection('users').doc(callerUid).get();
    if (userDoc && userDoc.exists) {
      const uData = userDoc.data() || {};
      const role = (uData.role || '').toLowerCase();
      const isAdmin = role === 'admin' || role === 'manager' || (context.auth.token && context.auth.token.admin === true);
      const isAssignedSp = (role === 'salesperson' && (orderData.salesPersonId === callerUid || orderData.salespersonId === callerUid));
      isAuthorizedStaff = isAdmin || isAssignedSp;
    } else if (context.auth.token) {
      const role = (context.auth.token.role || '').toLowerCase();
      const isAdmin = role === 'admin' || role === 'manager' || context.auth.token.admin === true;
      const isAssignedSp = (role === 'salesperson' && (orderData.salesPersonId === callerUid || orderData.salespersonId === callerUid));
      isAuthorizedStaff = isAdmin || isAssignedSp;
    }
  }

  if (!isOwner && !isAuthorizedStaff) {
    const err = new Error('You are not authorized to access this Purchase Order document.');
    err.code = 'permission-denied';
    throw err;
  }

  const poRef = (orderData.orderReference || orderId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const storageFilePath = `purchase_orders/${orderId}/unpaid/${poRef}_UNPAID.pdf`;
  const currentHash = getOrderContentHash(orderData);

  // Check if existing file is still valid and unchanged
  if (orderData.unpaidPoDocumentPath === storageFilePath && orderData.unpaidPoContentHash === currentHash) {
    const file = bucket.file(storageFilePath);
    let fileExists = true;
    if (typeof file.exists === 'function') {
      const [exists] = await file.exists();
      fileExists = exists;
    }
    if (fileExists) {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000,
      });
      return {
        success: true,
        downloadUrl: signedUrl,
        filePath: storageFilePath,
        fileName: `${poRef}_UNPAID.pdf`,
        alreadyGenerated: true,
        expiresInSeconds: 900,
      };
    }
  }

  // Fetch Customer Profile if available
  let customerProfile = null;
  const custUid = orderData.userId || orderData.customerId;
  if (custUid) {
    try {
      const custDoc = await db.collection('users').doc(custUid).get();
      if (custDoc && custDoc.exists) {
        customerProfile = custDoc.data();
      }
    } catch (_) {}
  }

  // Fetch Company Receiving Bank Details
  let bankConfig = null;
  try {
    const bankDoc = await db.collection('paymentConfig').doc('bankTransfer').get();
    if (bankDoc && bankDoc.exists) {
      bankConfig = bankDoc.data();
    }
  } catch (_) {}

  // Generate PDF buffer using shared template with unpaid configuration
  const pdfBuffer = await createPoPdfBuffer(await enrichItemsWithProductDetails(db, orderData), null, customerProfile, {
    isPaid: false,
    bankConfig,
  });

  const finalFile = bucket.file(storageFilePath);
  await finalFile.save(pdfBuffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        orderId,
        orderReference: orderData.orderReference || orderId,
        documentType: 'unpaid_purchase_order',
        contentHash: currentHash,
        generatedAt: new Date().toISOString(),
      },
    },
    public: false,
  });

  const nowTimestamp = (admin.firestore && admin.firestore.FieldValue && admin.firestore.FieldValue.serverTimestamp)
    ? admin.firestore.FieldValue.serverTimestamp()
    : new Date();

  await orderRef.update({
    unpaidPoDocumentPath: storageFilePath,
    unpaidPoContentHash: currentHash,
    unpaidPoGeneratedAt: nowTimestamp,
    updatedAt: nowTimestamp,
  });

  const [signedUrl] = await finalFile.getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000,
  });

  return {
    success: true,
    downloadUrl: signedUrl,
    filePath: storageFilePath,
    fileName: `${poRef}_UNPAID.pdf`,
    alreadyGenerated: false,
    expiresInSeconds: 900,
  };
}

/**
 * Callable Function: generateUnpaidPoPdf
 * Returns a secure, short-lived (15-minute) signed URL for the Unpaid PO.
 */
exports.generateUnpaidPoPdf = functions.https.onCall(async (data, context) => {
  try {
    return await handleGenerateUnpaidPoPdf(data, context);
  } catch (err) {
    if (err.code && functions.https.HttpsError) {
      throw new functions.https.HttpsError(err.code, err.message);
    }
    throw err;
  }
});

exports.processPaidPoGeneration = processPaidPoGeneration;
exports.createPaidPdfBuffer = createPaidPdfBuffer;
exports.handleRetryPaidPoGeneration = handleRetryPaidPoGeneration;
exports.handleGetPaidPoDownloadUrl = handleGetPaidPoDownloadUrl;
exports.createPoPdfBuffer = createPoPdfBuffer;
exports.handleGenerateUnpaidPoPdf = handleGenerateUnpaidPoPdf;
exports.getOrderContentHash = getOrderContentHash;
exports.calculatePoAmounts = calculatePoAmounts;
