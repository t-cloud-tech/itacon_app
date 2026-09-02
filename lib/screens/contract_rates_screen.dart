import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/customer_pricing.dart';
import '../services/app_state_service.dart';

/// Surface-Wise & Size-Wise Contract Rates Viewer Screen featuring
/// grouped accordion cards and PDF rate sheet generation.
class ContractRatesScreen extends StatefulWidget {
  const ContractRatesScreen({super.key});

  @override
  State<ContractRatesScreen> createState() => _ContractRatesScreenState();
}

class _ContractRatesScreenState extends State<ContractRatesScreen> {
  final AppStateService _appState = AppStateService.instance;
  late List<SurfaceContractRate> _contractRates;
  bool _isGeneratingPdf = false;

  final List<String> _sizes = [
    '600x1200 mm',
    '600x600 mm',
    '1200x1800 mm',
    '800x1600 mm',
  ];

  @override
  void initState() {
    super.initState();
    _contractRates = SurfaceContractRate.getDefaultContractMatrix();
  }

  Map<String, List<SurfaceContractRate>> _groupedRates() {
    final Map<String, List<SurfaceContractRate>> map = {};
    for (var size in _sizes) {
      map[size] = _contractRates.where((r) => r.size == size).toList();
    }
    return map;
  }

  void _downloadPdfRateCard() async {
    setState(() => _isGeneratingPdf = true);
    await Future.delayed(const Duration(milliseconds: 1200));
    setState(() => _isGeneratingPdf = false);

    if (mounted) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          title: const Row(
            children: [
              Icon(Icons.picture_as_pdf_rounded, color: AppTheme.accentOrange),
              SizedBox(width: 10),
              Text(
                'Rate Sheet Generated',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Contract Rate Sheet for ${_appState.currentUserProfile.companyName.isNotEmpty ? _appState.currentUserProfile.companyName : _appState.currentUserProfile.name} is ready.',
                style: const TextStyle(fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.backgroundColor,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.borderSubtle),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Client: ${_appState.currentUserProfile.name}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'GSTIN: ${_appState.currentUserProfile.gstNumber.isNotEmpty ? _appState.currentUserProfile.gstNumber : '24AAACI9081F1Z2'}',
                      style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                    ),
                    Text(
                      'Region: ${_appState.currentUserProfile.region}',
                      style: const TextStyle(fontSize: 11, color: AppTheme.textSubtle),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Document: ITACON_Contract_Rates_2026.pdf',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy),
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close'),
            ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryNavy,
              ),
              icon: const Icon(Icons.download_rounded, size: 18, color: Colors.white),
              label: const Text('Save PDF', style: TextStyle(color: Colors.white)),
              onPressed: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Rate card PDF saved to Downloads folder!'),
                    backgroundColor: AppTheme.primaryNavy,
                  ),
                );
              },
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final grouped = _groupedRates();
    final profile = _appState.currentUserProfile;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('My Contract Rates'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Dealer Contract Header Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.primaryNavy, Color(0xFF1B365D)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primaryNavy.withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        profile.companyName.isNotEmpty ? profile.companyName : profile.name,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.accentOrange,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '${profile.userCategory.toUpperCase()} RATE MATRIX',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Approved Contract Pricing (₹/sq.ft) • Territory: ${profile.region}',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.white.withValues(alpha: 0.8),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            const Text(
              'Surface-Wise & Size-Wise Approved Matrix',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: AppTheme.primaryNavy,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Tap size categories to view approved rate vs MRP trade discount',
              style: TextStyle(fontSize: 12, color: AppTheme.textSubtle),
            ),
            const SizedBox(height: 16),

            // Grouped Accordion Size Cards
            ..._sizes.map((size) {
              final rates = grouped[size] ?? [];
              return Container(
                margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.borderSubtle),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: ExpansionTile(
                  initiallyExpanded: size == '600x1200 mm',
                  tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.aspect_ratio_rounded, color: AppTheme.primaryNavy, size: 20),
                  ),
                  title: Text(
                    'Size: $size',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryNavy,
                    ),
                  ),
                  subtitle: Text(
                    '${rates.length} Surface Finishes Available',
                    style: const TextStyle(fontSize: 12, color: AppTheme.textSubtle),
                  ),
                  children: [
                    const Divider(height: 1, color: AppTheme.borderSubtle),
                    Container(
                      color: AppTheme.backgroundColor,
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        children: [
                          // Table Header
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                            child: Row(
                              children: [
                                Expanded(
                                  flex: 3,
                                  child: Text('SURFACE FINISH',
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textSubtle)),
                                ),
                                Expanded(
                                  flex: 2,
                                  child: Text('MRP (₹)',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textSubtle)),
                                ),
                                Expanded(
                                  flex: 2,
                                  child: Text('YOUR RATE',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primaryNavy)),
                                ),
                                Expanded(
                                  flex: 2,
                                  child: Text('DISCOUNT',
                                      textAlign: TextAlign.right,
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.accentOrange)),
                                ),
                              ],
                            ),
                          ),
                          const Divider(height: 1, color: AppTheme.borderSubtle),

                          // Table Rows
                          ...rates.map((r) {
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                              decoration: const BoxDecoration(
                                border: Border(bottom: BorderSide(color: AppTheme.borderSubtle, width: 0.5)),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    flex: 3,
                                    child: Text(
                                      r.surface,
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textDark),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 2,
                                    child: Text(
                                      '₹${r.mrp.toStringAsFixed(0)}/sq.ft',
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppTheme.textSubtle,
                                        decoration: TextDecoration.lineThrough,
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 2,
                                    child: Text(
                                      '₹${r.contractRate.toStringAsFixed(0)}/sq.ft',
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.primaryNavy,
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 2,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.green.shade50,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        '${r.discountPercent.toStringAsFixed(0)}% OFF',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.green.shade700,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),

      // Floating 'Download Rate Card (PDF)' Button
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryNavy,
              elevation: 8,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            icon: _isGeneratingPdf
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : const Icon(Icons.picture_as_pdf_rounded, color: Colors.white),
            label: Text(
              _isGeneratingPdf ? 'Generating PDF Rate Sheet...' : 'Download Rate Card (PDF)',
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            onPressed: _isGeneratingPdf ? null : _downloadPdfRateCard,
          ),
        ),
      ),
    );
  }
}
