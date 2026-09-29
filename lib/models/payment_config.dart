import 'package:cloud_firestore/cloud_firestore.dart';

/// Company Receiving Bank Account Configuration per Phase 2 specifications.
/// Read-only to customers; writable only by authorized administration/backend.
class PaymentConfig {
  final String accountHolderName;
  final String bankName;
  final String accountNumber;
  final String ifscCode;
  final String branchName;
  final String accountType;
  final bool enabled;
  final String instructions;
  final DateTime? updatedAt;
  final String updatedBy;

  const PaymentConfig({
    required this.accountHolderName,
    required this.bankName,
    required this.accountNumber,
    required this.ifscCode,
    required this.branchName,
    this.accountType = 'Current Account',
    this.enabled = true,
    this.instructions = 'Transfer the exact final invoice amount and quote your PO Reference in the transfer narration.',
    this.updatedAt,
    this.updatedBy = 'admin',
  });

  /// Safe fallback when no company bank config exists or before loading
  factory PaymentConfig.unavailable() {
    return const PaymentConfig(
      accountHolderName: 'Bank details unavailable',
      bankName: 'Bank details unavailable',
      accountNumber: 'Unavailable',
      ifscCode: 'Unavailable',
      branchName: 'Unavailable',
      accountType: 'Current Account',
      enabled: false,
      instructions: 'Please contact your assigned salesperson for company payment details.',
    );
  }

  /// Returns masked account number showing only last 4 digits (e.g. ••••••••1234)
  String get maskedAccountNumber {
    if (accountNumber.isEmpty || accountNumber.length < 4 || accountNumber == 'Unavailable') {
      return '••••••••';
    }
    final last4 = accountNumber.substring(accountNumber.length - 4);
    return '••••••••$last4';
  }

  Map<String, dynamic> toMap() {
    return {
      'accountHolderName': accountHolderName,
      'bankName': bankName,
      'accountNumber': accountNumber,
      'ifscCode': ifscCode,
      'branchName': branchName,
      'accountType': accountType,
      'enabled': enabled,
      'instructions': instructions,
      'updatedAt': updatedAt != null ? Timestamp.fromDate(updatedAt!) : FieldValue.serverTimestamp(),
      'updatedBy': updatedBy,
    };
  }

  factory PaymentConfig.fromMap(Map<String, dynamic>? map) {
    if (map == null || map.isEmpty) return PaymentConfig.unavailable();

    return PaymentConfig(
      accountHolderName: map['accountHolderName'] ?? 'Bank details unavailable',
      bankName: map['bankName'] ?? 'Bank details unavailable',
      accountNumber: map['accountNumber'] ?? 'Unavailable',
      ifscCode: map['ifscCode'] ?? 'Unavailable',
      branchName: map['branchName'] ?? 'Unavailable',
      accountType: map['accountType'] ?? 'Current Account',
      enabled: map['enabled'] as bool? ?? false,
      instructions: map['instructions'] ?? 'Transfer exact PO amount.',
      updatedAt: map['updatedAt'] is Timestamp ? (map['updatedAt'] as Timestamp).toDate() : null,
      updatedBy: map['updatedBy'] ?? 'admin',
    );
  }
}
