import Foundation
import Capacitor
import GoogleSignIn

@objc(GoogleAuthPlugin)
public class GoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GoogleAuthPlugin"
    public let jsName = "GoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refresh", returnType: CAPPluginReturnPromise),
    ]

    public override func load() {
        let clientId = getConfig().getString("iosClientId") ?? clientIdFromPlist()
        if let clientId = clientId {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientId)
        }
    }

    @objc func initialize(_ call: CAPPluginCall) {
        if let clientId = call.getString("clientId") {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientId)
        }
        call.resolve()
    }

    @objc func signIn(_ call: CAPPluginCall) {
        guard let vc = bridge?.viewController else {
            call.reject("No view controller")
            return
        }
        DispatchQueue.main.async {
            GIDSignIn.sharedInstance.signIn(withPresenting: vc) { result, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                guard let user = result?.user, let idToken = user.idToken?.tokenString else {
                    call.reject("Failed to get ID token")
                    return
                }
                call.resolve([
                    "authentication": [
                        "idToken": idToken,
                        "accessToken": user.accessToken.tokenString
                    ],
                    "email": user.profile?.email ?? "",
                    "givenName": user.profile?.givenName ?? "",
                    "familyName": user.profile?.familyName ?? "",
                    "id": user.userID ?? "",
                    "name": user.profile?.name ?? ""
                ])
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        DispatchQueue.main.async { GIDSignIn.sharedInstance.signOut() }
        call.resolve()
    }

    @objc func refresh(_ call: CAPPluginCall) {
        guard let currentUser = GIDSignIn.sharedInstance.currentUser else {
            call.reject("No current user")
            return
        }
        currentUser.refreshTokensIfNeeded { user, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            guard let user = user, let idToken = user.idToken?.tokenString else {
                call.reject("Failed to refresh tokens")
                return
            }
            call.resolve([
                "authentication": [
                    "idToken": idToken,
                    "accessToken": user.accessToken.tokenString
                ]
            ])
        }
    }

    private func clientIdFromPlist() -> String? {
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let dict = NSDictionary(contentsOfFile: path) as? [String: Any],
              let clientId = dict["CLIENT_ID"] as? String else { return nil }
        return clientId
    }
}
