import Foundation
import Capacitor
import AuthenticationServices

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?

    @objc func authorize(_ call: CAPPluginCall) {
        let nonce = call.getString("nonce") ?? ""
        self.pendingCall = call

        DispatchQueue.main.async {
            let provider = ASAuthorizationAppleIDProvider()
            let request = provider.createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = nonce

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }
}

extension AppleSignInPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let call = pendingCall,
              let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8)
        else {
            pendingCall?.reject("Failed to get Apple identity token")
            pendingCall = nil
            return
        }

        var response: [String: Any] = [
            "identityToken": identityToken,
            "user": credential.user
        ]
        if let email = credential.email { response["email"] = email }
        if let name = credential.fullName {
            response["givenName"] = name.givenName ?? ""
            response["familyName"] = name.familyName ?? ""
        }

        call.resolve(["response": response])
        pendingCall = nil
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        let code = (error as NSError).code
        if code == ASAuthorizationError.canceled.rawValue {
            pendingCall?.reject("SIGN_IN_CANCELLED")
        } else {
            pendingCall?.reject(error.localizedDescription)
        }
        pendingCall = nil
    }
}

extension AppleSignInPlugin: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return webView?.window ?? UIWindow()
    }
}
