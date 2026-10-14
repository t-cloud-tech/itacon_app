import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_order.dart';
import 'package:itacon_app/models/payment_config.dart';
import 'package:itacon_app/utils/payment_receipt_validator.dart';
import 'package:itacon_app/screens/order_details_screen.dart';

void main() {
  group('PaymentReceiptValidator Unit Tests', () {
    test('Allowed extensions include PDF, JPG, JPEG, PNG, WEBP', () {
      expect(PaymentReceiptValidator.isValidExtension('receipt.pdf'), isTrue);
      expect(PaymentReceiptValidator.isValidExtension('RECEIPT.PDF'), isTrue);
      expect(PaymentReceiptValidator.isValidExtension('proof.jpg'), isTrue);
      expect(PaymentReceiptValidator.isValidExtension('proof.jpeg'), isTrue);
      expect(PaymentReceiptValidator.isValidExtension('screenshot.png'), isTrue);
      expect(PaymentReceiptValidator.isValidExtension('statement.webp'), isTrue);
    });

    test('Disallowed extensions are strictly rejected', () {
      expect(PaymentReceiptValidator.isValidExtension('malicious.exe'), isFalse);
      expect(PaymentReceiptValidator.isValidExtension('script.sh'), isFalse);
      expect(PaymentReceiptValidator.isValidExtension('document.doc'), isFalse);
      expect(PaymentReceiptValidator.isValidExtension('document.docx'), isFalse);
      expect(PaymentReceiptValidator.isValidExtension('notes.txt'), isFalse);
      expect(PaymentReceiptValidator.isValidExtension('vector.svg'), isFalse);
      expect(PaymentReceiptValidator.isValidExtension('archive.zip'), isFalse);
      expect(PaymentReceiptValidator.isValidExtension('no_extension'), isFalse);
    });

    test('MIME content types match Firebase Storage specifications', () {
      expect(PaymentReceiptValidator.getContentType('receipt.pdf'), equals('application/pdf'));
      expect(PaymentReceiptValidator.getContentType('pdf'), equals('application/pdf'));
      expect(PaymentReceiptValidator.getContentType('receipt.jpg'), equals('image/jpeg'));
      expect(PaymentReceiptValidator.getContentType('jpg'), equals('image/jpeg'));
      expect(PaymentReceiptValidator.getContentType('receipt.jpeg'), equals('image/jpeg'));
      expect(PaymentReceiptValidator.getContentType('jpeg'), equals('image/jpeg'));
      expect(PaymentReceiptValidator.getContentType('receipt.png'), equals('image/png'));
      expect(PaymentReceiptValidator.getContentType('png'), equals('image/png'));
      expect(PaymentReceiptValidator.getContentType('receipt.webp'), equals('image/webp'));
      expect(PaymentReceiptValidator.getContentType('webp'), equals('image/webp'));
      expect(PaymentReceiptValidator.getContentType('unknown.xyz'), equals('application/octet-stream'));
    });

    test('File size validation adheres to 10 MB limit', () {
      const tenMb = 10 * 1024 * 1024;
      expect(PaymentReceiptValidator.isValidFileSize(1), isTrue);
      expect(PaymentReceiptValidator.isValidFileSize(5 * 1024 * 1024), isTrue);
      expect(PaymentReceiptValidator.isValidFileSize(tenMb), isTrue);

      expect(PaymentReceiptValidator.isValidFileSize(0), isFalse);
      expect(PaymentReceiptValidator.isValidFileSize(-100), isFalse);
      expect(PaymentReceiptValidator.isValidFileSize(tenMb + 1), isFalse);
      expect(PaymentReceiptValidator.isValidFileSize(15 * 1024 * 1024), isFalse);
    });

    test('Magic bytes validation for PDF documents', () {
      // Valid PDF starts with '%PDF-' (0x25, 0x50, 0x44, 0x46)
      final validPdfBytes = Uint8List.fromList([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x35]);
      expect(PaymentReceiptValidator.isValidHeader(validPdfBytes, 'pdf'), isTrue);

      // Invalid / corrupt PDF bytes
      final corruptedPdf = Uint8List.fromList([0x00, 0x01, 0x02, 0x03]);
      expect(PaymentReceiptValidator.isValidHeader(corruptedPdf, 'pdf'), isFalse);
    });

    test('Magic bytes validation for JPEG, PNG, and WEBP images', () {
      // JPEG SOI: 0xFF, 0xD8, 0xFF
      final validJpg = Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      expect(PaymentReceiptValidator.isValidHeader(validJpg, 'jpg'), isTrue);
      expect(PaymentReceiptValidator.isValidHeader(validJpg, 'jpeg'), isTrue);

      // PNG signature: 0x89, 'PNG\r\n\x1a\n'
      final validPng = Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      expect(PaymentReceiptValidator.isValidHeader(validPng, 'png'), isTrue);

      // WEBP signature: 'RIFF' .... 'WEBP'
      final validWebp = Uint8List.fromList([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x20, 0x00, 0x00, 0x00, // file size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      expect(PaymentReceiptValidator.isValidHeader(validWebp, 'webp'), isTrue);

      // Corrupt image headers
      final corruptJpg = Uint8List.fromList([0x47, 0x49, 0x46, 0x38]); // GIF disguised as JPG
      expect(PaymentReceiptValidator.isValidHeader(corruptJpg, 'jpg'), isFalse);
    });
  });

  group('Multiple Attachments Validation (PDF, Images, Mixed, up to 5)', () {
    final validPdfBytes = Uint8List.fromList([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37]);
    final validPngBytes = Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    final validJpgBytes = Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);

    test('Allow: One PDF only (no image required)', () {
      final attachments = [
        ReceiptAttachmentItem(
          name: 'bank_transfer_slip.pdf',
          sizeBytes: 300 * 1024,
          bytes: validPdfBytes,
        ),
      ];

      final result = PaymentReceiptValidator.validateAttachments(attachments);
      expect(result.isValid, isTrue);
      expect(result.normalizedExtension, equals('pdf'));
      expect(result.contentType, equals('application/pdf'));
    });

    test('Allow: One image only (no PDF required)', () {
      final attachments = [
        ReceiptAttachmentItem(
          name: 'gpay_success_screenshot.png',
          sizeBytes: 850 * 1024,
          bytes: validPngBytes,
        ),
      ];

      final result = PaymentReceiptValidator.validateAttachments(attachments);
      expect(result.isValid, isTrue);
      expect(result.normalizedExtension, equals('png'));
      expect(result.contentType, equals('image/png'));
    });

    test('Allow: Multiple PDFs only (e.g. 3 bank statement pages, up to 5)', () {
      final attachments = [
        ReceiptAttachmentItem(name: 'part1.pdf', sizeBytes: 200 * 1024, bytes: validPdfBytes),
        ReceiptAttachmentItem(name: 'part2.pdf', sizeBytes: 210 * 1024, bytes: validPdfBytes),
        ReceiptAttachmentItem(name: 'part3.pdf', sizeBytes: 220 * 1024, bytes: validPdfBytes),
      ];

      final result = PaymentReceiptValidator.validateAttachments(attachments);
      expect(result.isValid, isTrue);
    });

    test('Allow: Multiple images only (e.g. 4 screenshots, up to 5)', () {
      final attachments = [
        ReceiptAttachmentItem(name: 'screen1.jpg', sizeBytes: 500 * 1024, bytes: validJpgBytes),
        ReceiptAttachmentItem(name: 'screen2.png', sizeBytes: 600 * 1024, bytes: validPngBytes),
        ReceiptAttachmentItem(name: 'screen3.jpg', sizeBytes: 450 * 1024, bytes: validJpgBytes),
        ReceiptAttachmentItem(name: 'screen4.png', sizeBytes: 550 * 1024, bytes: validPngBytes),
      ];

      final result = PaymentReceiptValidator.validateAttachments(attachments);
      expect(result.isValid, isTrue);
    });

    test('Allow: Mixture of PDFs and images (e.g. 1 PDF + 2 PNGs)', () {
      final attachments = [
        ReceiptAttachmentItem(name: 'rtgs_counterfoil.pdf', sizeBytes: 400 * 1024, bytes: validPdfBytes),
        ReceiptAttachmentItem(name: 'sms_confirmation.png', sizeBytes: 350 * 1024, bytes: validPngBytes),
        ReceiptAttachmentItem(name: 'bank_app_receipt.jpg', sizeBytes: 420 * 1024, bytes: validJpgBytes),
      ];

      final result = PaymentReceiptValidator.validateAttachments(attachments);
      expect(result.isValid, isTrue);
    });

    test('Reject: Empty attachments list (at least one attachment required)', () {
      final result = PaymentReceiptValidator.validateAttachments([]);
      expect(result.isValid, isFalse);
      expect(result.errorMessage, contains('at least one payment receipt'));
    });

    test('Reject: More than 5 attachments (maximum 5 limit enforced)', () {
      final sixAttachments = List.generate(
        6,
        (i) => ReceiptAttachmentItem(
          name: 'receipt_$i.jpg',
          sizeBytes: 100 * 1024,
          bytes: validJpgBytes,
        ),
      );

      final result = PaymentReceiptValidator.validateAttachments(sixAttachments);
      expect(result.isValid, isFalse);
      expect(result.errorMessage, contains('Maximum 5 payment receipt attachments allowed'));
    });

    test('Reject: If any single attachment exceeds 10 MB', () {
      final attachments = [
        ReceiptAttachmentItem(name: 'valid_proof.pdf', sizeBytes: 1024 * 1024, bytes: validPdfBytes),
        ReceiptAttachmentItem(name: 'oversized_scan.pdf', sizeBytes: 12 * 1024 * 1024, bytes: validPdfBytes),
      ];

      final result = PaymentReceiptValidator.validateAttachments(attachments);
      expect(result.isValid, isFalse);
      expect(result.errorMessage, contains('exceeds the maximum allowed limit of 10 MB'));
    });

    test('Reject: If any single attachment has an invalid extension', () {
      final attachments = [
        ReceiptAttachmentItem(name: 'receipt.pdf', sizeBytes: 200 * 1024, bytes: validPdfBytes),
        ReceiptAttachmentItem(name: 'statement.docx', sizeBytes: 50 * 1024),
      ];

      final result = PaymentReceiptValidator.validateAttachments(attachments);
      expect(result.isValid, isFalse);
      expect(result.errorMessage, contains('Only PDF, JPG, PNG, and WEBP files are supported'));
    });
  });

  group('Storage Rules & Path Compatibility Tests', () {
    test('Storage path complies with backend regex and structure', () {
      final allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
      final orderId = 'order_test_999';
      final timestamp = 1718000000000;
      final submissionId = 'sub_${orderId}_$timestamp';

      for (final ext in allowedExts) {
        final storagePath = 'payment_proofs/$orderId/$submissionId/receipt.$ext';
        // Backend pattern: ^payment_proofs\/${orderId}\/[a-zA-Z0-9_-]+\/receipt\.(jpg|jpeg|png|webp|pdf)$
        final regex = RegExp(r'^payment_proofs\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/receipt\.(jpg|jpeg|png|webp|pdf)$');
        expect(regex.hasMatch(storagePath), isTrue, reason: 'Path $storagePath must match backend regex');
      }
    });

    test('Multi-attachment storage paths comply with Storage rules wildcard pattern', () {
      final orderId = 'order_test_999';
      final timestamp = 1718000000000;
      final submissionId = 'sub_${orderId}_$timestamp';
      final storageRulesRegex = RegExp(r'^payment_proofs\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/receipt\.(jpg|jpeg|png|webp|pdf)$');

      for (int i = 0; i < 5; i++) {
        final folderName = i == 0 ? submissionId : '${submissionId}_$i';
        final storagePath = 'payment_proofs/$orderId/$folderName/receipt.pdf';
        expect(storageRulesRegex.hasMatch(storagePath), isTrue);
      }
    });

    test('Payment status NEVER auto-marks order as paid upon receipt submission', () {
      final order = TileOrder(
        id: 'ord_123',
        orderReference: 'ITC-PO-2026-001',
        userId: 'cust_abc',
        userCategory: 'Wholesaler',
        status: 'confirmed',
        orderType: 'standard',
        deliveryLocation: {},
        transportRequired: false,
        remarks: 'Sample order',
        paymentStatus: 'payment_due',
        subtotal: 50000,
        discount: 0,
        taxAmount: 9000,
        totalAmount: 59000,
        totalBoxes: 50,
        totalWeightKg: 500,
        totalWeightTons: 0.5,
        items: [],
      );

      expect(order.isPaid, isFalse);
      expect(order.isPaymentDue, isTrue);

      // Simulating state after customer uploads receipt
      final orderAfterUpload = order.copyWith(
        paymentStatus: 'pending_verification',
        paymentSubmissionId: 'sub_ord_123_1718000000',
      );

      expect(orderAfterUpload.isPaid, isFalse);
      expect(orderAfterUpload.isPaymentPendingVerification, isTrue);
      expect(orderAfterUpload.isPaymentDue, isFalse);

      // Only authorized staff verification sets paid
      final orderAfterStaffVerification = orderAfterUpload.copyWith(
        paymentStatus: 'paid',
        paidAmount: 59000.0,
        paymentId: 'UTR2026061012345',
      );

      expect(orderAfterStaffVerification.isPaid, isTrue);
      expect(orderAfterStaffVerification.isPaymentPendingVerification, isFalse);
    });
  });

  group('OrderDetailsScreen Payment Receipt UI Tests', () {
    final testOrder = TileOrder(
      id: 'ord_test_ui',
      orderReference: 'ITC-PO-2026-TEST',
      userId: 'user_test',
      userCategory: 'Trader',
      status: 'confirmed',
      orderType: 'standard',
      deliveryLocation: {},
      transportRequired: false,
      remarks: 'Test PO',
      paymentStatus: 'payment_due',
      subtotal: 10000,
      discount: 0,
      taxAmount: 1800,
      totalAmount: 11800,
      totalBoxes: 10,
      totalWeightKg: 100,
      totalWeightTons: 0.1,
      items: [],
    );

    final testPaymentConfig = PaymentConfig(
      accountHolderName: 'ITACON GRANITO PVT LTD',
      bankName: 'HDFC Bank',
      accountNumber: '50200099887766',
      ifscCode: 'HDFC0001234',
      branchName: 'Morbi Branch',
      accountType: 'Current Account',
      enabled: true,
    );

    testWidgets('Displays clarified upload labels: "Upload Payment Receipt / Screenshot"', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OrderDetailsScreen(
              orderId: testOrder.id,
              initialOrder: testOrder,
              orderStream: Stream.value(testOrder),
              paymentConfigStream: Stream.value(testPaymentConfig),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify the clarified UI labels
      expect(find.text('Upload Payment Receipt / Screenshot'), findsWidgets);
      expect(find.text('PDF, JPG, PNG, WEBP — Max 10 MB each'), findsOneWidget);
      expect(find.byKey(const Key('select_payment_receipt_button')), findsOneWidget);
    });
  });
}
