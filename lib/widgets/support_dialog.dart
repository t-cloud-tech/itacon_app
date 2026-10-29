import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/support_info.dart';
import '../theme/app_theme.dart';

/// Shows the centralized ITACON Support dialog across the application.
Future<void> showSupportDialog(BuildContext context) {
  return showDialog<void>(
    context: context,
    builder: (context) => const SupportDialog(),
  );
}

/// Shared ITACON Help & Support dialog.
class SupportDialog extends StatelessWidget {
  const SupportDialog({super.key});

  void _copyToClipboard(
    BuildContext context,
    String text, {
    ScaffoldMessengerState? messenger,
  }) {
    Clipboard.setData(ClipboardData(text: text));
    final activeMessenger = messenger ?? ScaffoldMessenger.maybeOf(context);
    if (activeMessenger != null) {
      activeMessenger.hideCurrentSnackBar();
      activeMessenger.showSnackBar(
        SnackBar(
          content: Text('Copied: $text'),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _launchOrCopy(
    BuildContext context, {
    required Uri uri,
    required String fallbackCopyText,
    LaunchMode mode = LaunchMode.platformDefault,
  }) async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    try {
      final bool canLaunch = await canLaunchUrl(uri);
      if (canLaunch) {
        final bool launched = await launchUrl(uri, mode: mode);
        if (!launched && context.mounted) {
          _copyToClipboard(context, fallbackCopyText, messenger: messenger);
        }
      } else if (context.mounted) {
        _copyToClipboard(context, fallbackCopyText, messenger: messenger);
      }
    } catch (_) {
      if (context.mounted) {
        _copyToClipboard(context, fallbackCopyText, messenger: messenger);
      }
    }
  }

  Widget _buildContactRow(
    BuildContext context, {
    required IconData icon,
    required String displayText,
    required String copyValue,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        onLongPress: () => _copyToClipboard(context, copyValue),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
          child: Row(
            children: [
              Icon(icon, size: 18, color: AppTheme.accentOrange),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  displayText,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textDark,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(Icons.headset_mic_rounded, color: AppTheme.primaryNavy, size: 24),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              SupportInfo.title,
              style: TextStyle(
                color: AppTheme.primaryNavy,
                fontWeight: FontWeight.bold,
                fontSize: 17,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              SupportInfo.subtitle,
              style: TextStyle(fontSize: 14, color: AppTheme.textDark),
            ),
            const SizedBox(height: 12),
            _buildContactRow(
              context,
              icon: Icons.phone_rounded,
              displayText: SupportInfo.phone1Display,
              copyValue: SupportInfo.phone1Display,
              onTap: () {
                final uri = Uri.parse('tel:${SupportInfo.phone1Raw}');
                _launchOrCopy(
                  context,
                  uri: uri,
                  fallbackCopyText: SupportInfo.phone1Display,
                );
              },
            ),
            _buildContactRow(
              context,
              icon: Icons.phone_rounded,
              displayText: SupportInfo.phone2Display,
              copyValue: SupportInfo.phone2Display,
              onTap: () {
                final uri = Uri.parse('tel:${SupportInfo.phone2Raw}');
                _launchOrCopy(
                  context,
                  uri: uri,
                  fallbackCopyText: SupportInfo.phone2Display,
                );
              },
            ),
            _buildContactRow(
              context,
              icon: Icons.email_rounded,
              displayText: SupportInfo.email,
              copyValue: SupportInfo.email,
              onTap: () {
                final uri = Uri.parse(
                  'mailto:${SupportInfo.email}?subject=${Uri.encodeComponent(SupportInfo.emailSubject)}',
                );
                _launchOrCopy(
                  context,
                  uri: uri,
                  fallbackCopyText: SupportInfo.email,
                );
              },
            ),
            _buildContactRow(
              context,
              icon: Icons.language_rounded,
              displayText: SupportInfo.websiteDisplay,
              copyValue: SupportInfo.websiteDisplay,
              onTap: () {
                final uri = Uri.parse(SupportInfo.websiteUrl);
                _launchOrCopy(
                  context,
                  uri: uri,
                  fallbackCopyText: SupportInfo.websiteUrl,
                  mode: LaunchMode.externalApplication,
                );
              },
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Close', style: TextStyle(color: AppTheme.primaryNavy)),
        ),
      ],
    );
  }
}

