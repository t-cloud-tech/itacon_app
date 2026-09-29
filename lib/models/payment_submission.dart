import 'package:cloud_firestore/cloud_firestore.dart';

/// Represents an authoritative record in `paymentSubmissions/{submissionId}`.
/// Created and managed exclusively by backend Cloud Functions.
class PaymentSubmission {
  final String submissionId;
  final String orderId;
  final String orderReference;
  final String customerId;
  final String customerName;
  final String salesPersonId;
  final String paymentMethod;
  final double expectedAmount;
  final double submittedAmount;
  final String utrNumber;
  final String utrNormalized;
  final DateTime paymentDate;
  final String proofStoragePath;
  final String status; // pending_verification, verified, rejected
  final DateTime submittedAt;
  final DateTime? verifiedAt;
  final String? verifiedBy;
  final String? rejectionReason;

  const PaymentSubmission({
    required this.submissionId,
    required this.orderId,
    required this.orderReference,
    required this.customerId,
    this.customerName = '',
    this.salesPersonId = '',
    this.paymentMethod = 'bank_transfer',
    required this.expectedAmount,
    required this.submittedAmount,
    required this.utrNumber,
    required this.utrNormalized,
    required this.paymentDate,
    required this.proofStoragePath,
    this.status = 'pending_verification',
    required this.submittedAt,
    this.verifiedAt,
    this.verifiedBy,
    this.rejectionReason,
  });

  bool get isPending => status == 'pending_verification';
  bool get isVerified => status == 'verified';
  bool get isRejected => status == 'rejected';

  static String normalizeUtr(String input) {
    return input.trim().toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
  }

  Map<String, dynamic> toMap() {
    return {
      'submissionId': submissionId,
      'orderId': orderId,
      'orderReference': orderReference,
      'customerId': customerId,
      'customerName': customerName,
      'salesPersonId': salesPersonId,
      'paymentMethod': paymentMethod,
      'expectedAmount': expectedAmount,
      'submittedAmount': submittedAmount,
      'utrNumber': utrNumber,
      'utrNormalized': utrNormalized,
      'paymentDate': Timestamp.fromDate(paymentDate),
      'proofStoragePath': proofStoragePath,
      'status': status,
      'submittedAt': Timestamp.fromDate(submittedAt),
      'verifiedAt': verifiedAt != null ? Timestamp.fromDate(verifiedAt!) : null,
      'verifiedBy': verifiedBy,
      'rejectionReason': rejectionReason,
    };
  }

  factory PaymentSubmission.fromMap(Map<String, dynamic> map, String id) {
    DateTime pDate;
    if (map['paymentDate'] is Timestamp) {
      pDate = (map['paymentDate'] as Timestamp).toDate();
    } else if (map['paymentDate'] is String) {
      pDate = DateTime.tryParse(map['paymentDate']) ?? DateTime.now();
    } else {
      pDate = DateTime.now();
    }

    DateTime sDate;
    if (map['submittedAt'] is Timestamp) {
      sDate = (map['submittedAt'] as Timestamp).toDate();
    } else {
      sDate = DateTime.now();
    }

    DateTime? vDate;
    if (map['verifiedAt'] is Timestamp) {
      vDate = (map['verifiedAt'] as Timestamp).toDate();
    }

    final rawUtr = map['utrNumber'] ?? '';
    final normUtr = map['utrNormalized'] ?? normalizeUtr(rawUtr);

    return PaymentSubmission(
      submissionId: map['submissionId'] ?? id,
      orderId: map['orderId'] ?? '',
      orderReference: map['orderReference'] ?? '',
      customerId: map['customerId'] ?? '',
      customerName: map['customerName'] ?? '',
      salesPersonId: map['salesPersonId'] ?? '',
      paymentMethod: map['paymentMethod'] ?? 'bank_transfer',
      expectedAmount: (map['expectedAmount'] as num?)?.toDouble() ?? 0.0,
      submittedAmount: (map['submittedAmount'] as num?)?.toDouble() ?? 0.0,
      utrNumber: rawUtr,
      utrNormalized: normUtr,
      paymentDate: pDate,
      proofStoragePath: map['proofStoragePath'] ?? '',
      status: map['status'] ?? 'pending_verification',
      submittedAt: sDate,
      verifiedAt: vDate,
      verifiedBy: map['verifiedBy'] as String?,
      rejectionReason: map['rejectionReason'] as String?,
    );
  }
}
