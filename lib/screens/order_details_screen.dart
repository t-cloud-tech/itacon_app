import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../utils/file_io_helper.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:cloud_functions/cloud_functions.dart';
import '../utils/payment_receipt_validator.dart';
import '../theme/app_theme.dart';
import '../models/tile_order.dart';
import '../models/payment_config.dart';
import '../models/payment_submission.dart';
import '../services/firestore_service.dart';
import '../services/app_state_service.dart';
import '../services/po_download_service.dart';
import '../utils/po_calculation.dart';

class OrderDetailsScreen extends StatefulWidget {
  final String orderId;
  final TileOrder? initialOrder;
  final Stream<TileOrder?>? orderStream;
  final Stream<PaymentConfig>? paymentConfigStream;

  const OrderDetailsScreen({
    super.key,
    required this.orderId,
    this.initialOrder,
    this.orderStream,
    this.paymentConfigStream,
  });

  @override
  State<OrderDetailsScreen> createState() => _OrderDetailsScreenState();
}

class _OrderDetailsScreenState extends State<OrderDetailsScreen> {
  bool _isConfirmed = false;
  bool _isSubmitting = false;
  bool _isDownloadingPaidPo = false;
  bool _isDownloadingUnpaidPo = false;

  // Manual Bank Transfer Payment State
  bool _showAccountDetails = false;
  bool _showResubmitForm = false;
  bool _isSubmittingPayment = false;
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _utrController = TextEditingController();
  DateTime _paymentDate = DateTime.now();
  final List<ReceiptAttachmentItem> _selectedReceiptAttachments = [];

  @override
  void dispose() {
    _amountController.dispose();
    _utrController.dispose();
    super.dispose();
  }

  Future<void> _handlePickReceipt() async {
    if (_selectedReceiptAttachments.length >= PaymentReceiptValidator.maxAttachments) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Maximum 5 payment receipt attachments allowed per submission.'),
            backgroundColor: AppTheme.statusError,
          ),
        );
      }
      return;
    }

    try {
      final pickedFiles = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: PaymentReceiptValidator.allowedExtensions,
      );

      if (pickedFiles.isNotEmpty) {
        final List<ReceiptAttachmentItem> newValidItems = [];

        for (final file in pickedFiles) {
          if (_selectedReceiptAttachments.length + newValidItems.length >= PaymentReceiptValidator.maxAttachments) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Maximum 5 attachments reached. Extra files were ignored.'),
                  backgroundColor: AppTheme.accentOrange,
                ),
              );
            }
            break;
          }

          Uint8List? bytes;
          try {
            bytes = await file.readAsBytes();
          } catch (_) {
            if (file.path != null && file.path!.isNotEmpty) {
              bytes = await readFileBytes(file.path!);
            }
          }

          final int size = bytes?.length ?? (file.path != null ? ((await readFileBytes(file.path!))?.length ?? 0) : 0);

          final validation = PaymentReceiptValidator.validate(
            fileName: file.name,
            fileSizeBytes: size,
            bytes: bytes,
          );

          if (!validation.isValid) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('${file.name}: ${validation.errorMessage ?? "Invalid file."}'),
                  backgroundColor: AppTheme.statusError,
                ),
              );
            }
            continue;
          }

          final bool isDuplicate = _selectedReceiptAttachments.any((a) => a.name == file.name && a.sizeBytes == size) ||
              newValidItems.any((a) => a.name == file.name && a.sizeBytes == size);

          if (!isDuplicate) {
            newValidItems.add(
              ReceiptAttachmentItem(
                name: file.name,
                sizeBytes: size,
                bytes: bytes,
                path: file.path,
              ),
            );
          }
        }

        if (newValidItems.isNotEmpty) {
          setState(() {
            _selectedReceiptAttachments.addAll(newValidItems);
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to select payment receipt: $e'),
            backgroundColor: AppTheme.statusError,
          ),
        );
      }
    }
  }

  void _handleRemoveReceiptAt(int index) {
    if (index >= 0 && index < _selectedReceiptAttachments.length) {
      setState(() {
        _selectedReceiptAttachments.removeAt(index);
      });
    }
  }

  Future<void> _handleSubmitPaymentProof(TileOrder order) async {
    if (_isSubmittingPayment) return;

    final enteredAmount = double.tryParse(_amountController.text.trim()) ?? 0.0;
    final expectedAmount = order.totalAmount;

    final enteredPaise = (enteredAmount * 100).round();
    final expectedPaise = (expectedAmount * 100).round();

    // Strict validation: submittedAmount must equal expectedAmount at paise precision
    if (enteredPaise != expectedPaise) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Payment amount must match the final order amount exactly (₹${expectedAmount.toStringAsFixed(2)}).',
          ),
          backgroundColor: AppTheme.statusError,
        ),
      );
      return;
    }

    final rawUtr = _utrController.text.trim();
    final normalizedUtr = PaymentSubmission.normalizeUtr(rawUtr);
    if (normalizedUtr.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid Transaction / UTR number (at least 6 characters).'),
          backgroundColor: AppTheme.statusError,
        ),
      );
      return;
    }

    if (_selectedReceiptAttachments.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please upload at least one payment receipt or screenshot.'),
          backgroundColor: AppTheme.statusError,
        ),
      );
      return;
    }

    // Validate all attachments using PaymentReceiptValidator
    final validation = PaymentReceiptValidator.validateAttachments(_selectedReceiptAttachments);
    if (!validation.isValid) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(validation.errorMessage ?? 'Invalid payment receipt file.'),
            backgroundColor: AppTheme.statusError,
          ),
        );
      }
      return;
    }

    setState(() => _isSubmittingPayment = true);

    try {
      // 1. Generate deterministic submission ID tied directly to order
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final submissionId = 'sub_${order.id}_$timestamp';

      final List<String> storagePaths = [];

      // 2. Upload all attachments (up to 5) to the single deterministic submission folder in Firebase Storage
      for (int i = 0; i < _selectedReceiptAttachments.length; i++) {
        final attachment = _selectedReceiptAttachments[i];
        final safeExt = attachment.normalizedExtension;
        final mimeType = attachment.contentType;

        // Deterministic filename: index 0 is receipt.<ext>, additional files are receipt_<i>.<ext>
        // All attachments reside in the exact same submission directory: payment_proofs/<orderId>/<submissionId>/
        final fileName = i == 0 ? 'receipt.$safeExt' : 'receipt_$i.$safeExt';
        final storagePath = 'payment_proofs/${order.id}/$submissionId/$fileName';
        storagePaths.add(storagePath);

        final storageRef = FirebaseStorage.instance.ref().child(storagePath);
        final fileBytes = attachment.bytes ??
            (attachment.path != null ? (await readFileBytes(attachment.path!) ?? Uint8List(0)) : Uint8List(0));

        await storageRef.putData(
          fileBytes,
          SettableMetadata(
            contentType: mimeType,
            customMetadata: {
              'orderId': order.id,
              'submissionId': submissionId,
              'orderRef': order.orderReference,
              'attachmentIndex': '$i',
              'totalAttachments': '${_selectedReceiptAttachments.length}',
              'fileName': attachment.name,
            },
          ),
        );
      }

      // 3. Invoke secure callable via FirestoreService with all attachment paths
      await FirestoreService.instance.submitPaymentProof(
        orderId: order.id,
        submittedAmount: enteredAmount,
        utrNumber: rawUtr,
        paymentDate: _paymentDate,
        proofStoragePath: storagePaths.first,
        proofStoragePaths: storagePaths,
      );

      if (mounted) {
        setState(() {
          _selectedReceiptAttachments.clear();
          _amountController.clear();
          _utrController.clear();
          _showResubmitForm = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Payment details submitted successfully! Awaiting verification.'),
            backgroundColor: AppTheme.statusSuccess,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        String errorMsg = e.toString();
        if (errorMsg.startsWith('Exception: ')) {
          errorMsg = errorMsg.substring(11);
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Payment submission failed: $errorMsg'),
            backgroundColor: AppTheme.statusError,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmittingPayment = false);
    }
  }

  Future<void> _handleConfirmOrder(TileOrder order) async {
    if (!_isConfirmed || _isSubmitting) return;

    setState(() => _isSubmitting = true);
    try {
      final userId = AppStateService.instance.currentUserProfile.userId;
      await FirestoreService.instance.confirmOrder(
        orderId: order.id,
        userId: userId,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('🎉 Purchase Order Confirmed! PDF generation in progress...'),
            backgroundColor: AppTheme.statusSuccess,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to confirm order: $e'),
            backgroundColor: AppTheme.statusError,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _handleRejectOrder(TileOrder order) async {
    if (_isSubmitting) return;

    setState(() => _isSubmitting = true);
    try {
      final userId = AppStateService.instance.currentUserProfile.userId;
      await FirestoreService.instance.rejectOrder(
        orderId: order.id,
        userId: userId,
        reason: 'Customer declined quotation via Order Details screen.',
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Quotation estimate declined.'),
            backgroundColor: AppTheme.statusError,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to reject order: $e'),
            backgroundColor: AppTheme.statusError,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _handleDownloadPaidPo(TileOrder order) async {
    if (_isDownloadingPaidPo) return;

    // 1. Authoritative verification check
    final bool isAuthoritativelyPaid = (order.paymentStatus?.toLowerCase() == 'paid' || order.isPaid) &&
        ((order.paidAmount != null && order.paidAmount! > 0) ||
         (order.paymentId != null && order.paymentId!.isNotEmpty) ||
         order.paidAt != null ||
         order.status.toLowerCase() == 'processing' ||
         order.status.toLowerCase() == 'completed');

    if (!isAuthoritativelyPaid) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Payment verification is required before downloading the Paid PO.'),
            backgroundColor: AppTheme.statusError,
          ),
        );
      }
      return;
    }

    // 2. Customer authorization check - ensure customer can only access their own PO
    String currentUserId = '';
    try {
      currentUserId = FirebaseAuth.instance.currentUser?.uid ?? '';
    } catch (_) {}
    if (currentUserId.isEmpty) {
      currentUserId = AppStateService.instance.currentUserProfile.userId;
    }

    final bool isOwner = currentUserId.isNotEmpty &&
        (order.userId == currentUserId || order.customerId == currentUserId);
    final String userRole = AppStateService.instance.currentUserProfile.role.toLowerCase();
    final bool isStaffUser = userRole == 'admin' || userRole == 'manager' || userRole == 'salesperson' || userRole == 'staff';

    if (!isOwner && !isStaffUser && currentUserId.isNotEmpty && order.userId.isNotEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Access Denied: You may only download PO documents for your own account.'),
            backgroundColor: AppTheme.statusError,
          ),
        );
      }
      return;
    }

    final bool isStillPreparing = order.isPaidPoGenerating ||
        (order.paidPoDocumentPath == null || order.paidPoDocumentPath!.isEmpty);

    if (isStillPreparing && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
              ),
              SizedBox(width: 14),
              Expanded(child: Text('Preparing your PO...')),
            ],
          ),
          backgroundColor: AppTheme.primaryNavy,
          duration: Duration(seconds: 4),
        ),
      );
    }

    setState(() => _isDownloadingPaidPo = true);

    try {
      String downloadUrl = '';
      HttpsCallable? callable;
      try {
        callable = FirebaseFunctions.instanceFor(region: 'us-central1')
            .httpsCallable('getPaidPoDownloadUrlCallable');
      } catch (initErr) {
        debugPrint('[OrderDetailsScreen] FirebaseFunctions init error: $initErr');
      }

      if (callable == null) {
        if (isStillPreparing) {
          return;
        }
        throw Exception('Firebase Functions is not initialized.');
      }

      try {
        final res = await callable.call({'orderId': order.id});
        if (res.data != null && res.data['downloadUrl'] != null) {
          downloadUrl = res.data['downloadUrl'].toString();
        }
      } catch (fnErr) {
        debugPrint('[OrderDetailsScreen] Initial download URL fetch: $fnErr');
      }

      // If document is still being generated by background trigger, auto-retry for up to 30s
      if (downloadUrl.isEmpty) {
        if (!isStillPreparing && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Row(
                children: [
                  SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  ),
                  SizedBox(width: 14),
                  Expanded(child: Text('Preparing your PO...')),
                ],
              ),
              backgroundColor: AppTheme.primaryNavy,
              duration: Duration(seconds: 4),
            ),
          );
        }

        final stopwatch = Stopwatch()..start();
        while (stopwatch.elapsedMilliseconds < 30000 && downloadUrl.isEmpty && mounted) {
          await Future.delayed(const Duration(seconds: 3));
          try {
            final res = await callable.call({'orderId': order.id});
            if (res.data != null && res.data['downloadUrl'] != null) {
              downloadUrl = res.data['downloadUrl'].toString();
              break;
            }
          } catch (_) {}
        }
      }

      if (downloadUrl.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Please try again in a minute'),
              backgroundColor: AppTheme.statusError,
              duration: const Duration(seconds: 6),
              action: SnackBarAction(
                label: 'Retry',
                textColor: Colors.white,
                onPressed: () => _handleDownloadPaidPo(order),
              ),
            ),
          );
        }
        return;
      }

      // Download file bytes inside the app and save to phone storage
      final poRef = (order.orderReference.isNotEmpty ? order.orderReference : order.id)
          .replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
      final fileName = '${poRef}_PAID.pdf';

      final bytes = await PoDownloadService.downloadBytes(downloadUrl);
      final savedFile = await PoDownloadService.savePdf(bytes: bytes, fileName: fileName);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('PO saved to Downloads'),
            backgroundColor: AppTheme.primaryNavy,
            duration: const Duration(seconds: 8),
            action: SnackBarAction(
              label: 'Open',
              textColor: AppTheme.accentOrange,
              onPressed: () => PoDownloadService.openPdf(uri: savedFile.uri, path: savedFile.path),
            ),
          ),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to download Paid PO: $err'),
            backgroundColor: AppTheme.statusError,
            action: SnackBarAction(
              label: 'Retry',
              textColor: Colors.white,
              onPressed: () => _handleDownloadPaidPo(order),
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isDownloadingPaidPo = false);
      }
    }
  }

  Future<void> _handleDownloadUnpaidPo(TileOrder order) async {
    if (_isDownloadingUnpaidPo) return;

    // Customer authorization check - ensure customer can only access their own PO
    String currentUserId = '';
    try {
      currentUserId = FirebaseAuth.instance.currentUser?.uid ?? '';
    } catch (_) {}
    if (currentUserId.isEmpty) {
      currentUserId = AppStateService.instance.currentUserProfile.userId;
    }

    final bool isOwner = currentUserId.isNotEmpty &&
        (order.userId == currentUserId || order.customerId == currentUserId);
    final String userRole = AppStateService.instance.currentUserProfile.role.toLowerCase();
    final bool isStaffUser = userRole == 'admin' || userRole == 'manager' || userRole == 'salesperson' || userRole == 'staff';

    if (!isOwner && !isStaffUser && currentUserId.isNotEmpty && order.userId.isNotEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Access Denied: You may only download PO documents for your own account.'),
            backgroundColor: AppTheme.statusError,
          ),
        );
      }
      return;
    }

    setState(() => _isDownloadingUnpaidPo = true);

    try {
      final callable = FirebaseFunctions.instanceFor(region: 'us-central1')
          .httpsCallable('generateUnpaidPoPdf');
      final res = await callable.call({'orderId': order.id});

      final downloadUrl = res.data?['downloadUrl']?.toString() ?? '';
      if (downloadUrl.isEmpty) {
        throw Exception('Failed to generate Unpaid PO document URL from factory system.');
      }

      final poRef = (order.orderReference.isNotEmpty ? order.orderReference : order.id)
          .replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
      final fileName = '${poRef}_UNPAID.pdf';

      final bytes = await PoDownloadService.downloadBytes(downloadUrl);
      final savedFile = await PoDownloadService.savePdf(bytes: bytes, fileName: fileName);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('PO saved to Downloads'),
            backgroundColor: AppTheme.primaryNavy,
            duration: const Duration(seconds: 8),
            action: SnackBarAction(
              label: 'Open',
              textColor: AppTheme.accentOrange,
              onPressed: () => PoDownloadService.openPdf(uri: savedFile.uri, path: savedFile.path),
            ),
          ),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to download Official PO: $err'),
            backgroundColor: AppTheme.statusError,
            action: SnackBarAction(
              label: 'Retry',
              textColor: Colors.white,
              onPressed: () => _handleDownloadUnpaidPo(order),
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isDownloadingUnpaidPo = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<TileOrder?>(
      stream: widget.orderStream ?? FirestoreService.instance.getOrderStream(widget.orderId),
      initialData: widget.initialOrder,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          debugPrint('[OrderDetailsScreen] Real-time stream error for order ${widget.orderId}: ${snapshot.error}');
        }

        final order = snapshot.data ?? widget.initialOrder;

        if (snapshot.connectionState == ConnectionState.waiting && order == null) {
          return Scaffold(
            appBar: AppBar(
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: AppTheme.primaryNavy),
                tooltip: 'Back',
                onPressed: () => Navigator.maybePop(context),
              ),
              title: const Text('Order Details'),
            ),
            body: const SafeArea(
              top: false,
              child: Center(child: CircularProgressIndicator(color: AppTheme.primaryNavy)),
            ),
          );
        }

        if (order == null) {
          return Scaffold(
            appBar: AppBar(
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: AppTheme.primaryNavy),
                tooltip: 'Back',
                onPressed: () => Navigator.maybePop(context),
              ),
              title: const Text('Order Details'),
            ),
            body: SafeArea(
              top: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.receipt_long_outlined, size: 54, color: AppTheme.textSubtle),
                      const SizedBox(height: 16),
                      const Text(
                        'PO Details Unavailable',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textDark),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'The requested order details could not be retrieved at this time.\nPlease check your connection or contact your salesperson.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: AppTheme.textSubtle),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }

        final bool isPaymentPaid = order.isPaid || order.paymentStatus?.toLowerCase() == 'paid';
        final bool isPaymentPending = order.isPaymentPendingVerification || order.paymentStatus?.toLowerCase() == 'pending_verification';
        final bool isPaymentRejected = order.isPaymentRejected || order.paymentStatus?.toLowerCase() == 'rejected';

        final String sLower = order.status.toLowerCase();
        final String dsLower = order.dispatchStatus.toLowerCase();

        final bool isDeliveredOrCompleted = sLower == 'completed' || sLower == 'delivered' || dsLower == 'delivered';
        final bool isDispatched = sLower == 'dispatched' || dsLower == 'dispatched';
        final bool isOrderRejected = sLower == 'rejected' || sLower == 'declined' || sLower == 'cancelled';

        final bool isPendingAdminApproval = !isPaymentPaid && !isPaymentPending && !isDeliveredOrCompleted && (
            sLower == 'pending_admin_approval' ||
            sLower == 'pending_manager_approval' ||
            order.priceApprovalStatus == 'pending_manager_approval' ||
            order.priceApprovalStatus == 'pending_admin_approval');

        final bool isPendingSalesReview = !isPaymentPaid && !isPaymentPending && !isDeliveredOrCompleted &&
            (sLower == 'pending_salesperson_review');

        final bool isRateQuoted = !isPaymentPaid && !isPaymentPending && !isDeliveredOrCompleted && !isPendingAdminApproval && !isPendingSalesReview &&
            (order.isRateQuotedStage || sLower == 'rate_quoted' || sLower == 'quoted' || sLower == 'rates_quoted' || sLower == 'sent_to_customer');

        final bool isConfirmedOrder = isPaymentPaid || isPaymentPending || isPaymentRejected || isDeliveredOrCompleted || isDispatched ||
            order.isConfirmedStage || sLower == 'confirmed' || sLower == 'approved' || sLower == 'user_confirmed' || sLower == 'processing';

        final bool isPendingRate = !isPaymentPaid && !isPaymentPending && !isPaymentRejected && !isDeliveredOrCompleted && !isDispatched &&
            !isRateQuoted && !isOrderRejected && !isConfirmedOrder &&
            (order.isPendingQuoteStage || sLower == 'pending_rate' || sLower == 'awaiting_quote' || sLower.isEmpty);

        return Scaffold(
          backgroundColor: AppTheme.backgroundColor,
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_rounded, color: AppTheme.primaryNavy),
              tooltip: 'Back',
              onPressed: () => Navigator.maybePop(context),
            ),
            title: Text('PO Details (${order.orderReference})'),
            elevation: 0,
          ),
          body: SafeArea(
            top: false,
            child: ResponsiveConstraint(
              maxContentWidth: 720,
              child: RefreshIndicator(
                onRefresh: () async {
                  setState(() {});
                  await Future.delayed(const Duration(milliseconds: 500));
                },
                color: AppTheme.primaryNavy,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (snapshot.hasError) ...[
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.amber.shade300),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.wifi_off_rounded, color: Colors.amber.shade800, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Live sync paused. Displaying local PO quotation details.',
                              style: TextStyle(fontSize: 11, color: Colors.amber.shade900, fontWeight: FontWeight.w500),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Top Status Alert Banner
                  _buildStatusBanner(
                    order,
                    isPendingRate: isPendingRate,
                    isPendingAdminApproval: isPendingAdminApproval,
                    isPendingSalesReview: isPendingSalesReview,
                    isRateQuoted: isRateQuoted,
                    isConfirmed: isConfirmedOrder,
                    isRejected: isOrderRejected,
                    isPaymentPaid: isPaymentPaid,
                    isPaymentPending: isPaymentPending,
                    isPaymentRejected: isPaymentRejected,
                    isDeliveredOrCompleted: isDeliveredOrCompleted,
                    isDispatched: isDispatched,
                  ),
                  const SizedBox(height: 16),

                  // Order Summary Header Card
                  _buildHeaderCard(order),
                  const SizedBox(height: 16),

                  // Ordered Items Breakdown Table
                  const Text(
                    'Ordered Items Breakdown',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textDark,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _buildItemsTable(order, isPendingRate || isPendingAdminApproval),
                  const SizedBox(height: 16),

                  // Financial Summary Card (Excluding Freight)
                  if (!isPendingRate && !isPendingAdminApproval) ...[
                    _buildFinancialSummaryCard(order),
                    const SizedBox(height: 20),
                  ],

                  // Dynamic Action Block at Bottom
                  _buildDynamicActionBlock(
                    order,
                    isPendingRate: isPendingRate,
                    isPendingAdminApproval: isPendingAdminApproval,
                    isPendingSalesReview: isPendingSalesReview,
                    isRateQuoted: isRateQuoted,
                    isConfirmed: isConfirmedOrder,
                    isRejected: isOrderRejected,
                    isPaymentPaid: isPaymentPaid,
                    isPaymentPending: isPaymentPending,
                    isPaymentRejected: isPaymentRejected,
                    isDeliveredOrCompleted: isDeliveredOrCompleted,
                  ),
                ],
              ),
            ),
          ),
          ),
          ),
        );
      },
    );
  }

  Widget _buildStatusBanner(
    TileOrder order, {
    bool? isPendingRate,
    bool? isPendingAdminApproval,
    bool? isPendingSalesReview,
    bool? isRateQuoted,
    bool? isConfirmed,
    bool? isRejected,
    bool? isPaymentPaid,
    bool? isPaymentPending,
    bool? isPaymentRejected,
    bool? isDeliveredOrCompleted,
    bool? isDispatched,
  }) {
    final sLower = order.status.toLowerCase();
    final dsLower = order.dispatchStatus.toLowerCase();

    final bool resolvedPaymentPaid = isPaymentPaid ?? (order.isPaid || order.paymentStatus?.toLowerCase() == 'paid');
    final bool resolvedPaymentPending = isPaymentPending ?? (order.isPaymentPendingVerification || order.paymentStatus?.toLowerCase() == 'pending_verification');
    final bool resolvedPaymentRejected = isPaymentRejected ?? (order.isPaymentRejected || order.paymentStatus?.toLowerCase() == 'rejected');

    final bool resolvedDeliveredOrCompleted = isDeliveredOrCompleted ?? (sLower == 'completed' || sLower == 'delivered' || dsLower == 'delivered');
    final bool resolvedDispatched = isDispatched ?? (sLower == 'dispatched' || dsLower == 'dispatched');
    final bool resolvedOrderRejected = isRejected ?? (sLower == 'rejected' || sLower == 'declined' || sLower == 'cancelled');

    final bool resolvedPendingAdminApproval = isPendingAdminApproval ?? (!resolvedPaymentPaid && !resolvedPaymentPending && !resolvedDeliveredOrCompleted && (
        sLower == 'pending_admin_approval' ||
        sLower == 'pending_manager_approval' ||
        order.priceApprovalStatus == 'pending_manager_approval' ||
        order.priceApprovalStatus == 'pending_admin_approval'));

    final bool resolvedPendingSalesReview = isPendingSalesReview ?? (!resolvedPaymentPaid && !resolvedPaymentPending && !resolvedDeliveredOrCompleted &&
        (sLower == 'pending_salesperson_review'));

    final bool resolvedRateQuoted = isRateQuoted ?? (!resolvedPaymentPaid && !resolvedPaymentPending && !resolvedDeliveredOrCompleted &&
        (order.isRateQuotedStage || sLower == 'rate_quoted' || sLower == 'quoted' || sLower == 'rates_quoted' || sLower == 'sent_to_customer'));

    final bool resolvedConfirmed = isConfirmed ?? (
        resolvedPaymentPaid || resolvedPaymentPending || resolvedPaymentRejected || resolvedDeliveredOrCompleted || resolvedDispatched ||
        order.isConfirmedStage || sLower == 'confirmed' || sLower == 'approved' || sLower == 'user_confirmed' || sLower == 'processing');

    Color bannerBg;
    Color bannerBorder;
    IconData bannerIcon;
    String bannerTitle;
    String bannerDesc;

    if (resolvedDeliveredOrCompleted) {
      bannerBg = AppTheme.statusSuccess.withValues(alpha: 0.12);
      bannerBorder = AppTheme.statusSuccess;
      bannerIcon = Icons.task_alt_rounded;
      bannerTitle = 'Order Completed';
      bannerDesc = 'This order has been fulfilled, delivered, and payment has been verified.';
    } else if (resolvedDispatched) {
      bannerBg = Colors.teal.withValues(alpha: 0.12);
      bannerBorder = Colors.teal;
      bannerIcon = Icons.local_shipping_rounded;
      bannerTitle = 'Order Dispatched';
      bannerDesc = 'Your order has been dispatched from our Morbi factory works and is on its way.';
    } else if (resolvedPaymentPaid) {
      bannerBg = AppTheme.statusSuccess.withValues(alpha: 0.12);
      bannerBorder = AppTheme.statusSuccess;
      bannerIcon = Icons.verified_rounded;
      bannerTitle = 'Payment Completed — In Production';
      bannerDesc = 'Your payment has been verified and your order is being processed.';
    } else if (resolvedPaymentPending) {
      bannerBg = AppTheme.primaryNavy.withValues(alpha: 0.12);
      bannerBorder = AppTheme.primaryNavy;
      bannerIcon = Icons.pending_actions_rounded;
      bannerTitle = 'Payment Verification in Progress';
      bannerDesc = 'Your bank transfer details have been submitted and are being verified by our accounts team.';
    } else if (resolvedPaymentRejected) {
      bannerBg = AppTheme.statusError.withValues(alpha: 0.12);
      bannerBorder = AppTheme.statusError;
      bannerIcon = Icons.error_outline_rounded;
      bannerTitle = 'Payment Verification Failed';
      bannerDesc = (order.rejectionReason != null && order.rejectionReason!.isNotEmpty)
          ? 'Reason: ${order.rejectionReason}'
          : 'Payment verification failed. Please review the details and resubmit proof.';
    } else if (resolvedOrderRejected) {
      bannerBg = AppTheme.statusError.withValues(alpha: 0.12);
      bannerBorder = AppTheme.statusError;
      bannerIcon = Icons.cancel_rounded;
      bannerTitle = 'Quotation Estimate Declined';
      bannerDesc = 'You have declined today\'s quoted rates for this Purchase Order.';
    } else if (resolvedPendingAdminApproval) {
      bannerBg = const Color(0xFFFEF3C7);
      bannerBorder = const Color(0xFFD97706);
      bannerIcon = Icons.hourglass_bottom_rounded;
      bannerTitle = 'Awaiting Admin Confirmation';
      bannerDesc = 'Your salesperson has quoted special rates (< ₹26.50/sq.ft). This Purchase Order is awaiting head-office Admin confirmation before it can be confirmed.';
    } else if (resolvedPendingSalesReview) {
      bannerBg = const Color(0xFFFEF3C7);
      bannerBorder = const Color(0xFFD97706);
      bannerIcon = Icons.rate_review_rounded;
      bannerTitle = 'Under Salesperson Review';
      bannerDesc = 'Admin confirmation has been processed. Your assigned salesperson is reviewing the rate details and will release the quote to your app shortly.';
    } else if (resolvedRateQuoted) {
      bannerBg = AppTheme.accentOrange.withValues(alpha: 0.12);
      bannerBorder = AppTheme.accentOrange;
      bannerIcon = Icons.mark_email_unread_rounded;
      bannerTitle = "Today's Quoted Rates Received";
      bannerDesc = 'Please review today\'s quoted rates and confirm to finalize your Purchase Order.';
    } else if (resolvedConfirmed) {
      bannerBg = AppTheme.accentOrange.withValues(alpha: 0.12);
      bannerBorder = AppTheme.accentOrange;
      bannerIcon = Icons.account_balance_wallet_outlined;
      bannerTitle = 'Payment Required (PO Approved)';
      bannerDesc = 'Please complete the bank transfer below to proceed with order dispatch.';
    } else {
      bannerBg = AppTheme.primaryNavy.withValues(alpha: 0.1);
      bannerBorder = AppTheme.primaryNavy;
      bannerIcon = Icons.hourglass_top_rounded;
      bannerTitle = 'Rate Approval in Progress';
      bannerDesc = 'Your assigned salesperson is currently quoting today\'s factory rates.';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bannerBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: bannerBorder, width: 1),
      ),
      child: Row(
        children: [
          Icon(bannerIcon, color: bannerBorder, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  bannerTitle,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: bannerBorder,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  bannerDesc,
                  style: const TextStyle(fontSize: 12, color: AppTheme.textSubtle),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderCard(TileOrder order) {
    final createdDateStr = order.createdAt != null
        ? '${order.createdAt!.day}/${order.createdAt!.month}/${order.createdAt!.year}'
        : 'Today';

    return Container(
      decoration: AppTheme.luxuryCardDecoration,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  '#${order.orderReference}',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.primaryNavy,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  'Date: $createdDateStr',
                  style: const TextStyle(fontSize: 12, color: AppTheme.textSubtle),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
          const Divider(height: 20),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on_outlined, size: 18, color: AppTheme.primaryNavy),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Delivery Address: ${order.deliveryAddress.isNotEmpty ? order.deliveryAddress : 'Site Address'}',
                  style: const TextStyle(fontSize: 12, color: AppTheme.textDark, fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Total Boxes', style: TextStyle(fontSize: 11, color: AppTheme.textSubtle)),
                    Text('${order.totalBoxes} Boxes', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('Total Weight (Tonnes)', style: TextStyle(fontSize: 11, color: AppTheme.textSubtle), textAlign: TextAlign.right),
                    Text('${order.totalWeightTons.toStringAsFixed(2)} Tonnes', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13), textAlign: TextAlign.right),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildItemsTable(TileOrder order, bool isPendingRate) {
    return Container(
      decoration: AppTheme.luxuryCardDecoration,
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        itemCount: order.items.length,
        separatorBuilder: (_, _) => const Divider(height: 1, color: AppTheme.borderSubtle),
        itemBuilder: (context, index) {
          final item = order.items[index];

          return Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.terrain_rounded, color: AppTheme.primaryNavy, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.productName,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textDark,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${item.size} • ${item.surface} • ${item.quantityBoxes} Boxes (${item.quantitySqFt.toStringAsFixed(1)} sq.ft)',
                        style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (isPendingRate)
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.accentOrange.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'Rate Approval in Progress',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.accentOrange,
                        ),
                      ),
                    ),
                  )
                else
                  Builder(
                    builder: (context) {
                      double displayUnitPrice = item.unitPrice ?? 0.0;
                      double displayLineTotal = item.lineTotal ?? 0.0;
                      if (displayUnitPrice <= 0.0) {
                        if (displayLineTotal > 0.0 && item.quantitySqFt > 0) {
                          displayUnitPrice = displayLineTotal / item.quantitySqFt;
                        } else if (order.pricePerSqft != null && order.pricePerSqft! > 0) {
                          displayUnitPrice = order.pricePerSqft!;
                          displayLineTotal = item.quantitySqFt * displayUnitPrice;
                        } else if (order.subtotal > 0) {
                          final totalSqFt = order.items.fold<double>(0.0, (sum, i) => sum + i.quantitySqFt);
                          if (totalSqFt > 0) {
                            displayUnitPrice = order.subtotal / totalSqFt;
                            displayLineTotal = item.quantitySqFt * displayUnitPrice;
                          }
                        }
                      }
                      if (displayLineTotal <= 0.0 && displayUnitPrice > 0.0) {
                        displayLineTotal = (item.size.toLowerCase().contains('adhesive') || item.productName.toLowerCase().contains('adhesive') || item.unit == 'bag')
                            ? item.quantityBoxes * displayUnitPrice
                            : item.quantitySqFt * displayUnitPrice;
                      }
                      if (order.isMrpLinked && item.mrp != null) {
                        displayUnitPrice = item.mrp!;
                        displayLineTotal = item.quantitySqFt * item.mrp!;
                      }

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            (item.size.toLowerCase().contains('adhesive') || item.productName.toLowerCase().contains('adhesive') || item.unit == 'bag')
                                ? '₹${displayUnitPrice.toStringAsFixed(2)}/bag'
                                : '₹${displayUnitPrice.toStringAsFixed(2)}/sq ft',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.accentOrange,
                            ),
                          ),
                          Text(
                            'Total: ₹${displayLineTotal.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.primaryNavy,
                            ),
                          ),
                        ],
                      );
                    },
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildFinancialSummaryCard(TileOrder order) {
    final calc = PoCalculation.calculate(order);
    return Container(
      decoration: AppTheme.luxuryCardDecoration,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildSummaryRow('Basic amount', calc.basicAmount),
          _buildSummaryRow('Insurance', calc.insuranceAmount),
          _buildSummaryRow('Basic + insurance', calc.basicPlusInsurance),
          _buildSummaryRow('18% GST', calc.taxAmount),
          const Divider(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Flexible(
                child: Text.rich(
                  TextSpan(
                    text: 'Estimated total',
                    children: [
                      WidgetSpan(
                        alignment: PlaceholderAlignment.top,
                        child: Text('*', style: TextStyle(fontSize: 11)),
                      ),
                    ],
                  ),
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.primaryNavy,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '₹${calc.totalAmount.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.accentOrange,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              '*Premium packaging charges: ₹${calc.packagingCharges.toStringAsFixed(2)}',
              style: const TextStyle(fontSize: 10, color: AppTheme.textSubtle),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, double amount, {bool isDiscount = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(child: Text(label, style: const TextStyle(fontSize: 13, color: AppTheme.textSubtle))),
          const SizedBox(width: 8),
          Text(
            '${isDiscount ? '-' : ''}₹${amount.abs().toStringAsFixed(2)}',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isDiscount ? AppTheme.statusSuccess : AppTheme.textDark,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDynamicActionBlock(
    TileOrder order, {
    bool? isPendingRate,
    bool? isPendingAdminApproval,
    bool? isPendingSalesReview,
    bool? isRateQuoted,
    bool? isConfirmed,
    bool? isRejected,
    bool? isPaymentPaid,
    bool? isPaymentPending,
    bool? isPaymentRejected,
    bool? isDeliveredOrCompleted,
  }) {
    final sLower = order.status.toLowerCase();
    final dsLower = order.dispatchStatus.toLowerCase();

    final bool resolvedPaymentPaid = isPaymentPaid ?? (order.isPaid || order.paymentStatus?.toLowerCase() == 'paid');
    final bool resolvedPaymentPending = isPaymentPending ?? (order.isPaymentPendingVerification || order.paymentStatus?.toLowerCase() == 'pending_verification');
    final bool resolvedPaymentRejected = isPaymentRejected ?? (order.isPaymentRejected || order.paymentStatus?.toLowerCase() == 'rejected');

    final bool resolvedDeliveredOrCompleted = isDeliveredOrCompleted ?? (sLower == 'completed' || sLower == 'delivered' || dsLower == 'delivered');
    final bool resolvedDispatched = sLower == 'dispatched' || dsLower == 'dispatched';
    final bool resolvedOrderRejected = isRejected ?? (sLower == 'rejected' || sLower == 'declined' || sLower == 'cancelled');

    final bool resolvedPendingAdminApproval = isPendingAdminApproval ?? (!resolvedPaymentPaid && !resolvedPaymentPending && !resolvedDeliveredOrCompleted && (
        sLower == 'pending_admin_approval' ||
        sLower == 'pending_manager_approval' ||
        order.priceApprovalStatus == 'pending_manager_approval' ||
        order.priceApprovalStatus == 'pending_admin_approval'));

    final bool resolvedPendingSalesReview = isPendingSalesReview ?? (!resolvedPaymentPaid && !resolvedPaymentPending && !resolvedDeliveredOrCompleted &&
        (sLower == 'pending_salesperson_review'));

    final bool resolvedRateQuoted = isRateQuoted ?? (!resolvedPaymentPaid && !resolvedPaymentPending && !resolvedDeliveredOrCompleted &&
        (order.isRateQuotedStage || sLower == 'rate_quoted' || sLower == 'quoted' || sLower == 'rates_quoted' || sLower == 'sent_to_customer'));

    final bool resolvedConfirmed = isConfirmed ?? (
        resolvedPaymentPaid || resolvedPaymentPending || resolvedPaymentRejected || resolvedDeliveredOrCompleted || resolvedDispatched ||
        order.isConfirmedStage || sLower == 'confirmed' || sLower == 'approved' || sLower == 'user_confirmed' || sLower == 'processing');

    final bool resolvedPendingRate = isPendingRate ?? (
        !resolvedPaymentPaid && !resolvedPaymentPending && !resolvedPaymentRejected && !resolvedDeliveredOrCompleted && !resolvedDispatched &&
        !resolvedRateQuoted && !resolvedOrderRejected && !resolvedConfirmed &&
        (order.isPendingQuoteStage || sLower == 'pending_rate' || sLower == 'awaiting_quote' || sLower.isEmpty));

    if (resolvedPendingRate) {
      final bool isPriceApproval = order.status == 'pending_manager_approval' || order.priceApprovalStatus == 'pending_manager_approval';
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.borderSubtle),
        ),
        child: Text(
          isPriceApproval
              ? 'Special discount request has been submitted to factory management for review. Quoted rates will appear here once approved.'
              : 'Your assigned salesperson is currently quoting today\'s factory rates. You will be notified once ready.',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 13, color: AppTheme.textSubtle, fontWeight: FontWeight.w500),
        ),
      );
    }

    if (resolvedPendingAdminApproval || resolvedPendingSalesReview) {
      final bool isReviewDone = resolvedPendingSalesReview;
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFD97706).withValues(alpha: 0.4)),
        ),
        child: Column(
          children: [
            Icon(
              isReviewDone ? Icons.rate_review_rounded : Icons.lock_clock_rounded,
              color: const Color(0xFFD97706),
              size: 32,
            ),
            const SizedBox(height: 8),
            Text(
              isReviewDone ? 'Awaiting Salesperson Release' : 'Awaiting Management Confirmation',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy),
            ),
            const SizedBox(height: 4),
            Text(
              isReviewDone
                  ? 'Admin confirmation has been processed. Your assigned salesperson is reviewing the final rate details and will release the quote to your app shortly.'
                  : 'This Purchase Order includes special rates (< ₹26.50/sq.ft) and is undergoing head-office administrative confirmation. Updates are routed to your assigned salesperson who will finalize and release the quote to your app.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: AppTheme.textSubtle, height: 1.4),
            ),
          ],
        ),
      );
    }

    if (resolvedRateQuoted) {
      return Column(
        children: [
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.borderSubtle),
            ),
            child: Material(
              color: Colors.transparent,
              child: CheckboxListTile(
                value: _isConfirmed,
                activeColor: AppTheme.primaryNavy,
                title: const Text(
                  'I agree with today\'s quoted rates and terms for this Purchase Order.',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
                onChanged: (val) => setState(() => _isConfirmed = val ?? false),
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: _isConfirmed ? AppTheme.primaryNavy : Colors.grey.shade400,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: _isConfirmed && !_isSubmitting ? () => _handleConfirmOrder(order) : null,
              child: _isSubmitting
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text(
                      'Confirm & Finalize Order →',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: const BorderSide(color: AppTheme.statusError),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: !_isSubmitting ? () => _handleRejectOrder(order) : null,
              child: const Text(
                'Reject Estimate',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.statusError,
                ),
              ),
            ),
          ),
        ],
      );
    }

    if (resolvedConfirmed) {
      final String pillLabel;
      final Color pillColor;
      if (resolvedDeliveredOrCompleted) {
        pillLabel = 'Order Completed';
        pillColor = AppTheme.statusSuccess;
      } else if (resolvedPaymentPaid) {
        pillLabel = 'In Production';
        pillColor = AppTheme.statusSuccess;
      } else if (resolvedPaymentPending) {
        pillLabel = 'Payment Verification in Progress';
        pillColor = AppTheme.primaryNavy;
      } else if (resolvedPaymentRejected) {
        pillLabel = 'Payment Verification Failed';
        pillColor = AppTheme.statusError;
      } else {
        pillLabel = 'PO Approved';
        pillColor = AppTheme.statusSuccess;
      }

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: pillColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  resolvedPaymentRejected
                      ? Icons.error_outline_rounded
                      : (resolvedPaymentPending ? Icons.hourglass_top_rounded : Icons.check_circle_rounded),
                  color: pillColor,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    pillLabel,
                    textAlign: TextAlign.center,
                    softWrap: true,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: pillColor),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryNavy,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: (_isDownloadingPaidPo || _isDownloadingUnpaidPo)
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.picture_as_pdf_rounded, color: Colors.white, size: 20),
              label: Text(
                resolvedPaymentPaid ? 'Download Paid PO (PDF)' : 'Download Official PO (PDF)',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
              onPressed: (_isDownloadingPaidPo || _isDownloadingUnpaidPo)
                  ? null
                  : (resolvedPaymentPaid
                      ? () => _handleDownloadPaidPo(order)
                      : () => _handleDownloadUnpaidPo(order)),
            ),
          ),
          const SizedBox(height: 20),
          _buildPaymentSection(order),
        ],
      );
    }

    if (resolvedOrderRejected) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.statusError.withValues(alpha: 0.3)),
        ),
        child: const Column(
          children: [
            Icon(Icons.cancel_outlined, color: AppTheme.statusError, size: 28),
            SizedBox(height: 8),
            Text(
              'Quotation Estimate Declined',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.statusError),
            ),
            SizedBox(height: 4),
            Text(
              'This Purchase Order estimate has been declined. Please reach out to your assigned salesperson if you would like to request a new quotation.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppTheme.textSubtle),
            ),
          ],
        ),
      );
    }

    return Container();
  }

  Widget _buildPaymentSection(TileOrder order) {
    if (order.isPaid || order.paymentStatus?.toLowerCase() == 'paid' || order.status.toLowerCase() == 'completed' || order.status.toLowerCase() == 'delivered') {
      return _buildPaidSuccessCard(order);
    }

    if (order.isPaymentPendingVerification || order.paymentStatus?.toLowerCase() == 'pending_verification') {
      return _buildPendingVerificationCard(order);
    }

    if ((order.isPaymentRejected || order.paymentStatus?.toLowerCase() == 'rejected') && !_showResubmitForm) {
      return _buildRejectedCard(order);
    }

    return _buildPaymentDueSection(order);
  }

  Widget _buildPaidSuccessCard(TileOrder order) {
    final paidDateStr = order.paidAt != null
        ? '${order.paidAt!.day}/${order.paidAt!.month}/${order.paidAt!.year}'
        : 'Confirmed';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.statusSuccess.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.statusSuccess, width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.verified_rounded, color: AppTheme.statusSuccess, size: 24),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'PAYMENT VERIFIED & RECEIVED',
                  softWrap: true,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.statusSuccess),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildDetailRow('Paid Amount', '₹${(order.paidAmount ?? order.totalAmount).toStringAsFixed(2)}', isBold: true),
          _buildDetailRow('Payment ID / UTR', order.paymentId ?? 'Verified'),
          _buildDetailRow('Verification Date', paidDateStr),
          const SizedBox(height: 8),
          const Text(
            'Payment verified by ITACON Accounts Team. Factory processing and dispatch in progress.',
            style: TextStyle(fontSize: 12, color: AppTheme.textSubtle),
          ),
        ],
      ),
    );
  }

  Widget _buildPendingVerificationCard(TileOrder order) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.primaryNavy.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.primaryNavy, width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.hourglass_empty_rounded, color: AppTheme.primaryNavy, size: 24),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'PAYMENT VERIFICATION IN PROGRESS',
                  softWrap: true,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _buildDetailRow('Expected / Submitted Amount', '₹${order.totalAmount.toStringAsFixed(2)}', isBold: true),
          _buildDetailRow('Payment Method', 'Bank Transfer (NEFT / RTGS / IMPS)'),
          if (order.paymentSubmissionId != null)
            _buildDetailRow(
              'Submission Ref',
              order.paymentSubmissionId!,
              isCopyable: true,
              onCopy: () {
                Clipboard.setData(ClipboardData(text: order.paymentSubmissionId!));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Submission reference copied to clipboard')),
                );
              },
            ),
          const Divider(height: 20),
          const Text(
            "We've received your payment details. Our accounts team will verify the bank credit.",
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textDark),
          ),
          const SizedBox(height: 6),
          const Text(
            'Please allow up to 2-4 business hours for bank ledger reconciliation.',
            style: TextStyle(fontSize: 12, color: AppTheme.textSubtle),
          ),
        ],
      ),
    );
  }

  Widget _buildRejectedCard(TileOrder order) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.statusError.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.statusError, width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.cancel_outlined, color: AppTheme.statusError, size: 24),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'PAYMENT VERIFICATION FAILED',
                  softWrap: true,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.statusError),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Reason: ${order.rejectionReason != null && order.rejectionReason!.isNotEmpty ? order.rejectionReason : 'Bank transfer credit could not be verified with the submitted UTR.'}',
            style: const TextStyle(fontSize: 13, color: AppTheme.textDark, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.accentOrange,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              icon: const Icon(Icons.refresh_rounded, color: Colors.white, size: 18),
              label: const Text(
                'RESUBMIT PAYMENT PROOF',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              onPressed: () {
                setState(() {
                  _showResubmitForm = true;
                  _amountController.text = order.totalAmount.toStringAsFixed(2);
                });
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentDueSection(TileOrder order) {
    if (_amountController.text.isEmpty) {
      _amountController.text = order.totalAmount.toStringAsFixed(2);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Payment Required Header
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppTheme.accentOrange.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppTheme.accentOrange, width: 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.payment_rounded, color: AppTheme.accentOrange, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'PAYMENT REQUIRED',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.accentOrange),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Final Amount to Pay:', style: TextStyle(fontSize: 13, color: AppTheme.textDark)),
                  Text(
                    '₹${PoCalculation.calculate(order).totalAmount.toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppTheme.primaryNavy),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'Payment Method: Bank Transfer (NEFT / RTGS / IMPS)',
                style: TextStyle(fontSize: 12, color: AppTheme.textSubtle),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Company Bank Details Card
        StreamBuilder<PaymentConfig?>(
          stream: widget.paymentConfigStream ?? FirestoreService.instance.getPaymentConfigStream(),
          builder: (context, snapshot) {
            final config = snapshot.data ?? PaymentConfig.unavailable();

            final displayAccount = _showAccountDetails
                ? config.accountNumber
                : config.maskedAccountNumber;

            return Container(
              decoration: AppTheme.luxuryCardDecoration,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.account_balance_rounded, color: AppTheme.primaryNavy, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'COMPANY BANK DETAILS',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy),
                      ),
                    ],
                  ),
                  const Divider(height: 20),
                  _buildDetailRow('Account Holder', config.accountHolderName),
                  _buildDetailRow('Bank Name', config.bankName),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Account Number', style: TextStyle(fontSize: 12, color: AppTheme.textSubtle)),
                        Row(
                          children: [
                            Text(
                              displayAccount,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textDark),
                            ),
                            const SizedBox(width: 8),
                            InkWell(
                              onTap: () => setState(() => _showAccountDetails = !_showAccountDetails),
                              child: Text(
                                _showAccountDetails ? 'Hide' : 'Show',
                                style: const TextStyle(fontSize: 11, color: AppTheme.accentOrange, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  _buildDetailRow('IFSC Code', config.ifscCode),
                  _buildDetailRow('Branch', config.branchName),
                  _buildDetailRow('Account Type', config.accountType),
                  if (config.instructions.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        'Note: ${config.instructions}',
                        style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppTheme.textSubtle),
                      ),
                    ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: AppTheme.primaryNavy),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                          icon: const Icon(Icons.copy_rounded, size: 15, color: AppTheme.primaryNavy),
                          label: const Text('COPY A/C NO', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy)),
                          onPressed: () {
                            Clipboard.setData(ClipboardData(text: config.accountNumber));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Account Number copied to clipboard')),
                            );
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: AppTheme.primaryNavy),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                          icon: const Icon(Icons.copy_rounded, size: 15, color: AppTheme.primaryNavy),
                          label: const Text('COPY IFSC', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy)),
                          onPressed: () {
                            Clipboard.setData(ClipboardData(text: config.ifscCode));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('IFSC Code copied to clipboard')),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        ),
        const SizedBox(height: 16),

        // Submit Payment Details Form
        Container(
          decoration: AppTheme.luxuryCardDecoration,
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.receipt_long_rounded, color: AppTheme.accentOrange, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'SUBMIT PAYMENT DETAILS',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textDark),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Read-only Expected Amount
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.borderSubtle),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Expanded(
                      child: Text('Expected Amount (Read-only):', style: TextStyle(fontSize: 12, color: AppTheme.textSubtle)),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '₹${order.totalAmount.toStringAsFixed(2)}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: AppTheme.primaryNavy),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Amount Paid input
              const Text('Amount Paid (₹)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
              const SizedBox(height: 6),
              TextFormField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  prefixText: '₹ ',
                  hintText: order.totalAmount.toStringAsFixed(2),
                  helperText: 'Must match final order amount exactly',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),
              const SizedBox(height: 14),

              // UTR Number input
              const Text('Transaction / UTR Number', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
              const SizedBox(height: 6),
              TextFormField(
                controller: _utrController,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  hintText: 'e.g. 2024102912345678',
                  helperText: 'Enter bank reference / UTR number (alphanumeric)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),
              const SizedBox(height: 14),

              // Payment Date Selector
              const Text('Payment Date', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
              const SizedBox(height: 6),
              InkWell(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _paymentDate,
                    firstDate: DateTime.now().subtract(const Duration(days: 30)),
                    lastDate: DateTime.now(),
                  );
                  if (picked != null) {
                    setState(() => _paymentDate = picked);
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppTheme.borderSubtle),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${_paymentDate.day}/${_paymentDate.month}/${_paymentDate.year}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textDark),
                      ),
                      const Icon(Icons.calendar_today_rounded, size: 16, color: AppTheme.primaryNavy),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Payment Receipt / Screenshot upload
              const Text(
                'Upload Payment Receipt / Screenshot',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textDark),
              ),
              const SizedBox(height: 6),
              if (_selectedReceiptAttachments.isEmpty)
                InkWell(
                  key: const Key('select_payment_receipt_button'),
                  onTap: _handlePickReceipt,
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: AppTheme.borderSubtle,
                        style: BorderStyle.solid,
                      ),
                    ),
                    child: const Row(
                      children: [
                        Icon(
                          Icons.cloud_upload_outlined,
                          color: AppTheme.primaryNavy,
                          size: 26,
                        ),
                        SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Upload Payment Receipt / Screenshot',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.primaryNavy,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              SizedBox(height: 2),
                              Text(
                                'PDF, JPG, PNG, WEBP — Max 10 MB each',
                                style: TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                Container(
                  key: const Key('selected_payment_receipt_card'),
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.statusSuccess.withValues(alpha: 0.04),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.statusSuccess, width: 1.2),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.check_circle_rounded, color: AppTheme.statusSuccess, size: 18),
                              const SizedBox(width: 6),
                              Text(
                                'Attached Proof (${_selectedReceiptAttachments.length}/5)',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.primaryNavy,
                                ),
                              ),
                            ],
                          ),
                          if (_selectedReceiptAttachments.length < PaymentReceiptValidator.maxAttachments)
                            TextButton.icon(
                              key: const Key('add_more_receipts_button'),
                              onPressed: _isSubmittingPayment ? null : _handlePickReceipt,
                              icon: const Icon(Icons.add_circle_outline_rounded, size: 15, color: AppTheme.accentOrange),
                              label: const Text(
                                '+ Add More',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.accentOrange),
                              ),
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                            ),
                        ],
                      ),
                      const Divider(height: 14),
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _selectedReceiptAttachments.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 6),
                        itemBuilder: (context, index) {
                          final item = _selectedReceiptAttachments[index];
                          final isPdf = item.isPdf;
                          final sizeMb = (item.sizeBytes / (1024 * 1024)).toStringAsFixed(2);

                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: AppTheme.borderSubtle),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  isPdf ? Icons.picture_as_pdf_rounded : Icons.image_rounded,
                                  color: isPdf ? AppTheme.accentOrange : AppTheme.statusSuccess,
                                  size: 22,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.name,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: AppTheme.textDark,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      Text(
                                        '$sizeMb MB • ${isPdf ? "PDF Document" : "Image Proof"}',
                                        style: const TextStyle(fontSize: 10, color: AppTheme.textSubtle),
                                      ),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  key: Key('remove_receipt_button_$index'),
                                  icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppTheme.statusError),
                                  tooltip: 'Remove attachment',
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                  onPressed: _isSubmittingPayment ? null : () => _handleRemoveReceiptAt(index),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'PDF, JPG, PNG, WEBP — Max 10 MB each',
                        style: TextStyle(fontSize: 10, color: AppTheme.textSubtle),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 20),

              // Submit Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.accentOrange,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _isSubmittingPayment ? null : () => _handleSubmitPaymentProof(order),
                  child: _isSubmittingPayment
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text(
                          'SUBMIT PAYMENT DETAILS →',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                        ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDetailRow(
    String label,
    String value, {
    bool isBold = false,
    bool isCopyable = false,
    VoidCallback? onCopy,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 5,
            child: Text(
              label,
              style: const TextStyle(fontSize: 12, color: AppTheme.textSubtle),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 6,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Flexible(
                  child: SelectableText(
                    value,
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
                      color: AppTheme.textDark,
                    ),
                  ),
                ),
                if (isCopyable && onCopy != null) ...[
                  const SizedBox(width: 6),
                  InkWell(
                    onTap: onCopy,
                    borderRadius: BorderRadius.circular(4),
                    child: const Padding(
                      padding: EdgeInsets.all(2),
                      child: Icon(Icons.copy_rounded, size: 14, color: AppTheme.primaryNavy),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
