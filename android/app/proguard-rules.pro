# Flutter Wrapper Keep Rules
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.provider.** { *; }

# Deferred Components / Play Core (Suppress missing optional dependencies warnings)
-dontwarn com.google.android.play.**
-dontwarn io.flutter.embedding.engine.deferredcomponents.**

# Google Play Services, Play Integrity & Firebase Auth
-keep class com.google.android.gms.** { *; }
-keep class com.google.firebase.** { *; }
-keep class com.google.android.play.core.integrity.** { *; }
-keep interface com.google.android.play.core.integrity.** { *; }
-keep class com.google.android.gms.auth.api.phone.** { *; }
-keep class com.google.android.gms.tasks.** { *; }
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**
-dontwarn com.google.android.play.core.integrity.**

# App Data Models & Firestore Reflection Protection
-keep class com.itacongranito.app.models.** { *; }
-keepclassmembers class * {
    @com.google.firebase.firestore.PropertyName <fields>;
    @com.google.firebase.firestore.PropertyName <methods>;
}

# Preserve attributes for JSON/serialization reflection
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Image Picker & File Picker
-keep class io.flutter.plugins.imagepicker.** { *; }
-keep class com.mr.flutter.plugin.filepicker.** { *; }

# Firebase Cloud Messaging & Background Messaging
-keep class io.flutter.plugins.firebase.messaging.** { *; }
-keep class com.google.firebase.messaging.** { *; }

# Cached Network Image & OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Google Fonts
-keep class com.google.fonts.** { *; }

