Pod::Spec.new do |s|
  s.name           = 'ConPawsWidgets'
  s.version        = '1.0.0'
  s.summary        = 'Shares ConPaws schedules with Apple widgets and Watch.'
  s.description    = s.summary
  s.author         = 'ConPaws'
  s.homepage       = 'https://conpaws.com'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
