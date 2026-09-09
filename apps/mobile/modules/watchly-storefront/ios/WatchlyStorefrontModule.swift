import ExpoModulesCore
import StoreKit

public final class WatchlyStorefrontModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WatchlyStorefront")

    AsyncFunction("getCountryCode") { () async -> String? in
      return await Storefront.current?.countryCode
    }
  }
}
