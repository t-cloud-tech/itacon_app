import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:itacon_app/models/user_profile.dart';
import 'package:itacon_app/models/tile_order.dart';
import 'package:itacon_app/services/user_session_service.dart';
import 'package:itacon_app/widgets/app_avatar_image.dart';
import 'package:itacon_app/screens/order_details_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 1 & 2: UserSessionService & Avatar Memory Protection Tests', () {
    test('UserSessionService rejects storing raw base64 URI into SharedPreferences', () async {
      SharedPreferences.setMockInitialValues({});
      final hugeBase64 = 'data:image/jpeg;base64,${'A' * 50000}';

      final user = UserProfile(
        userId: 'CUST_STABLE_01',
        name: 'Test Customer',
        phone: '9876543210',
        email: 'customer@test.com',
        companyName: 'Test Ceramics Ltd',
        userCategory: 'Dealer',
        role: 'Dealer',
        profilePhotoUrl: hugeBase64,
      );

      await UserSessionService.saveUserSession(user);

      final prefs = await SharedPreferences.getInstance();
      final savedPhoto = prefs.getString('user_profile_photo_url');

      // Must be empty or null - never raw multi-kilobyte/megabyte base64
      expect(savedPhoto == null || savedPhoto.isEmpty, isTrue);
    });

    test('UserSessionService.restoreUserSession auto-purges legacy corrupt base64 strings', () async {
      final legacyCorruptBase64 = 'data:image/jpeg;base64,${'B' * 4000}';
      SharedPreferences.setMockInitialValues({
        'user_id': 'CUST_LEGACY_02',
        'user_name': 'Legacy User',
        'user_phone': '9876543211',
        'user_company': 'Legacy Corp',
        'user_category': 'Dealer',
        'user_profile_photo_url': legacyCorruptBase64,
        'is_logged_in': true,
      });

      final restored = await UserSessionService.restoreUserSession();
      expect(restored, isNotNull);
      expect(restored!.profilePhotoUrl, isNull);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('user_profile_photo_url'), isNull);
    });

    testWidgets('AppAvatarImage falls back to initials safely for oversized or invalid base64 without throwing', (tester) async {
      final oversizedBase64 = 'data:image/jpeg;base64,${'X' * 600000}';

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppAvatarImage(
              photoUrl: oversizedBase64,
              initials: 'TC',
              size: 80,
            ),
          ),
        ),
      );

      await tester.pump();
      expect(find.text('TC'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('Phase 3: Order Details Payment Verification & Banners Responsive Overflow Tests', () {
    final pendingOrder = TileOrder(
      id: 'PO_TEST_RESPONSIVE_01',
      orderReference: 'ITC-PO-TEST-001',
      userId: 'USER_RESP_01',
      customerName: 'A Very Long Business Name Tiles and Sanitaryware Corporation Limited',
      userCategory: 'Wholesaler',
      status: 'pending_payment',
      paymentStatus: 'pending_verification',
      totalAmount: 1850420.50,
      paymentSubmissionId: 'SUB-REF-2026-ITACON-MUM-8921471049281749',
      orderType: 'ready_stock',
      deliveryLocation: const {'address': 'Mumbai, Maharashtra'},
      transportRequired: true,
      remarks: 'Fast dispatch needed',
      items: const [],
      totalBoxes: 500,
      totalWeightTons: 14.5,
    );

    testWidgets('Pending payment verification card renders without overflow on 320px compact screen at 2.0x font scaling', (tester) async {
      final streamController = StreamController<TileOrder?>.broadcast();

      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 640),
              textScaler: TextScaler.linear(2.0),
              padding: EdgeInsets.only(top: 24, bottom: 48),
            ),
            child: SizedBox(
              width: 320,
              height: 640,
              child: OrderDetailsScreen(
                orderId: pendingOrder.id,
                initialOrder: pendingOrder,
                orderStream: streamController.stream,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('PAYMENT VERIFICATION IN PROGRESS'), findsOneWidget);
      expect(find.text('Submission Ref'), findsOneWidget);
      expect(find.text('SUB-REF-2026-ITACON-MUM-8921471049281749'), findsOneWidget);

      await streamController.close();
    });

    testWidgets('Payment verified & received card renders without overflow on 320px compact screen at 2.0x font scaling', (tester) async {
      final streamController = StreamController<TileOrder?>.broadcast();
      final paidOrder = pendingOrder.copyWith(
        status: 'completed',
        paymentStatus: 'paid',
        paidAmount: 1850420.50,
        paymentId: 'HDFC-UTR-8910481029471947',
        paidAt: DateTime.now(),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 640),
              textScaler: TextScaler.linear(2.0),
              padding: EdgeInsets.only(top: 24, bottom: 48),
            ),
            child: SizedBox(
              width: 320,
              height: 640,
              child: OrderDetailsScreen(
                orderId: paidOrder.id,
                initialOrder: paidOrder,
                orderStream: streamController.stream,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('PAYMENT VERIFIED & RECEIVED'), findsOneWidget);

      await streamController.close();
    });
  });
}
