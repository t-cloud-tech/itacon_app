import Flutter
import UIKit
import QuickLook

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, UIDocumentInteractionControllerDelegate {
  private var docController: UIDocumentInteractionController?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let controller = window?.rootViewController as? FlutterViewController
    if let messenger = controller?.binaryMessenger {
      let channel = FlutterMethodChannel(name: "com.itacongranito.app/po_downloader", binaryMessenger: messenger)
      channel.setMethodCallHandler({ [weak self] (call: FlutterMethodCall, result: @escaping FlutterResult) in
        guard let self = self else { return }

        switch call.method {
        case "savePdfToDocuments":
          guard let args = call.arguments as? [String: Any],
                let byteData = (args["bytes"] as? FlutterStandardTypedData)?.data,
                let fileName = args["fileName"] as? String else {
            result(FlutterError(code: "INVALID_ARGS", message: "Missing bytes or fileName", details: nil))
            return
          }

          do {
            let docsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            let fileUrl = docsDir.appendingPathComponent(fileName)
            try byteData.write(to: fileUrl, options: .atomic)
            result([
              "path": fileUrl.path,
              "uri": fileUrl.absoluteString
            ])
          } catch {
            result(FlutterError(code: "SAVE_FAILED", message: error.localizedDescription, details: nil))
          }

        case "openPdf":
          guard let args = call.arguments as? [String: Any],
                let path = args["path"] as? String else {
            result(FlutterError(code: "INVALID_ARGS", message: "Missing path", details: nil))
            return
          }

          let fileUrl = URL(fileURLWithPath: path)
          self.docController = UIDocumentInteractionController(url: fileUrl)
          self.docController?.delegate = self

          if let rootVc = self.window?.rootViewController {
            let presented = self.docController?.presentPreview(animated: true) ?? false
            if !presented {
              self.docController?.presentOptionsMenu(from: rootVc.view.bounds, in: rootVc.view, animated: true)
            }
            result(true)
          } else {
            result(false)
          }

        case "sharePdf":
          guard let args = call.arguments as? [String: Any],
                let path = args["path"] as? String else {
            result(FlutterError(code: "INVALID_ARGS", message: "Missing path", details: nil))
            return
          }

          let fileUrl = URL(fileURLWithPath: path)
          let activityVc = UIActivityViewController(activityItems: [fileUrl], applicationActivities: nil)
          if let rootVc = self.window?.rootViewController {
            if let popover = activityVc.popoverPresentationController {
              popover.sourceView = rootVc.view
              popover.sourceRect = CGRect(x: rootVc.view.bounds.midX, y: rootVc.view.bounds.midY, width: 0, height: 0)
              popover.permittedArrowDirections = []
            }
            rootVc.present(activityVc, animated: true, completion: nil)
            result(true)
          } else {
            result(false)
          }

        default:
          result(FlutterMethodNotImplemented)
        }
      })
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func documentInteractionControllerViewControllerForPreview(_ controller: UIDocumentInteractionController) -> UIViewController {
    return window?.rootViewController ?? UIViewController()
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}
