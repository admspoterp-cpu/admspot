import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, MessagingDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
            Messaging.messaging().delegate = self
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    /// Registo remoto: com Firebase, o token FCM chega ao JS via `MessagingDelegate` (fiável). O callback síncrono de `Messaging.messaging().token` após `apnsToken` falha muitas vezes (token ainda nil).
    /// Sem `GoogleService-Info.plist`, usa-se o token APNs em hex (Capacitor).
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        if FirebaseApp.app() != nil {
            Messaging.messaging().apnsToken = deviceToken
        } else {
            NotificationCenter.default.post(
                name: .capacitorDidRegisterForRemoteNotifications,
                object: deviceToken
            )
        }
    }

    // MARK: - MessagingDelegate (FCM → Capacitor / JS)
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken?.trimmingCharacters(in: .whitespacesAndNewlines), !token.isEmpty else {
            return
        }
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: token
        )
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
