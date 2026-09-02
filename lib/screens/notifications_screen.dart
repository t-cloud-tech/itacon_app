import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/notification_queue.dart';
import '../services/firestore_service.dart';
import '../services/app_state_service.dart';

/// In-App Notification Center featuring Celebratory Cards for Festival & Event Greetings
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final FirestoreService _firestoreService = FirestoreService.instance;
  final AppStateService _appState = AppStateService.instance;

  @override
  Widget build(BuildContext context) {
    final userId = _appState.currentUserProfile.userId;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        title: const Text('Notifications'),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all_rounded, color: AppTheme.primaryNavy),
            tooltip: 'Mark All as Read',
            onPressed: () async {
              if (userId.isNotEmpty) {
                // Seed sample festival greeting if empty and mark notifications read
                await _firestoreService.seedDefaultFestivalGreetings();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('All notifications marked as read.'),
                      backgroundColor: AppTheme.primaryNavy,
                    ),
                  );
                }
              }
            },
          ),
        ],
      ),
      body: StreamBuilder<List<NotificationQueueItem>>(
        stream: _firestoreService.getUserNotificationsStream(userId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: AppTheme.primaryNavy),
            );
          }

          List<NotificationQueueItem> notifications = snapshot.data ?? [];

          // Display sample mock greetings if no notifications exist yet
          if (notifications.isEmpty) {
            notifications = _buildMockNotifications(userId);
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: notifications.length,
            separatorBuilder: (_, _) => const SizedBox(height: 14),
            itemBuilder: (context, index) {
              final item = notifications[index];
              return _buildNotificationCard(context, item, userId);
            },
          );
        },
      ),
    );
  }

  Widget _buildNotificationCard(
    BuildContext context,
    NotificationQueueItem item,
    String userId,
  ) {
    final isFestival = item.type == 'festival_greeting' || item.event == 'festival_greeting';
    final isUnread = !item.isRead;

    return GestureDetector(
      onTap: () async {
        if (isUnread && userId.isNotEmpty) {
          await _firestoreService.markNotificationAsRead(userId, item.id);
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: isUnread ? Colors.white : Colors.grey.shade50,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isUnread
                ? (isFestival ? AppTheme.accentOrange : AppTheme.primaryNavy)
                : AppTheme.borderSubtle,
            width: isUnread ? 1.5 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isUnread ? 0.08 : 0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Optional Banner Image for Festival Greetings
            if (isFestival && item.bannerImageUrl != null && item.bannerImageUrl!.isNotEmpty)
              Stack(
                children: [
                  Image.network(
                    item.bannerImageUrl!,
                    width: double.infinity,
                    height: 130,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      height: 80,
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppTheme.primaryNavy, Color(0xFF1F3A60)],
                        ),
                      ),
                      child: const Center(
                        child: Icon(Icons.celebration_rounded, color: Colors.amber, size: 40),
                      ),
                    ),
                  ),
                  Container(
                    height: 130,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.black.withValues(alpha: 0.6),
                          Colors.transparent,
                        ],
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                      ),
                    ),
                  ),
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.accentOrange,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text(
                        'FESTIVAL GREETING 🪔',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),

            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Festive Icon / Category Graphic
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: isFestival
                          ? Colors.amber.shade100
                          : AppTheme.primaryNavy.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      isFestival ? Icons.celebration_rounded : Icons.notifications_active_rounded,
                      color: isFestival ? Colors.amber.shade900 : AppTheme.primaryNavy,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),

                  // Notification Content Body
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                item.title,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: isUnread ? FontWeight.bold : FontWeight.w600,
                                  color: AppTheme.textDark,
                                ),
                              ),
                            ),
                            if (isUnread)
                              Container(
                                width: 8,
                                height: 8,
                                margin: const EdgeInsets.only(left: 6),
                                decoration: const BoxDecoration(
                                  color: AppTheme.accentOrange,
                                  shape: BoxShape.circle,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          item.message,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppTheme.textDark,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            if (item.region != null && item.region!.isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryNavy.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  'Region: ${item.region}',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.primaryNavy,
                                  ),
                                ),
                              )
                            else
                              const SizedBox.shrink(),
                            Text(
                              _formatTimestamp(item.createdAt),
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppTheme.textSubtle,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTimestamp(DateTime? dt) {
    if (dt == null) return 'Today';
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    }
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  List<NotificationQueueItem> _buildMockNotifications(String userId) {
    final region = _appState.currentUserProfile.region;
    return [
      NotificationQueueItem(
        notificationId: 'N1',
        recipientId: userId,
        type: 'festival_greeting',
        event: 'festival_greeting',
        title: 'Happy Diwali & Prosperous New Year! 🪔',
        message:
            'Wishing you and your business joy, health, and booming prosperity from the ITACON Granito family!',
        bannerImageUrl:
            'https://images.unsplash.com/photo-1605807646983-377bc5a76493?auto=format&fit=crop&w=800&q=80',
        region: region,
        isRead: false,
        createdAt: DateTime.now().subtract(const Duration(minutes: 45)),
      ),
      NotificationQueueItem(
        notificationId: 'N2',
        recipientId: userId,
        type: 'festival_greeting',
        event: 'festival_greeting',
        title: 'Shubh Navratri & Garba Greetings! 💃',
        message:
            'May Goddess Durga bless your home & commercial projects with divine strength and victory!',
        bannerImageUrl:
            'https://images.unsplash.com/photo-1602701830206-8d69780072b2?auto=format&fit=crop&w=800&q=80',
        region: 'West India (Gujarat/Maharashtra)',
        isRead: true,
        createdAt: DateTime.now().subtract(const Duration(hours: 5)),
      ),
    ];
  }
}
