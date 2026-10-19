import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Five documented risk classifications per EXTERNAL_API_DOCUMENTATION.md
enum DefaulterRiskLevel {
  high,
  medium,
  low,
  clean,
  safe,
}

extension DefaulterRiskLevelExtension on DefaulterRiskLevel {
  String get code {
    switch (this) {
      case DefaulterRiskLevel.high:
        return 'HIGH';
      case DefaulterRiskLevel.medium:
        return 'MEDIUM';
      case DefaulterRiskLevel.low:
        return 'LOW';
      case DefaulterRiskLevel.clean:
        return 'CLEAN';
      case DefaulterRiskLevel.safe:
        return 'SAFE';
    }
  }

  String get label {
    switch (this) {
      case DefaulterRiskLevel.high:
        return 'High Risk';
      case DefaulterRiskLevel.medium:
        return 'Medium Risk';
      case DefaulterRiskLevel.low:
        return 'Low Risk';
      case DefaulterRiskLevel.clean:
        return 'Clean Record';
      case DefaulterRiskLevel.safe:
        return 'No Record (Safe)';
    }
  }

  String get badgeDescription {
    switch (this) {
      case DefaulterRiskLevel.high:
        return 'Confirmed default / non-payment complaints exist on the registry.';
      case DefaulterRiskLevel.medium:
        return 'Disputed allegations are actively pending verification.';
      case DefaulterRiskLevel.low:
        return 'Past reported disputes have been fully settled or closed.';
      case DefaulterRiskLevel.clean:
        return 'Registered business entity with zero negative reports.';
      case DefaulterRiskLevel.safe:
        return 'Entity not found in registry. Caution: Safe indicates no record exists, not financial immunity.';
    }
  }

  Color get color {
    switch (this) {
      case DefaulterRiskLevel.high:
        return AppTheme.statusError; // Red
      case DefaulterRiskLevel.medium:
        return AppTheme.statusWarning; // Amber / Orange
      case DefaulterRiskLevel.low:
        return AppTheme.statusInfo; // Blue / Green
      case DefaulterRiskLevel.clean:
        return AppTheme.statusSuccess; // Green
      case DefaulterRiskLevel.safe:
        return const Color(0xFF64748B); // Slate grey / subtle
    }
  }

  IconData get icon {
    switch (this) {
      case DefaulterRiskLevel.high:
        return Icons.dangerous_rounded;
      case DefaulterRiskLevel.medium:
        return Icons.warning_amber_rounded;
      case DefaulterRiskLevel.low:
        return Icons.info_outline_rounded;
      case DefaulterRiskLevel.clean:
        return Icons.verified_user_rounded;
      case DefaulterRiskLevel.safe:
        return Icons.search_off_rounded;
    }
  }

  static DefaulterRiskLevel fromString(String? level) {
    switch (level?.toUpperCase().trim()) {
      case 'HIGH':
        return DefaulterRiskLevel.high;
      case 'MEDIUM':
        return DefaulterRiskLevel.medium;
      case 'LOW':
        return DefaulterRiskLevel.low;
      case 'CLEAN':
        return DefaulterRiskLevel.clean;
      case 'SAFE':
      default:
        return DefaulterRiskLevel.safe;
    }
  }
}

/// Tally of dispute reports filed against the business entity
class DefaulterReportCount {
  final int total;
  final int verified;
  final int pending;
  final int closed;

  const DefaulterReportCount({
    this.total = 0,
    this.verified = 0,
    this.pending = 0,
    this.closed = 0,
  });

  factory DefaulterReportCount.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const DefaulterReportCount();
    return DefaulterReportCount(
      total: (json['total'] as num?)?.toInt() ?? 0,
      verified: (json['verified'] as num?)?.toInt() ?? 0,
      pending: (json['pending'] as num?)?.toInt() ?? 0,
      closed: (json['closed'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'total': total,
        'verified': verified,
        'pending': pending,
        'closed': closed,
      };
}

/// Sanitized business entity party details
class DefaulterParty {
  final String id;
  final String companyName;
  final String gst;
  final String city;
  final String state;
  final String address;
  final String phone;

  const DefaulterParty({
    required this.id,
    required this.companyName,
    this.gst = '',
    this.city = '',
    this.state = '',
    this.address = '',
    this.phone = '',
  });

  factory DefaulterParty.fromJson(Map<String, dynamic> json) {
    return DefaulterParty(
      id: json['id']?.toString() ?? '',
      companyName: json['companyName']?.toString() ?? 'Unknown Entity',
      gst: json['gst']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      state: json['state']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'companyName': companyName,
        'gst': gst,
        'city': city,
        'state': state,
        'address': address,
        'phone': phone,
      };

  String get locationString {
    final parts = [city, state].where((p) => p.trim().isNotEmpty);
    return parts.isEmpty ? 'Location unspecified' : parts.join(', ');
  }
}

/// Root model for Business Defaulter API verification response
class BusinessDefaulterResult {
  final bool success;
  final bool exists;
  final bool isDefaulter;
  final DefaulterRiskLevel riskLevel;
  final int matchedCount;
  final DefaulterReportCount reportCount;
  final List<DefaulterParty> parties;
  final String message;
  final String disclaimer;

  const BusinessDefaulterResult({
    required this.success,
    required this.exists,
    required this.isDefaulter,
    required this.riskLevel,
    required this.matchedCount,
    required this.reportCount,
    this.parties = const [],
    this.message = '',
    this.disclaimer =
        'SAFE indicates no negative records exist in the registry. It does not certify financial health or guarantee creditworthiness. Pending reports are unverified creditor claims under review.',
  });

  factory BusinessDefaulterResult.fromJson(Map<String, dynamic> json) {
    final rawParties = json['parties'] as List<dynamic>?;
    final parsedParties = rawParties != null
        ? rawParties
            .whereType<Map<String, dynamic>>()
            .map((p) => DefaulterParty.fromJson(p))
            .toList()
        : <DefaulterParty>[];

    return BusinessDefaulterResult(
      success: json['success'] == true,
      exists: json['exists'] == true,
      isDefaulter: json['isDefaulter'] == true,
      riskLevel: DefaulterRiskLevelExtension.fromString(json['riskLevel']?.toString()),
      matchedCount: (json['matchedCount'] as num?)?.toInt() ?? parsedParties.length,
      reportCount: DefaulterReportCount.fromJson(json['reportCount'] as Map<String, dynamic>?),
      parties: parsedParties,
      message: json['message']?.toString() ?? '',
      disclaimer: json['disclaimer']?.toString() ??
          'SAFE indicates no negative records exist in the registry. It does not certify financial health or guarantee creditworthiness. Pending reports are unverified creditor claims under review.',
    );
  }

  Map<String, dynamic> toJson() => {
        'success': success,
        'exists': exists,
        'isDefaulter': isDefaulter,
        'riskLevel': riskLevel.code,
        'matchedCount': matchedCount,
        'reportCount': reportCount.toJson(),
        'parties': parties.map((p) => p.toJson()).toList(),
        'message': message,
        'disclaimer': disclaimer,
      };

  bool get hasMultipleParties => parties.length > 1;
  bool get hasVerifiedReports => reportCount.verified > 0;
  bool get hasPendingReports => reportCount.pending > 0;
  bool get hasClosedReports => reportCount.closed > 0;
}
