import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/app_theme.dart';
import '../services/storage_image_service.dart';
import '../services/firestore_service.dart';
import 'interactive_pressable.dart';

/// Luxury Hero Banner Slideshow for ITACON GRANITO Home Screen.
///
/// Features:
/// 1. 5 architectural room mockup slides (Living Room, Kitchen, Bathroom, Bedroom, Commercial).
/// 2. Auto-sliding every 5 seconds with a smooth 600ms easeInOut left -> right transition.
/// 3. Infinite smooth loop with zero jump between wrap-around.
/// 4. Fixed text overlay ("Strength. Elegance. Timeless.") and "Explore Collection ->" button.
/// 5. Subtle dot indicator at bottom-right with active brand orange pill.
/// 6. Interactive manual swipe support: pauses on touch, resumes 3s after touch release.
/// 7. Background & tab visibility awareness: pauses when off-screen or backgrounded.
/// 8. Accessibility: respects "Reduce motion" / disableAnimations.
/// 9. Instant first frame rendering & aggressive background precaching (zero flicker).
class HomeBannerSlideshow extends StatefulWidget {
  final VoidCallback onExplore;

  const HomeBannerSlideshow({
    super.key,
    required this.onExplore,
  });

  @override
  State<HomeBannerSlideshow> createState() => _HomeBannerSlideshowState();
}

class _HomeBannerSlideshowState extends State<HomeBannerSlideshow>
    with WidgetsBindingObserver {
  static const int _virtualBaseIndex = 5000;

  static const List<String> _defaultSlides = [
    'products/banners/banner_living_room_aravali_natural.webp',
    'products/banners/banner_kitchen_breccia_arrora.webp',
    'products/banners/banner_bathroom_grand_classic_brown.webp',
    'products/banners/banner_bedroom_antolia_crema.webp',
    'products/banners/banner_commercial_empro_patara_bianco.webp',
  ];

  List<String> _slides = _defaultSlides;
  late final PageController _pageController;
  int _currentPageIndex = _virtualBaseIndex;
  Timer? _autoSlideTimer;
  Timer? _resumeDelayTimer;
  Timer? _visibilityPollTimer;
  bool _isAppInForeground = true;
  bool _isPrecachingDone = false;
  bool _isUserTouching = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pageController = PageController(initialPage: _virtualBaseIndex);
    _loadFirestoreBannerConfig();
  }

  Future<void> _loadFirestoreBannerConfig() async {
    try {
      final remoteSlides = await FirestoreService.instance.getHomeBannerSlides();
      if (remoteSlides != null && remoteSlides.isNotEmpty && mounted) {
        setState(() {
          _slides = remoteSlides;
        });
        _precacheCurrentSlides();
      }
    } catch (e) {
      debugPrint('[HomeBannerSlideshow] Using default bundled banner slides: $e');
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_isPrecachingDone) {
      _isPrecachingDone = true;
      _precacheCurrentSlides();
    }
    _checkAndResume();
  }

  void _precacheCurrentSlides() {
    for (final slidePath in _slides) {
      final remoteUrl = StorageImageService.getDirectStorageUrl(slidePath);
      precacheImage(CachedNetworkImageProvider(remoteUrl), context).catchError((_) {});

      final localFallback = StorageImageService.getLocalFallbackPath(slidePath);
      if (localFallback != null) {
        precacheImage(AssetImage(localFallback), context).catchError((_) {});
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _isAppInForeground = true;
      _checkAndResume();
    } else {
      _isAppInForeground = false;
      _pauseAutoSlide();
    }
  }

  @override
  void didUpdateWidget(covariant HomeBannerSlideshow oldWidget) {
    super.didUpdateWidget(oldWidget);
    _checkAndResume();
  }

  bool _isAncestorVisible() {
    if (!mounted) return false;
    final renderObject = context.findRenderObject();
    if (renderObject == null || !renderObject.attached) return false;

    RenderObject? curr = renderObject;
    while (curr != null) {
      final node = curr;
      if (node is RenderOpacity && node.opacity == 0.0) {
        return false;
      }
      if (node is RenderIgnorePointer && node.ignoring) {
        return false;
      }
      final parent = curr.parent;
      curr = parent is RenderObject ? parent : null;
    }
    return true;
  }

  bool _canAutoSlide() {
    if (!mounted) return false;
    if (_isUserTouching) return false;

    // 1. Accessibility: Reduce motion check
    final disableAnimations = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (disableAnimations) return false;

    // 2. App Lifecycle: Foreground only
    if (!_isAppInForeground) return false;

    // 3. Navigation: Current top-level route only
    final route = ModalRoute.of(context);
    if (route != null && !route.isCurrent) return false;

    // 4. Smooth tab switching: Active in IndexedStack / SmoothFadeIndexedStack
    if (!_isAncestorVisible()) return false;

    return true;
  }

  void _checkAndResume() {
    if (_canAutoSlide()) {
      _startAutoSlide();
    } else {
      _pauseAutoSlide();
    }
    _ensureVisibilityPoll();
  }

  void _ensureVisibilityPoll() {
    _visibilityPollTimer?.cancel();
    // Lightweight 1-second watcher ensures immediate auto-slide recovery
    // when user returns from other tabs without triggering explicit route pushes.
    _visibilityPollTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      final canSlide = _canAutoSlide();
      if (canSlide && _autoSlideTimer == null && !_isUserTouching) {
        _startAutoSlide();
      } else if (!canSlide && _autoSlideTimer != null) {
        _pauseAutoSlide();
      }
    });
  }

  void _startAutoSlide() {
    _autoSlideTimer?.cancel();
    _autoSlideTimer = Timer.periodic(const Duration(seconds: 5), (t) {
      if (!_canAutoSlide()) {
        _pauseAutoSlide();
        return;
      }
      if (_pageController.hasClients) {
        _pageController.nextPage(
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  void _pauseAutoSlide() {
    _autoSlideTimer?.cancel();
    _autoSlideTimer = null;
  }

  void _scheduleResumeAfterTouch() {
    _resumeDelayTimer?.cancel();
    _resumeDelayTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) {
        _isUserTouching = false;
        _checkAndResume();
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pauseAutoSlide();
    _resumeDelayTimer?.cancel();
    _visibilityPollTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  Widget _buildSlideImage(String path) {
    final directUrl = StorageImageService.getDirectStorageUrl(path);
    final localFallback = StorageImageService.getLocalFallbackPath(path);

    return CachedNetworkImage(
      imageUrl: directUrl,
      fit: BoxFit.cover,
      width: double.infinity,
      height: double.infinity,
      fadeInDuration: const Duration(milliseconds: 200),
      placeholder: (context, url) {
        if (localFallback != null) {
          return Image.asset(
            localFallback,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
          );
        }
        return Image.asset(
          'assets/images/splash_kitchen.jpg',
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
        );
      },
      errorWidget: (context, url, error) {
        if (localFallback != null) {
          return Image.asset(
            localFallback,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
          );
        }
        return Image.asset(
          'assets/images/splash_kitchen.jpg',
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final slideCount = _slides.length;
    final activeDotIndex = slideCount > 0 ? (_currentPageIndex % slideCount) : 0;
    final disableAnimations = MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: 180),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: AppTheme.primaryNavy,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          alignment: Alignment.centerLeft,
          children: [
            // 1. Background Slideshow (Slides Left -> Right smoothly)
            Positioned.fill(
              child: Listener(
                onPointerDown: (_) {
                  _isUserTouching = true;
                  _pauseAutoSlide();
                  _resumeDelayTimer?.cancel();
                },
                onPointerUp: (_) {
                  _scheduleResumeAfterTouch();
                },
                onPointerCancel: (_) {
                  _scheduleResumeAfterTouch();
                },
                child: disableAnimations
                    // Accessibility: When reduce motion / animations are disabled, display only the first slide
                    ? _buildSlideImage(_slides.first)
                    : PageView.builder(
                        controller: _pageController,
                        reverse: true, // Animates viewport left -> right
                        physics: const BouncingScrollPhysics(),
                        onPageChanged: (page) {
                          setState(() {
                            _currentPageIndex = page;
                          });
                        },
                        itemBuilder: (context, index) {
                          if (slideCount == 0) {
                            return Image.asset(
                              'assets/images/splash_kitchen.jpg',
                              fit: BoxFit.cover,
                            );
                          }
                          final effectiveIndex = ((index % slideCount) + slideCount) % slideCount;
                          final slidePath = _slides[effectiveIndex];
                          return _buildSlideImage(slidePath);
                        },
                      ),
              ),
            ),

            // 2. Fixed Dark Navy Gradient Overlay (preserves text readability across all pictures)
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppTheme.primaryNavy.withValues(alpha: 0.95),
                        AppTheme.primaryNavy.withValues(alpha: 0.5),
                      ],
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                    ),
                  ),
                ),
              ),
            ),

            // 3. Fixed Hero Content (Never moves during animation)
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'Strength. Elegance. Timeless.',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Premium Vitrified & Ceramic Surfaces Direct from Manufacturer',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 14),
                  AppButton(
                    text: 'Explore Collection →',
                    variant: AppButtonVariant.secondary,
                    height: 40,
                    fontSize: 13,
                    onPressed: widget.onExplore,
                  ),
                ],
              ),
            ),

            // 4. Subtle Dot Indicators (Bottom-Right corner)
            if (slideCount > 1 && !disableAnimations)
              Positioned(
                bottom: 14,
                right: 18,
                child: IgnorePointer(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: List.generate(slideCount, (i) {
                      final isActive = i == activeDotIndex;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                        margin: const EdgeInsets.symmetric(horizontal: 2.5),
                        width: isActive ? 14 : 5,
                        height: 5,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(3),
                          color: isActive
                              ? AppTheme.accentOrange
                              : Colors.white.withValues(alpha: 0.4),
                        ),
                      );
                    }),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

