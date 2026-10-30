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
/// 2. Auto-sliding every 5 seconds with an ultra-smooth 800ms easeInOutCubic transition.
/// 3. Infinite seamless loop using large virtual itemCount with index % 5 (zero jump back).
/// 4. Fixed text overlay ("Strength. Elegance. Timeless.") and "Explore Collection →" button outside moving layers.
/// 5. Subtle dot indicator at bottom-right with active brand orange pill, isolated via ValueNotifier.
/// 6. Interactive manual swipe support: cancels timer during touch, restarts 5s after swipe ends (no double jump).
/// 7. Background & tab visibility awareness: pauses when off-screen or backgrounded.
/// 8. Accessibility: respects "Reduce motion" / disableAnimations.
/// 9. Precached at exact banner cacheWidth before auto-slide starts with gaplessPlayback and fadeInDuration: Duration.zero.
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
  static const int _kLoopCount = 100000;
  static const int _kInitialPage = 50000; // 50000 % 5 == 0

  static const List<String> _defaultSlides = [
    'products/banners/banner_living_room_aravali_natural.webp',
    'products/banners/banner_kitchen_breccia_arrora.webp',
    'products/banners/banner_bathroom_grand_classic_brown.webp',
    'products/banners/banner_bedroom_antolia_crema.webp',
    'products/banners/banner_commercial_empro_patara_bianco.webp',
  ];

  List<String> _slides = _defaultSlides;
  late final PageController _pageController;
  late final ValueNotifier<int> _currentPageNotifier;

  Timer? _autoSlideTimer;
  bool _isAppInForeground = true;
  bool _isPrecachingDone = false;
  bool _isPrecachingStarted = false;
  bool _isUserSwiping = false;
  int? _targetCacheWidth;
  ModalRoute? _observedRoute;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pageController = PageController(initialPage: _kInitialPage);
    _currentPageNotifier = ValueNotifier<int>(_kInitialPage);
    _loadFirestoreBannerConfig();
  }

  Future<void> _loadFirestoreBannerConfig() async {
    try {
      final remoteSlides = await FirestoreService.instance.getHomeBannerSlides();
      if (remoteSlides != null && remoteSlides.isNotEmpty && mounted) {
        if (_slides.length != remoteSlides.length ||
            !_slides.every((s) => remoteSlides.contains(s))) {
          setState(() {
            _slides = remoteSlides;
          });
          if (_targetCacheWidth != null) {
            _precacheAllSlides(_targetCacheWidth!);
          }
        }
      }
    } catch (e) {
      debugPrint('[HomeBannerSlideshow] Using default bundled banner slides: $e');
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    // Track navigation route status to pause when another screen is pushed
    final route = ModalRoute.of(context);
    if (route != _observedRoute) {
      _observedRoute?.secondaryAnimation?.removeStatusListener(_onRouteAnimationStatus);
      _observedRoute = route;
      _observedRoute?.secondaryAnimation?.addStatusListener(_onRouteAnimationStatus);
    }

    final mediaQuery = MediaQuery.maybeOf(context);
    if (mediaQuery != null) {
      final screenWidth = mediaQuery.size.width;
      final pixelRatio = mediaQuery.devicePixelRatio;
      // Banner width is bounded by maxContentWidth (720) minus horizontal padding (32)
      final double bannerWidth = (screenWidth > 720 ? 720 : screenWidth) - 32;
      final targetWidth = (bannerWidth * pixelRatio).round().clamp(360, 1400);

      _targetCacheWidth = targetWidth;

      if (!_isPrecachingStarted) {
        _isPrecachingStarted = true;
        _precacheAllSlides(targetWidth);
      }
    }

    _checkAndResume();
  }

  void _onRouteAnimationStatus(AnimationStatus status) {
    if (status == AnimationStatus.dismissed) {
      _checkAndResume();
    } else {
      _pauseAutoSlide();
    }
  }

  Future<void> _precacheAllSlides(int targetCacheWidth) async {
    final List<Future<void>> futures = [];
    for (final slidePath in _slides) {
      final directUrl = StorageImageService.getDirectStorageUrl(slidePath);
      final ImageProvider netProvider = ResizeImage.resizeIfNeeded(
        targetCacheWidth,
        null,
        CachedNetworkImageProvider(directUrl),
      );
      futures.add(precacheImage(netProvider, context).catchError((_) {}));

      final localFallback = StorageImageService.getLocalFallbackPath(slidePath);
      if (localFallback != null) {
        final ImageProvider assetProvider = ResizeImage.resizeIfNeeded(
          targetCacheWidth,
          null,
          AssetImage(localFallback),
        );
        futures.add(precacheImage(assetProvider, context).catchError((_) {}));
      }
    }

    await Future.wait(futures);

    if (mounted) {
      _isPrecachingDone = true;
      _checkAndResume();
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
      if (curr is RenderOpacity && curr.opacity == 0.0) {
        return false;
      }
      if (curr is RenderIgnorePointer && curr.ignoring) {
        return false;
      }
      final parent = curr.parent;
      curr = parent is RenderObject ? parent : null;
    }
    return true;
  }

  bool _canAutoSlide() {
    if (!mounted) return false;
    if (_isUserSwiping) return false;
    if (!_isPrecachingDone) return false;

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
  }

  void _startAutoSlide() {
    _autoSlideTimer?.cancel();
    _autoSlideTimer = null;
    if (!_canAutoSlide()) return;

    _autoSlideTimer = Timer.periodic(const Duration(seconds: 5), (t) {
      if (!_canAutoSlide()) {
        _pauseAutoSlide();
        return;
      }
      _slideNext();
    });
  }

  void _pauseAutoSlide() {
    _autoSlideTimer?.cancel();
    _autoSlideTimer = null;
  }

  void _slideNext() {
    if (!_pageController.hasClients) return;
    final currentPage = _pageController.page?.round() ?? _currentPageNotifier.value;
    final targetPage = currentPage + 1;
    _pageController.animateToPage(
      targetPage,
      duration: const Duration(milliseconds: 800),
      curve: Curves.easeInOutCubic,
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _observedRoute?.secondaryAnimation?.removeStatusListener(_onRouteAnimationStatus);
    _pauseAutoSlide();
    _pageController.dispose();
    _currentPageNotifier.dispose();
    super.dispose();
  }

  Widget _buildSlideImage(String path, int targetCacheWidth) {
    final directUrl = StorageImageService.getDirectStorageUrl(path);
    final localFallback = StorageImageService.getLocalFallbackPath(path);

    return CachedNetworkImage(
      imageUrl: directUrl,
      fit: BoxFit.cover,
      width: double.infinity,
      height: double.infinity,
      memCacheWidth: targetCacheWidth,
      fadeInDuration: Duration.zero,
      fadeOutDuration: Duration.zero,
      placeholder: (context, url) {
        if (localFallback != null) {
          return Image.asset(
            localFallback,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
            cacheWidth: targetCacheWidth,
            gaplessPlayback: true,
          );
        }
        return Image.asset(
          'assets/images/splash_kitchen.jpg',
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          cacheWidth: targetCacheWidth,
          gaplessPlayback: true,
        );
      },
      errorWidget: (context, url, error) {
        if (localFallback != null) {
          return Image.asset(
            localFallback,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
            cacheWidth: targetCacheWidth,
            gaplessPlayback: true,
          );
        }
        return Image.asset(
          'assets/images/splash_kitchen.jpg',
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          cacheWidth: targetCacheWidth,
          gaplessPlayback: true,
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final slideCount = _slides.length;
    final disableAnimations = MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    return RepaintBoundary(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final double bannerWidth = constraints.maxWidth.isFinite && constraints.maxWidth > 0
              ? constraints.maxWidth
              : MediaQuery.of(context).size.width;
          final double pixelRatio = MediaQuery.of(context).devicePixelRatio;
          final int effectiveCacheWidth = _targetCacheWidth ??
              (bannerWidth * pixelRatio).round().clamp(360, 1400);

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
                    child: RepaintBoundary(
                      child: Listener(
                        onPointerDown: (_) {
                          _pauseAutoSlide();
                        },
                        onPointerUp: (_) {
                          if (!_isUserSwiping) {
                            _startAutoSlide();
                          }
                        },
                        onPointerCancel: (_) {
                          if (!_isUserSwiping) {
                            _startAutoSlide();
                          }
                        },
                        child: NotificationListener<ScrollNotification>(
                          onNotification: (notification) {
                            if (notification is ScrollStartNotification) {
                              if (notification.dragDetails != null) {
                                _isUserSwiping = true;
                                _pauseAutoSlide();
                              }
                            } else if (notification is ScrollEndNotification) {
                              if (_isUserSwiping) {
                                _isUserSwiping = false;
                                _startAutoSlide();
                              }
                            }
                            return false;
                          },
                          child: disableAnimations
                              // Accessibility: When reduce motion / animations are disabled, display only the first slide
                              ? _buildSlideImage(_slides.first, effectiveCacheWidth)
                              : PageView.builder(
                                  controller: _pageController,
                                  reverse: true, // Animates viewport left -> right
                                  physics: const BouncingScrollPhysics(),
                                  itemCount: _kLoopCount,
                                  onPageChanged: (page) {
                                    _currentPageNotifier.value = page;
                                  },
                                  itemBuilder: (context, index) {
                                    if (slideCount == 0) {
                                      return Image.asset(
                                        'assets/images/splash_kitchen.jpg',
                                        fit: BoxFit.cover,
                                        cacheWidth: effectiveCacheWidth,
                                        gaplessPlayback: true,
                                      );
                                    }
                                    final effectiveIndex = index % slideCount;
                                    final slidePath = _slides[effectiveIndex];
                                    return _buildSlideImage(slidePath, effectiveCacheWidth);
                                  },
                                ),
                        ),
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

                  // 3. Fixed Hero Content (Never moves or repaints during animation)
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

                  // 4. Subtle Dot Indicators (Bottom-Right corner) - Rebuilds isolated via ValueListenableBuilder
                  if (slideCount > 1 && !disableAnimations)
                    Positioned(
                      bottom: 14,
                      right: 18,
                      child: IgnorePointer(
                        child: ValueListenableBuilder<int>(
                          valueListenable: _currentPageNotifier,
                          builder: (context, currentPage, _) {
                            final activeDotIndex = slideCount > 0 ? (currentPage % slideCount) : 0;
                            return Row(
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
                            );
                          },
                        ),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
