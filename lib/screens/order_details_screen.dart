import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/app_theme.dart';
import '../models/tile_order.dart';
import '../models/payment_config.dart';
import '../models/payment_submission.dart';
import '../services/firestore_service.dart';
import '../services/app_state_service.dart';

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

  // Manual Bank Transfer Payment State
  bool _showAccountDetails = false;
  bool _showResubmitForm = false;
  bool _isSubmittingPayment = false;
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _utrController = TextEditingController();
  DateTime _paymentDate = DateTime.now();
  XFile? _selectedReceiptFile;
  int? _receiptFileSize;

  @override
  void dispose() {
    _amountController.dispose();
    _utrController.dispose();
    super.dispose();
  }

  Future<void> _handlePickReceipt() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
      );
      if (picked != null) {
        final length = await picked.length();
        if (length > 10 * 1024 * 1024) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Receipt image exceeds maximum size of 10 MB.'),
                backgroundColor: AppTheme.statusError,
              ),
            );
          }
          return;
        }
        setState(() {
          _selectedReceiptFile = picked;
          _receiptFileSize = length;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to select receipt image: $e'),
            backgroundColor: AppTheme.statusError,
          ),
        );
      }
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

    if (_selectedReceiptFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a payment receipt or screenshot to upload.'),
          backgroundColor: AppTheme.statusError,
        ),
      );
      return;
    }

    setState(() => _isSubmittingPayment = true);

    try {
      // 1. Generate deterministic submission ID tied directly to order
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final submissionId = 'sub_${order.id}_$timestamp';

      // 2. Determine file extension
      final name = _selectedReceiptFile!.name;
      final ext = name.contains('.') ? name.split('.').last.toLowerCase() : 'jpg';
      final allowedExts = ['jpeg', 'jpg', 'png', 'webp', 'pdf'];
      final safeExt = allowedExts.contains(ext) ? ext : 'jpg';

      // 3. Private upload to Firebase Storage with deterministic receipt name
      final storagePath = 'payment_proofs/${order.id}/$submissionId/receipt.$safeExt';
      final storageRef = FirebaseStorage.instance.ref().child(storagePath);

      final fileBytes = await _selectedReceiptFile!.readAsBytes();
      final mimeType = safeExt == 'pdf' ? 'application/pdf' : 'image/$safeExt';

      await storageRef.putData(
        fileBytes,
        SettableMetadata(
          contentType: mimeType,
          customMetadata: {
            'orderId': order.id,
            'submissionId': submissionId,
            'orderRef': order.orderReference,
          },
        ),
      );

      // 4. Invoke secure callable via FirestoreService
      await FirestoreService.instance.submitPaymentProof(
        orderId: order.id,
        submittedAmount: enteredAmount,
        utrNumber: rawUtr,
        paymentDate: _paymentDate,
        proofStoragePath: storagePath,
      );

      if (mounted) {
        setState(() {
          _selectedReceiptFile = null;
          _receiptFileSize = null;
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Payment submission failed: $e'),
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

  Future<void> _handleDownloadPdf(String pdfUrl) async {
    if (pdfUrl.isNotEmpty) {
      final uri = Uri.parse(pdfUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Unable to open PDF URL.')),
          );
        }
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('PDF is being generated by factory system. Please check back in a few seconds...'),
          backgroundColor: AppTheme.accentOrange,
        ),
      );
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
            body: const Center(child: CircularProgressIndicator(color: AppTheme.primaryNavy)),
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
            body: Center(
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
          );
        }

        final bool isPendingRate = order.isPendingQuoteStage;
        final bool isRateQuoted = order.isRateQuotedStage;
        final bool isConfirmed = order.isConfirmedStage;
        final bool isRejected = order.status == 'rejected';

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
          body: SingleChildScrollView(
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
                _buildStatusBanner(order, isPendingRate, isRateQuoted, isConfirmed, isRejected),
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
                _buildItemsTable(order, isPendingRate),
                const SizedBox(height: 16),

                // Financial Summary Card (Excluding Freight)
                if (!isPendingRate) ...[
                  _buildFinancialSummaryCard(order),
                  const SizedBox(height: 20),
                ],

                // Dynamic Action Block at Bottom
                _buildDynamicActionBlock(order, isPendingRate, isRateQuoted, isConfirmed, isRejected),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatusBanner(
    TileOrder order,
    bool isPendingRate,
    bool isRateQuoted,
    bool isConfirmed,
    bool isRejected,
  ) {
    Color bannerBg = AppTheme.primaryNavy.withValues(alpha: 0.1);
    Color bannerBorder = AppTheme.primaryNavy;
    IconData bannerIcon = Icons.hourglass_top_rounded;
    String bannerTitle = 'Rate Approval in Progress';
    String bannerDesc = 'Your assigned salesperson is currently quoting today\'s factory rates.';

    if (order.status == 'pending_manager_approval' || order.priceApprovalStatus == 'pending_manager_approval') {
      bannerBg = AppTheme.primaryNavy.withValues(alpha: 0.1);
      bannerBorder = AppTheme.primaryNavy;
      bannerIcon = Icons.hourglass_top_rounded;
      bannerTitle = 'Price Approval in Progress';
      bannerDesc = 'Special discount rate request is currently awaiting factory manager review and approval.';
    } else if (isRateQuoted) {
      bannerBg = AppTheme.accentOrange.withValues(alpha: 0.12);
      bannerBorder = AppTheme.accentOrange;
      bannerIcon = Icons.mark_email_unread_rounded;
      bannerTitle = "Today's Quoted Rates Received";
      bannerDesc = 'Please review today\'s quoted rates and confirm to finalize your Purchase Order.';
    } else if (isConfirmed) {
      if (order.isPaymentPendingVerification) {
        bannerBg = AppTheme.primaryNavy.withValues(alpha: 0.12);
        bannerBorder = AppTheme.primaryNavy;
        bannerIcon = Icons.pending_actions_rounded;
        bannerTitle = 'Payment Verification in Progress';
        bannerDesc = 'Your bank transfer details have been submitted and are being verified by our accounts team.';
      } else if (order.isPaymentRejected) {
        bannerBg = AppTheme.statusError.withValues(alpha: 0.12);
        bannerBorder = AppTheme.statusError;
        bannerIcon = Icons.error_outline_rounded;
        bannerTitle = 'Payment Verification Failed';
        bannerDesc = (order.rejectionReason != null && order.rejectionReason!.isNotEmpty)
            ? 'Reason: ${order.rejectionReason}'
            : 'Payment verification failed. Please review the details and resubmit proof.';
      } else if (order.paymentStatus == 'paid') {
        bannerBg = AppTheme.statusSuccess.withValues(alpha: 0.12);
        bannerBorder = AppTheme.statusSuccess;
        bannerIcon = Icons.verified_rounded;
        bannerTitle = 'Payment Verified & Confirmed';
        bannerDesc = 'Payment of ₹${(order.paidAmount ?? order.totalAmount).toStringAsFixed(2)} verified. Factory processing in progress.';
      } else {
        bannerBg = AppTheme.accentOrange.withValues(alpha: 0.12);
        bannerBorder = AppTheme.accentOrange;
        bannerIcon = Icons.account_balance_wallet_outlined;
        bannerTitle = 'Payment Required (Quotation Confirmed)';
        bannerDesc = 'Please complete the bank transfer below to proceed with order dispatch.';
      }
    } else if (isRejected) {
      bannerBg = AppTheme.statusError.withValues(alpha: 0.12);
      bannerBorder = AppTheme.statusError;
      bannerIcon = Icons.cancel_rounded;
      bannerTitle = 'Quotation Estimate Declined';
      bannerDesc = 'You have declined today\'s quoted rates for this Purchase Order.';
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
              Text(
                'Date: $createdDateStr',
                style: const TextStyle(fontSize: 12, color: AppTheme.textSubtle),
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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Total Boxes', style: TextStyle(fontSize: 11, color: AppTheme.textSubtle)),
                  Text('${order.totalBoxes} Boxes', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('Total Weight (Tonnes)', style: TextStyle(fontSize: 11, color: AppTheme.textSubtle)),
                  Text('${order.totalWeightTons.toStringAsFixed(2)} Tonnes', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                ],
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
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.accentOrange.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'Rate Approval in Progress',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.accentOrange,
                      ),
                    ),
                  )
                else
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        (item.size.toLowerCase().contains('adhesive') || item.productName.toLowerCase().contains('adhesive') || item.unit == 'bag')
                            ? '₹${(item.unitPrice ?? 0.0).toStringAsFixed(2)}/bag'
                            : '₹${(item.unitPrice ?? 0.0).toStringAsFixed(2)}/sq ft',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.accentOrange,
                        ),
                      ),
                      Text(
                        'Total: ₹${(item.lineTotal ?? (item.quantitySqFt * (item.unitPrice ?? 0.0))).toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryNavy,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildFinancialSummaryCard(TileOrder order) {
    return Container(
      decoration: AppTheme.luxuryCardDecoration,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildSummaryRow('Subtotal', order.subtotal),
          if (order.discount > 0)
            _buildSummaryRow('Discount (Applied)', -order.discount, isDiscount: true),
          _buildSummaryRow('18% GST (Tax)', order.taxAmount),
          const Divider(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Final Total Amount',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.primaryNavy,
                ),
              ),
              Text(
                '₹${order.totalAmount.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: AppTheme.accentOrange,
                ),
              ),
            ],
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
          Text(label, style: const TextStyle(fontSize: 13, color: AppTheme.textSubtle)),
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
    TileOrder order,
    bool isPendingRate,
    bool isRateQuoted,
    bool isConfirmed,
    bool isRejected,
  ) {
    if (isPendingRate) {
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

    if (isRateQuoted) {
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

    if (isConfirmed) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.statusSuccess.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle_rounded, color: AppTheme.statusSuccess, size: 20),
                SizedBox(width: 8),
                Text(
                  'Order Confirmed',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.statusSuccess),
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
              icon: const Icon(Icons.picture_as_pdf_rounded, color: Colors.white, size: 20),
              label: const Text(
                'Download Official PO (PDF)',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
              onPressed: () => _handleDownloadPdf(order.poDocumentUrl),
            ),
          ),
          const SizedBox(height: 20),
          _buildPaymentSection(order),
        ],
      );
    }

    return Container();
  }

  Widget _buildPaymentSection(TileOrder order) {
    if (order.paymentStatus == 'paid') {
      return _buildPaidSuccessCard(order);
    }

    if (order.isPaymentPendingVerification) {
      return _buildPendingVerificationCard(order);
    }

    if (order.isPaymentRejected && !_showResubmitForm) {
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
          const Row(
            children: [
              Icon(Icons.verified_rounded, color: AppTheme.statusSuccess, size: 24),
              SizedBox(width: 8),
              Text(
                'PAYMENT VERIFIED & RECEIVED',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.statusSuccess),
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
          const Row(
            children: [
              Icon(Icons.hourglass_empty_rounded, color: AppTheme.primaryNavy, size: 24),
              SizedBox(width: 8),
              Text(
                'PAYMENT VERIFICATION IN PROGRESS',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _buildDetailRow('Expected / Submitted Amount', '₹${order.totalAmount.toStringAsFixed(2)}', isBold: true),
          _buildDetailRow('Payment Method', 'Bank Transfer (NEFT / RTGS / IMPS)'),
          if (order.paymentSubmissionId != null)
            _buildDetailRow('Submission Ref', order.paymentSubmissionId!),
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
          const Row(
            children: [
              Icon(Icons.cancel_outlined, color: AppTheme.statusError, size: 24),
              SizedBox(width: 8),
              Text(
                'PAYMENT VERIFICATION FAILED',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.statusError),
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
                    '₹${order.totalAmount.toStringAsFixed(2)}',
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
                    const Text('Expected Amount (Read-only):', style: TextStyle(fontSize: 12, color: AppTheme.textSubtle)),
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

              // Receipt / Screenshot upload
              const Text('Payment Receipt / Screenshot', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textDark)),
              const SizedBox(height: 6),
              InkWell(
                onTap: _handlePickReceipt,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: _selectedReceiptFile != null
                        ? AppTheme.statusSuccess.withValues(alpha: 0.05)
                        : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _selectedReceiptFile != null ? AppTheme.statusSuccess : AppTheme.borderSubtle,
                      style: BorderStyle.solid,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _selectedReceiptFile != null ? Icons.check_circle_rounded : Icons.cloud_upload_outlined,
                        color: _selectedReceiptFile != null ? AppTheme.statusSuccess : AppTheme.primaryNavy,
                        size: 26,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _selectedReceiptFile != null
                                  ? _selectedReceiptFile!.name
                                  : 'Select Receipt Image (Max 10 MB)',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: _selectedReceiptFile != null ? AppTheme.statusSuccess : AppTheme.primaryNavy,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              _receiptFileSize != null
                                  ? '${(_receiptFileSize! / (1024 * 1024)).toStringAsFixed(2)} MB • JPEG, PNG, WEBP'
                                  : 'Supports JPEG, PNG, WEBP (Max 10 MB)',
                              style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
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

  Widget _buildDetailRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppTheme.textSubtle)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
                color: AppTheme.textDark,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
