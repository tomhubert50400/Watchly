Pod::Spec.new do |s|
  s.name = 'WatchlyStorefront'
  s.version = '1.0.0'
  s.summary = 'Watchly App Store region'
  s.description = 'Reads the current App Store storefront for watch availability.'
  s.license = { :type => 'Proprietary' }
  s.author = 'Watchly'
  s.homepage = 'https://trywatchly.com'
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.source = { :git => 'https://github.com/tomhubert50400/tv-app.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'StoreKit'
  s.source_files = '**/*.swift'
end
