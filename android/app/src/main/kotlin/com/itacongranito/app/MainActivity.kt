package com.itacongranito.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class MainActivity : FlutterActivity() {
    private val PO_CHANNEL = "com.itacongranito.app/po_downloader"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, PO_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "savePdfToDownloads" -> {
                    val bytes = call.argument<ByteArray>("bytes")
                    val fileName = call.argument<String>("fileName") ?: "Purchase_Order.pdf"

                    if (bytes == null) {
                        result.error("INVALID_ARGS", "PDF byte array is null", null)
                        return@setMethodCallHandler
                    }

                    try {
                        val savedData = savePdfToDownloads(bytes, fileName)
                        result.success(savedData)
                    } catch (e: Exception) {
                        result.error("SAVE_FAILED", e.localizedMessage ?: "Failed to save PDF to Downloads", null)
                    }
                }
                "openPdf" -> {
                    val uriString = call.argument<String>("uri")
                    val filePath = call.argument<String>("path")

                    try {
                        val success = openPdfViewer(uriString, filePath)
                        result.success(success)
                    } catch (e: Exception) {
                        result.error("OPEN_FAILED", e.localizedMessage ?: "Failed to open PDF document", null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun savePdfToDownloads(bytes: ByteArray, fileName: String): Map<String, String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+ (API 29+): Scoped Storage via MediaStore Downloads without requiring runtime permissions
            val resolver = applicationContext.contentResolver
            val contentValues = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }

            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                ?: throw IOException("Failed to create MediaStore entry for $fileName")

            resolver.openOutputStream(uri)?.use { outputStream ->
                outputStream.write(bytes)
                outputStream.flush()
            } ?: throw IOException("Failed to open output stream for $uri")

            contentValues.clear()
            contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, contentValues, null, null)

            mapOf(
                "uri" to uri.toString(),
                "path" to fileName
            )
        } else {
            // Android 9 and below: Legacy external storage public Downloads folder
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!downloadsDir.exists()) {
                downloadsDir.mkdirs()
            }
            val destinationFile = File(downloadsDir, fileName)
            FileOutputStream(destinationFile).use { fos ->
                fos.write(bytes)
                fos.flush()
            }

            val contentUri = FileProvider.getUriForFile(
                applicationContext,
                "${applicationContext.packageName}.fileprovider",
                destinationFile
            )

            mapOf(
                "uri" to contentUri.toString(),
                "path" to destinationFile.absolutePath
            )
        }
    }

    private fun openPdfViewer(uriString: String?, filePath: String?): Boolean {
        val uri: Uri = when {
            !uriString.isNullOrEmpty() -> Uri.parse(uriString)
            !filePath.isNullOrEmpty() -> {
                val file = File(filePath)
                FileProvider.getUriForFile(
                    applicationContext,
                    "${applicationContext.packageName}.fileprovider",
                    file
                )
            }
            else -> throw IllegalArgumentException("Both URI and file path are empty")
        }

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val chooser = Intent.createChooser(intent, "Open Purchase Order PDF").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(chooser)
        return true
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelId = "itacon_high_importance_channel"
            val channelName = "ITACON High Importance Notifications"
            val channelDescription = "Critical updates regarding orders, payments, dispatches, offers, and festival greetings"
            val importance = NotificationManager.IMPORTANCE_HIGH

            val channel = NotificationChannel(channelId, channelName, importance).apply {
                description = channelDescription
                enableLights(true)
                enableVibration(true)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
        }
    }
}
