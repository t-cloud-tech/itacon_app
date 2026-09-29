import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/tile_order.dart';
import 'package:itacon_app/models/payment_config.dart';
import 'package:itacon_app/models/payment_submission.dart';

void main() {
  group('Manual Bank Transfer Payment System Tests', () {
    test('PaymentConfig correctly masks account number for privacy', () {
      final config = PaymentConfig(
        accountHolderName: 'ITACON GRANITO PVT LTD',
        bankName: 'HDFC Bank',
        accountNumber: '50200012345678',
        ifscCode: 'HDFC0000123',
        branchName: 'Morbi Main Branch',
        accountType: 'Current Account',
        enabled: true,
      );

      expect(config.maskedAccountNumber, equals('••••••••5678'));
      expect(config.accountNumber, equals('50200012345678'));
    });

    test('PaymentConfig short account fallback does not crash masking', () {
      final config = PaymentConfig(
        accountHolderName: 'ITACON GRANITO',
        bankName: 'Test Bank',
        accountNumber: '123',
        ifscCode: 'TEST0001',
        branchName: 'Branch',
        accountType: 'Current',
        enabled: true,
      );

      expect(config.maskedAccountNumber, equals('••••••••'));
    });

    test('PaymentConfig.unavailable() provides safe non-confidential placeholder', () {
      final fallback = PaymentConfig.unavailable();
      expect(fallback.enabled, isFalse);
      expect(fallback.accountHolderName, equals('Bank details unavailable'));
      expect(fallback.accountNumber, equals('Unavailable'));
      expect(fallback.maskedAccountNumber, equals('••••••••'));
    });

    test('PaymentConfig serializes and deserializes correctly', () {
      final config = PaymentConfig(
        accountHolderName: 'ITACON GRANITO PVT LTD',
        bankName: 'ICICI Bank',
        accountNumber: '001105001234',
        ifscCode: 'ICIC0000011',
        branchName: 'Morbi Industrial',
        accountType: 'Current Account',
        enabled: true,
        instructions: 'Please transfer exact order total.',
      );

      final map = config.toMap();
      final revived = PaymentConfig.fromMap(map);

      expect(revived.accountHolderName, equals(config.accountHolderName));
      expect(revived.bankName, equals(config.bankName));
      expect(revived.accountNumber, equals(config.accountNumber));
      expect(revived.ifscCode, equals(config.ifscCode));
      expect(revived.instructions, equals(config.instructions));
    });

    test('PaymentSubmission normalizes UTR string correctly', () {
      expect(PaymentSubmission.normalizeUtr('  2024-1029-ABCD-5678  '), equals('20241029ABCD5678'));
      expect(PaymentSubmission.normalizeUtr('utr/123/456 '), equals('UTR123456'));
      expect(PaymentSubmission.normalizeUtr('AXIS-neft-998811'), equals('AXISNEFT998811'));
      expect(PaymentSubmission.normalizeUtr(''), equals(''));
    });

    test('PaymentSubmission serializes and deserializes correctly', () {
      final now = DateTime.now();
      final submission = PaymentSubmission(
        submissionId: 'sub_test_001',
        orderId: 'ord_123',
        orderReference: 'ITC-PO-2026-001',
        customerId: 'cust_abc',
        customerName: 'Gujarat Tiles',
        salesPersonId: 'sp_10',
        paymentMethod: 'bank_transfer',
        expectedAmount: 154200.0,
        submittedAmount: 154200.0,
        utrNumber: '2024-1029-ABCD-5678',
        utrNormalized: '20241029ABCD5678',
        paymentDate: now,
        proofStoragePath: 'payment_proofs/ord_123/sub_test_001/receipt.jpg',
        status: 'pending_verification',
        submittedAt: now,
      );

      final map = submission.toMap();
      final revived = PaymentSubmission.fromMap(map, 'sub_test_001');

      expect(revived.submissionId, equals('sub_test_001'));
      expect(revived.orderReference, equals('ITC-PO-2026-001'));
      expect(revived.expectedAmount, equals(154200.0));
      expect(revived.submittedAmount, equals(154200.0));
      expect(revived.utrNormalized, equals('20241029ABCD5678'));
      expect(revived.status, equals('pending_verification'));
    });

    test('TileOrder getters correctly reflect payment lifecycle states', () {
      final orderDue = TileOrder(
        id: 'order_1',
        orderReference: 'PO-1',
        userId: 'u1',
        userCategory: 'Dealer',
        status: 'confirmed',
        orderType: 'standard',
        deliveryLocation: {},
        transportRequired: false,
        remarks: 'Test order',
        paymentStatus: 'payment_due',
        subtotal: 100000,
        discount: 0,
        taxAmount: 18000,
        totalAmount: 118000,
        totalBoxes: 100,
        totalWeightKg: 1000,
        totalWeightTons: 1.0,
        items: [],
      );

      expect(orderDue.isPaymentDue, isTrue);
      expect(orderDue.isPaymentPendingVerification, isFalse);
      expect(orderDue.isPaymentRejected, isFalse);

      final orderPending = orderDue.copyWith(paymentStatus: 'pending_verification');
      expect(orderPending.isPaymentDue, isFalse);
      expect(orderPending.isPaymentPendingVerification, isTrue);
      expect(orderPending.isPaymentRejected, isFalse);

      final orderRejected = orderDue.copyWith(
        paymentStatus: 'rejected',
        rejectionReason: 'Bank statement did not reflect UTR credit.',
      );
      expect(orderRejected.isPaymentDue, isFalse);
      expect(orderRejected.isPaymentPendingVerification, isFalse);
      expect(orderRejected.isPaymentRejected, isTrue);
      expect(orderRejected.rejectionReason, contains('Bank statement'));

      final orderPaid = orderDue.copyWith(
        paymentStatus: 'paid',
        paidAmount: 118000.0,
        paymentId: 'UTR20260901',
      );
      expect(orderPaid.isPaymentDue, isFalse);
      expect(orderPaid.isPaymentPendingVerification, isFalse);
      expect(orderPaid.paidAmount, equals(118000.0));
      expect(orderPaid.paymentId, equals('UTR20260901'));
    });

    test('Existing legacy orders without payment fields parse safely with default fallbacks', () {
      // Represents historical raw Firestore document without new Phase 2 fields
      final legacyMap = {
        'orderReference': 'LEGACY-PO-001',
        'userId': 'user_old',
        'userCategory': 'Wholesaler',
        'status': 'confirmed',
        'orderType': 'ready_stock',
        'deliveryLocation': {'address': 'Old Morbi Road'},
        'transportRequired': false,
        'subtotal': 50000.0,
        'discount': 0.0,
        'taxAmount': 9000.0,
        'totalAmount': 59000.0,
        'totalBoxes': 50,
        'totalWeightKg': 800.0,
        'totalWeightTons': 0.8,
        'items': [],
      };

      final legacyOrder = TileOrder.fromMap(legacyMap, 'legacy_doc_1');

      expect(legacyOrder.id, equals('legacy_doc_1'));
      expect(legacyOrder.paymentMethod, equals('bank_transfer'));
      expect(legacyOrder.paymentStatus, isNull);
      expect(legacyOrder.paidAmount, isNull);
      expect(legacyOrder.paymentId, isNull);
      expect(legacyOrder.paymentSubmissionId, isNull);
      expect(legacyOrder.proofStoragePath, isNull);
    });

    test('Exact amount matching validation using integer paise prevents float inaccuracies', () {
      const expectedAmount = 84520.50;

      int toPaise(num amount) => (amount * 100).round();

      bool isValidPaiseAmount(double submitted) {
        return toPaise(submitted) == toPaise(expectedAmount);
      }

      expect(isValidPaiseAmount(84520.50), isTrue);
      expect(toPaise(84520.50), equals(8452050));
      expect(isValidPaiseAmount(84520.49), isFalse); // underpayment rejected
      expect(isValidPaiseAmount(84520.51), isFalse); // overpayment rejected
      expect(isValidPaiseAmount(0.0), isFalse);
    });

    test('Receipt file upload size, MIME, and deterministic receipt filename regex', () {
      const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
      final deterministicNameRegex = RegExp(r'^receipt\.(jpg|jpeg|png|webp|pdf)$', caseSensitive: false);

      bool isReceiptValid(String filename, int size) {
        if (size > maxSizeBytes) return false;
        return deterministicNameRegex.hasMatch(filename);
      }

      // Valid deterministic filenames
      expect(isReceiptValid('receipt.jpg', 2 * 1024 * 1024), isTrue);
      expect(isReceiptValid('receipt.jpeg', 2 * 1024 * 1024), isTrue);
      expect(isReceiptValid('receipt.png', 500 * 1024), isTrue);
      expect(isReceiptValid('receipt.webp', 100 * 1024), isTrue);
      expect(isReceiptValid('receipt.pdf', 8 * 1024 * 1024), isTrue);

      // Invalid filenames (arbitrary names prevented)
      expect(isReceiptValid('screenshot.jpg', 2 * 1024 * 1024), isFalse);
      expect(isReceiptValid('random.png', 500 * 1024), isFalse);
      expect(isReceiptValid('bank_slip.pdf', 8 * 1024 * 1024), isFalse);
      expect(isReceiptValid('receipt.exe', 1024), isFalse);
      expect(isReceiptValid('receipt.jpg', 11 * 1024 * 1024), isFalse); // Oversized rejected
    });
  });
}

