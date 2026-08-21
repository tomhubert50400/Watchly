Pod::Spec.new do |s|
  s.name             = 'WatchlyDiscordAuth'
  s.version          = '1.0.0'
  s.summary          = 'Watchly Discord authentication bridge'
  s.description      = 'Opens Discord authorization through the Discord Social SDK.'
  s.license          = { :type => 'Proprietary' }
  s.author           = 'Watchly'
  s.homepage         = 'https://trywatchly.com'
  s.platforms        = { :ios => '15.1' }
  s.swift_version    = '5.9'
  s.source           = { :git => 'https://github.com/tomhubert50400/tv-app.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = 'WatchlyDiscordAuth/**/*.{h,m,mm,swift}'
  s.public_header_files = 'WatchlyDiscordAuth/**/*.h'
  s.vendored_frameworks = 'Frameworks/discord_partner_sdk.xcframework'
  s.preserve_paths = 'Frameworks/License-Notices.txt'
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
