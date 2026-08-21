import ExpoModulesCore

public final class WatchlyDiscordAuthModule: Module {
  private let bridge = WatchlyDiscordAuthBridge()

  public func definition() -> ModuleDefinition {
    Name("WatchlyDiscordAuth")

    AsyncFunction("authorize") { (clientId: String, promise: Promise) in
      bridge.authorize(withClientId: clientId) { result, error in
        if let error {
          promise.reject(error)
        } else {
          promise.resolve(result)
        }
      }
    }
  }
}
