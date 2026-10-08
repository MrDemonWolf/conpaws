# Run with `bundle exec ruby fastlane/check.rb`. No signing or store calls.
require "fileutils"
require "open3"
require "plist"
require "tmpdir"
require "xcodeproj"

module UI
  def self.user_error!(message)
    raise ArgumentError, message
  end
end

class LaneCheck
  attr_reader :calls

  def initialize
    @lanes = {}
    @calls = {}
    instance_eval(File.read(File.join(__dir__, "Fastfile")), File.join(__dir__, "Fastfile"))
  end

  def before_all(&block)
    @before = block
  end

  def platform(name)
    @platform = name
    yield
  end

  def lane(name, &block)
    @lanes[[@platform, name]] = block
  end

  def run(platform)
    @calls.clear
    @before.call
    @lanes.fetch([platform, :release]).call
  end

  def method_missing(name, **options)
    @calls[name] ||= []
    @calls[name] << options
    if name == :setup_ci
      ENV["MATCH_KEYCHAIN_NAME"] = "check"
      ENV["MATCH_KEYCHAIN_PASSWORD"] = "check"
    end
    name == :build_app ? "check.ipa" : {}
  end

  def respond_to_missing?(_name, _private = false)
    true
  end
end

def rejects(message)
  begin
    yield
  rescue ArgumentError => error
    raise "Wrong rejection: #{error.message}" unless error.message.include?(message)
    return
  end
  raise "Expected rejection: #{message}"
end

# Replace external I/O only; execute the actual lane's guards and configuration.
module Open3
  def self.capture2(*args)
    [File.read(args.last), Struct.new(:success?).new(true)]
  end
end
def FileUtils.cp(*) = nil
def FileUtils.mkdir_p(*) = nil

Dir.mktmpdir("conpaws-lane-check") do |directory|
  ENV.update(
    "ASC_KEY_ID" => "check", "ASC_ISSUER_ID" => "check", "ASC_KEY_BASE64" => "check",
    "IOS_SIGNING_DIRECTORY" => directory, "IOS_CERTIFICATE_PASSWORD" => "check",
    "ANDROID_KEYSTORE_PATH" => "check", "ANDROID_STORE_PASSWORD" => "check",
    "ANDROID_KEY_ALIAS" => "check", "ANDROID_KEY_PASSWORD" => "check",
    "GOOGLE_PLAY_KEY_PATH" => "check", "RELEASE_SHA" => "check"
  )
  ids = %w[com.mrdemonwolf.conpaws com.mrdemonwolf.conpaws.widgets com.mrdemonwolf.conpaws.watchkitapp com.mrdemonwolf.conpaws.watchkitapp.widgets]
  project = Xcodeproj::Project.new(File.join(directory, "check.xcodeproj"))
  ids.each_with_index do |id, index|
    target = project.new_target(:application, "target#{index}", :ios, "17.0")
    target.build_configurations.each { |config| config.build_settings["PRODUCT_BUNDLE_IDENTIFIER"] = id }
    File.write(File.join(directory, "#{index}.mobileprovision"), {
      "UUID" => "profile#{index}", "TeamIdentifier" => ["HBB7T99U79"],
      "ExpirationDate" => Time.now + 3600,
      "Entitlements" => { "application-identifier" => "HBB7T99U79.#{id}", "get-task-allow" => false }
    }.to_plist)
  end
  Xcodeproj::Project.define_singleton_method(:open) { |_path| project }
  check = LaneCheck.new
  %w[dev main].each do |branch|
    ENV.update("RELEASE_BRANCH" => branch, "APP_VARIANT" => branch == "dev" ? "preview" : "production")
    check.run(:ios)
    raise "Missing extension signing" unless check.calls.fetch(:update_code_signing_settings).length == 4
    export = check.calls.fetch(:build_app).first.fetch(:export_options)
    raise "Preview is not internal-only" unless export.fetch(:testFlightInternalTestingOnly) == (branch == "dev")
    raise "External distribution enabled" unless check.calls.fetch(:upload_to_testflight).first[:distribute_external] == false
    check.run(:android)
    upload = check.calls.fetch(:upload_to_play_store).first
    expected = branch == "dev" ? ["internal", "completed"] : ["production", "draft"]
    raise "Wrong Google Play destination" unless upload.values_at(:track, :release_status) == expected
  end
  ENV["APP_VARIANT"] = "preview"
  rejects("Wrong app variant") { check.run(:ios) }
  ENV["RELEASE_BRANCH"] = "feature"
  rejects("dev or main") { check.run(:ios) }
  ENV.update("RELEASE_BRANCH" => "main", "APP_VARIANT" => "production")
  profile_file = File.join(directory, "0.mobileprovision")
  original = File.read(profile_file)
  expired = Plist.parse_xml(original)
  expired["ExpirationDate"] = Time.now - 3600
  File.write(profile_file, expired.to_plist)
  rejects("expired/non-store") { check.run(:ios) }
  raise "Uploaded with expired signing" if check.calls.key?(:upload_to_testflight)
  wrong_team = Plist.parse_xml(original)
  wrong_team["TeamIdentifier"] = ["OTHERTEAM"]
  File.write(profile_file, wrong_team.to_plist)
  rejects("Wrong team") { check.run(:ios) }
  File.write(profile_file, original)
  File.delete(File.join(directory, "3.mobileprovision"))
  rejects("Missing App Store profile") { check.run(:ios) }
  raise "Uploaded without extension signing" if check.calls.key?(:upload_to_testflight)
end
puts "Release lane checks passed (store and signing operations stubbed)."
