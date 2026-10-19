import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:itacon_app/models/business_defaulter_result.dart';
import 'package:itacon_app/services/business_defaulter_service.dart';
import 'package:itacon_app/screens/business_defaulter_lookup_screen.dart';

// Fake service for testing the UI states without needing a live network/Firebase instance
class FakeBusinessDefaulterService extends BusinessDefaulterService {
  BusinessDefaulterResult? mockResult;
  BusinessDefaulterException? mockException;
  int callCount = 0;
  String? lastGst;
  String? lastPhone;

  FakeBusinessDefaulterService({this.mockResult, this.mockException});

  @override
  Future<BusinessDefaulterResult> checkDefaulter({String? gst, String? phone}) async {
    callCount++;
    lastGst = gst;
    lastPhone = phone;

    // Run client-side validation logic
    final cleanedGst = BusinessDefaulterService.normalizeGst(gst);
    final cleanedPhone = BusinessDefaulterService.normalizePhone(phone);

    if (cleanedGst.isEmpty && cleanedPhone.isEmpty) {
      throw const DefaulterValidationException(
        "Please provide at least one search parameter: a valid GSTIN or 10-digit mobile number.",
      );
    }

    if (cleanedGst.isNotEmpty && cleanedGst.length != 15) {
      throw const DefaulterValidationException(
        "Invalid GSTIN. An Indian GSTIN must contain exactly 15 alphanumeric characters.",
      );
    }

    if (cleanedPhone.isNotEmpty && cleanedPhone.length != 10) {
      throw const DefaulterValidationException(
        "Invalid phone number. Please enter a valid 10-digit mobile number.",
      );
    }

    if (mockException != null) {
      throw mockException!;
    }

    return mockResult ??
        const BusinessDefaulterResult(
          success: true,
          exists: false,
          isDefaulter: false,
          riskLevel: DefaulterRiskLevel.safe,
          matchedCount: 0,
          reportCount: DefaulterReportCount(),
        );
  }
}

void main() {
  group('BusinessDefaulterResult & Risk Level Unit Tests', () {
    test('DefaulterRiskLevel parses all 5 documented classifications correctly', () {
      expect(DefaulterRiskLevelExtension.fromString('HIGH'), DefaulterRiskLevel.high);
      expect(DefaulterRiskLevelExtension.fromString('MEDIUM'), DefaulterRiskLevel.medium);
      expect(DefaulterRiskLevelExtension.fromString('LOW'), DefaulterRiskLevel.low);
      expect(DefaulterRiskLevelExtension.fromString('CLEAN'), DefaulterRiskLevel.clean);
      expect(DefaulterRiskLevelExtension.fromString('SAFE'), DefaulterRiskLevel.safe);
      expect(DefaulterRiskLevelExtension.fromString('UNKNOWN_FALLBACK'), DefaulterRiskLevel.safe);
    });

    test('BusinessDefaulterResult parses Scenario A (High Risk Defaulter)', () {
      final json = {
        'success': true,
        'exists': true,
        'isDefaulter': true,
        'riskLevel': 'HIGH',
        'matchedCount': 1,
        'reportCount': {
          'total': 3,
          'verified': 2,
          'pending': 1,
          'closed': 0,
        },
        'parties': [
          {
            'id': '664b18c0e2a87401c9012345',
            'companyName': 'Acme Trading & Logistics Pvt Ltd',
            'gst': '27AABCS1429B1Z2',
            'city': 'Mumbai',
            'state': 'Maharashtra',
            'address': 'Unit 402, Trade Square, Andheri East',
            'phone': '******2345',
          }
        ],
      };

      final result = BusinessDefaulterResult.fromJson(json);

      expect(result.success, true);
      expect(result.exists, true);
      expect(result.isDefaulter, true);
      expect(result.riskLevel, DefaulterRiskLevel.high);
      expect(result.reportCount.total, 3);
      expect(result.reportCount.verified, 2);
      expect(result.reportCount.pending, 1);
      expect(result.reportCount.closed, 0);
      expect(result.parties.length, 1);
      expect(result.parties.first.companyName, 'Acme Trading & Logistics Pvt Ltd');
      expect(result.parties.first.locationString, 'Mumbai, Maharashtra');
      expect(result.hasVerifiedReports, true);
      expect(result.hasPendingReports, true);
      expect(result.hasClosedReports, false);
    });

    test('BusinessDefaulterResult parses Scenario C (Safe / Not Found)', () {
      final json = {
        'success': true,
        'exists': false,
        'isDefaulter': false,
        'riskLevel': 'SAFE',
        'matchedCount': 0,
        'reportCount': {
          'total': 0,
          'verified': 0,
          'pending': 0,
          'closed': 0,
        },
        'message': 'No matching record found in the database.',
      };

      final result = BusinessDefaulterResult.fromJson(json);

      expect(result.exists, false);
      expect(result.isDefaulter, false);
      expect(result.riskLevel, DefaulterRiskLevel.safe);
      expect(result.parties.isEmpty, true);
      expect(result.message, 'No matching record found in the database.');
      expect(result.disclaimer, contains('SAFE indicates no negative records exist'));
    });
  });

  group('BusinessDefaulterService Normalization & Validation Tests', () {
    test('normalizeGst handles spaces and lowercasing', () {
      expect(BusinessDefaulterService.normalizeGst(' 24aaacg1234f1z8 '), '24AAACG1234F1Z8');
      expect(BusinessDefaulterService.normalizeGst(null), '');
      expect(BusinessDefaulterService.normalizeGst('24-AAACG-1234-F1Z8'), '24AAACG1234F1Z8');
    });

    test('normalizePhone standardizes to 10 digits', () {
      expect(BusinessDefaulterService.normalizePhone('+91 99793 12651'), '9979312651');
      expect(BusinessDefaulterService.normalizePhone('919979312651'), '9979312651');
      expect(BusinessDefaulterService.normalizePhone('99793-12651'), '9979312651');
      expect(BusinessDefaulterService.normalizePhone(null), '');
    });
  });

  group('BusinessDefaulterLookupScreen Widget Tests', () {
    testWidgets('renders initial search form with GSTIN and Phone fields', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: BusinessDefaulterLookupScreen(
            service: FakeBusinessDefaulterService(),
          ),
        ),
      );

      expect(find.text('Business Risk Verification'), findsOneWidget);
      expect(find.text('Search Parameters'), findsOneWidget);
      expect(find.text('Company GSTIN (Optional)'), findsOneWidget);
      expect(find.text('Mobile Number (Optional)'), findsOneWidget);
      expect(find.text('Check Business'), findsOneWidget);
      expect(find.text('Statutory & Advisory Notice'), findsOneWidget);
    });

    testWidgets('shows validation error when Check Business is tapped with empty inputs', (tester) async {
      final fakeService = FakeBusinessDefaulterService();

      await tester.pumpWidget(
        MaterialApp(
          home: BusinessDefaulterLookupScreen(service: fakeService),
        ),
      );

      await tester.tap(find.text('Check Business'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Please provide at least one search parameter'), findsOneWidget);
      expect(fakeService.callCount, 1);
    });

    testWidgets('displays High Risk result card with report counts and company card', (tester) async {
      final mockHighResult = BusinessDefaulterResult(
        success: true,
        exists: true,
        isDefaulter: true,
        riskLevel: DefaulterRiskLevel.high,
        matchedCount: 1,
        reportCount: const DefaulterReportCount(total: 3, verified: 2, pending: 1, closed: 0),
        parties: const [
          DefaulterParty(
            id: 'party_123',
            companyName: 'Morbi Ceramic Defaulters Pvt Ltd',
            gst: '24AAACG9999F1Z9',
            city: 'Morbi',
            state: 'Gujarat',
            address: 'Old Ghuntu Road, Morbi',
            phone: '******9999',
          ),
        ],
      );

      final fakeService = FakeBusinessDefaulterService(mockResult: mockHighResult);

      await tester.pumpWidget(
        MaterialApp(
          home: BusinessDefaulterLookupScreen(
            service: fakeService,
            initialGst: '24AAACG9999F1Z9',
          ),
        ),
      );

      await tester.tap(find.text('Check Business'));
      await tester.pumpAndSettle();

      expect(fakeService.callCount, 1);
      expect(find.text('RISK ASSESSMENT'), findsOneWidget);
      expect(find.text('High Risk'), findsOneWidget);
      expect(find.text('Dispute Reports Summary'), findsOneWidget);
      expect(find.text('Morbi Ceramic Defaulters Pvt Ltd'), findsOneWidget);
      expect(find.text('GSTIN: '), findsOneWidget);
      expect(find.text('24AAACG9999F1Z9'), findsNWidgets(2)); // in TextField and party card
      expect(find.text('Morbi, Gujarat'), findsOneWidget);
    });

    testWidgets('displays Safe / No Record result with mandatory statutory caution', (tester) async {
      const mockSafeResult = BusinessDefaulterResult(
        success: true,
        exists: false,
        isDefaulter: false,
        riskLevel: DefaulterRiskLevel.safe,
        matchedCount: 0,
        reportCount: DefaulterReportCount(total: 0, verified: 0, pending: 0, closed: 0),
        message: 'No matching record found in the database.',
      );

      final fakeService = FakeBusinessDefaulterService(mockResult: mockSafeResult);

      await tester.pumpWidget(
        MaterialApp(
          home: BusinessDefaulterLookupScreen(
            service: fakeService,
            initialPhone: '9898012345',
          ),
        ),
      );

      await tester.tap(find.text('Check Business'));
      await tester.pumpAndSettle();

      expect(find.text('No Record (Safe)'), findsOneWidget);
      expect(find.text('No Records Located'), findsOneWidget);
      expect(find.textContaining('A SAFE / No-Record result signifies only that no matching entries were found'), findsOneWidget);
    });

    testWidgets('displays error card when service throws DefaulterRateLimitException', (tester) async {
      final fakeService = FakeBusinessDefaulterService(
        mockException: const DefaulterRateLimitException(
          'Rate limit exceeded. Please wait a few minutes before trying again.',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: BusinessDefaulterLookupScreen(
            service: fakeService,
            initialGst: '24AAACG1234F1Z8',
          ),
        ),
      );

      await tester.tap(find.text('Check Business'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Rate limit exceeded'), findsOneWidget);
    });

    testWidgets('displays Access Restricted card when user is not authorized', (tester) async {
      final fakeService = FakeBusinessDefaulterService();

      await tester.pumpWidget(
        MaterialApp(
          home: BusinessDefaulterLookupScreen(
            service: fakeService,
            isAuthorizedOverride: false,
          ),
        ),
      );

      expect(find.text('Access Restricted'), findsOneWidget);
      expect(
        find.textContaining('restricted to authorized Sales Executives, Managers, and Administrators'),
        findsOneWidget,
      );
      expect(find.text('Search Parameters'), findsNothing);
      expect(find.text('Check Business'), findsNothing);
    });

    testWidgets('displays full search form when user is explicitly authorized', (tester) async {
      final fakeService = FakeBusinessDefaulterService();

      await tester.pumpWidget(
        MaterialApp(
          home: BusinessDefaulterLookupScreen(
            service: fakeService,
            isAuthorizedOverride: true,
          ),
        ),
      );

      expect(find.text('Access Restricted'), findsNothing);
      expect(find.text('Search Parameters'), findsOneWidget);
      expect(find.text('Check Business'), findsOneWidget);
    });
  });
}

