// safari-helper: persistent AppleScript daemon + CGEvent native click
// Replaces osascript subprocess (~80ms) with NSAppleScript in-process (~5ms)
// Also provides OS-level mouse clicks via CGEvent (produces isTrusted: true events)
//
// Input: JSON lines on stdin
//   {"script": "full applescript"}           — run AppleScript
//   {"click": {"x": 500, "y": 300, "windowId": 4127}}  — CGEvent click targeted to window
//   {"click": {"x": 500, "y": 300, "windowId": 4127, "double": true}}  — double-click
//   (windowId is optional — if omitted, falls back to global post)
// Output: JSON lines {"result": "..."} or {"error": "..."} on stdout

import Foundation
import Darwin
import CoreGraphics
import AppKit
import ScreenCaptureKit
import ImageIO

// ========== Disclaimed screen-capture process ==========

// Screen Recording authorization follows the responsible-process identity on
// macOS. Re-exec only the short-lived capture/preflight commands with
// responsibility disclaimed so every caller is attributed to this helper's
// stable signing identity rather than its editor/terminal process chain.
func reexecDisclaimedIfNeeded() -> String? {
  if getenv("SAFARI_HELPER_DISCLAIMED") != nil { return nil }

  let rawPath = CommandLine.arguments.first ?? "safari-helper"
  var executablePath = rawPath
  if let resolved = realpath(rawPath, nil) {
    executablePath = String(cString: resolved)
    free(resolved)
  }

  var attributes: posix_spawnattr_t?
  let initResult = posix_spawnattr_init(&attributes)
  guard initResult == 0 else {
    return "failed to initialize responsibility-disclaimed spawn attributes: \(initResult)"
  }
  defer { posix_spawnattr_destroy(&attributes) }

  guard let handle = dlopen(nil, RTLD_NOW) else {
    return "responsibility-disclaimed spawn API is unavailable"
  }
  defer { dlclose(handle) }
  guard let symbol = dlsym(handle, "responsibility_spawnattrs_setdisclaim") else {
    return "responsibility-disclaimed spawn API is unavailable"
  }
  typealias DisclaimFunction = @convention(c) (UnsafeMutablePointer<posix_spawnattr_t?>?, Int32) -> Int32
  let disclaim = unsafeBitCast(symbol, to: DisclaimFunction.self)
  let disclaimResult = disclaim(&attributes, 1)
  guard disclaimResult == 0 else {
    return "failed to disclaim screen-capture responsibility: \(disclaimResult)"
  }

  setenv("SAFARI_HELPER_DISCLAIMED", "1", 1)

  var arguments: [UnsafeMutablePointer<CChar>?] = CommandLine.arguments.map { strdup($0) }
  arguments.append(nil)
  defer { for argument in arguments where argument != nil { free(argument) } }

  var child: pid_t = 0
  let spawnResult = posix_spawn(&child, executablePath, nil, &attributes, arguments, environ)
  if spawnResult != 0 {
    unsetenv("SAFARI_HELPER_DISCLAIMED")
    return "failed to launch responsibility-disclaimed helper: \(spawnResult)"
  }

  var status: Int32 = 0
  var waitResult: pid_t
  repeat {
    waitResult = waitpid(child, &status, 0)
  } while waitResult == -1 && errno == EINTR
  if waitResult == -1 { exit(1) }
  let exitedNormally = (status & 0x7f) == 0
  exit(exitedNormally ? ((status >> 8) & 0xff) : 1)
}

func screenCapturePreflight() -> [String: Any] {
  _ = NSApplication.shared
  return [
    "result": "screen-preflight",
    "screenRecording": CGPreflightScreenCaptureAccess(),
    "responsibilityDisclaimed": getenv("SAFARI_HELPER_DISCLAIMED") != nil,
  ]
}

@available(macOS 14.0, *)
func captureWindowWithScreenCaptureKit(windowId: UInt32) -> (CGImage?, String?) {
  var capturedImage: CGImage?
  var captureError: String?
  let semaphore = DispatchSemaphore(value: 0)
  Task {
    do {
      let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
      guard let window = content.windows.first(where: { $0.windowID == windowId }) else {
        captureError = "window \(windowId) not found in shareable content"
        semaphore.signal()
        return
      }
      let filter = SCContentFilter(desktopIndependentWindow: window)
      let configuration = SCStreamConfiguration()
      let pixelScale = CGFloat(filter.pointPixelScale)
      configuration.width = max(1, Int((filter.contentRect.width * pixelScale).rounded()))
      configuration.height = max(1, Int((filter.contentRect.height * pixelScale).rounded()))
      configuration.showsCursor = false
      configuration.ignoreShadowsSingleWindow = true
      configuration.scalesToFit = false
      capturedImage = try await SCScreenshotManager.captureImage(
        contentFilter: filter,
        configuration: configuration
      )
    } catch {
      captureError = "capture: \(error.localizedDescription)"
    }
    semaphore.signal()
  }

  if semaphore.wait(timeout: .now() + 15) == .timedOut {
    return (nil, "capture timed out")
  }
  return (capturedImage, captureError)
}

// CGWindowListCreateImage was obsoleted in the macOS 15 SDK, but it remains
// the supported capture path on macOS 12-13. Resolve it dynamically so the
// helper keeps its macOS 12 deployment target without linking an obsolete API
// into the modern code path.
func captureWindowLegacy(windowId: UInt32) -> CGImage? {
  guard let handle = dlopen(
    "/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics",
    RTLD_LAZY
  ) else { return nil }
  defer { dlclose(handle) }
  guard let symbol = dlsym(handle, "CGWindowListCreateImage") else { return nil }

  typealias LegacyCaptureFunction = @convention(c) (
    CGRect,
    UInt32,
    UInt32,
    UInt32
  ) -> Unmanaged<CGImage>?
  let capture = unsafeBitCast(symbol, to: LegacyCaptureFunction.self)
  let listOptions = CGWindowListOption.optionIncludingWindow.rawValue
  let imageOptions = CGWindowImageOption.boundsIgnoreFraming.rawValue
    | CGWindowImageOption.bestResolution.rawValue
  return capture(.null, listOptions, windowId, imageOptions)?.takeRetainedValue()
}

func captureWindow(windowId: UInt32, toPath path: String) -> [String: Any] {
  _ = NSApplication.shared
  if !CGPreflightScreenCaptureAccess() {
    _ = CGRequestScreenCaptureAccess()
    return ["error": "__SCREENSHOT_PERMISSION_DENIED__"]
  }

  let image: CGImage?
  if #available(macOS 14.0, *) {
    let result = captureWindowWithScreenCaptureKit(windowId: windowId)
    if let error = result.1 { return ["error": error] }
    image = result.0
  } else {
    image = captureWindowLegacy(windowId: windowId)
  }
  guard let image else { return ["error": "capture returned no image"] }

  let url = URL(fileURLWithPath: path) as CFURL
  guard let destination = CGImageDestinationCreateWithURL(url, "public.png" as CFString, 1, nil) else {
    return ["error": "failed to create PNG destination"]
  }
  CGImageDestinationAddImage(destination, image, nil)
  guard CGImageDestinationFinalize(destination) else {
    return ["error": "failed to finalize PNG"]
  }
  return ["result": "captured window \(windowId) (\(image.width)x\(image.height)) -> \(path)"]
}

// ========== Accessibility preflight (issue #29) ==========
// Posting synthetic CGEvents requires Accessibility, and macOS 26 (Tahoe) tightened the
// post-event TCC grant. Without it, post()/postToPid SILENTLY no-op — yet the old code
// still returned a "clicked"/"hovered"/"key pressed" success, so the page never reacted
// and the agent had no idea. Check first and fail honestly so the Node layer can surface
// an actionable error instead of a phantom success.
func ensurePostEventAccess() -> [String: Any]? {
  if CGPreflightPostEventAccess() { return nil }
  // Triggers the one-time system Accessibility prompt for this binary; returns immediately
  // (does not block for the user's decision) and is a no-op once the choice is remembered.
  CGRequestPostEventAccess()
  return [
    "error": "accessibility-not-granted",
    "needsApproval": true,
    "hint": "Grant Accessibility to safari-helper: System Settings > Privacy & Security > Accessibility, then retry."
  ]
}

// ========== CGEvent Native Hover ==========
// Moves the mouse cursor to a target position to trigger native :hover / mouseenter
// without clicking. Used for revealing tooltips on obfuscated UIs (Discord sidebar,
// virtualized server lists, custom React tooltips) where JS-dispatched mouseenter
// events aren't enough because the rendering depends on CSS :hover or real pointer
// position. Optionally restores the original cursor position after dwell.
func performNativeHover(x: Double, y: Double, windowId: Int64 = 0, dwellMs: Int = 500, restoreMouse: Bool = true) -> [String: Any] {
  if let denied = ensurePostEventAccess() { return denied }
  let point = CGPoint(x: x, y: y)
  // nil when the cursor position can't be read (e.g. Accessibility just revoked) —
  // restoring to a fabricated (0,0) would visibly throw the cursor into the corner.
  let savedPosition = CGEvent(source: nil)?.location

  // Get Safari PID for process-targeted event posting (background hover, no focus steal)
  var safariPID: pid_t = 0
  if windowId > 0 {
    let ws = NSWorkspace.shared
    for app in ws.runningApplications {
      if app.bundleIdentifier == "com.apple.Safari" {
        safariPID = app.processIdentifier
        break
      }
    }
  }

  let kWindowField = CGEventField(rawValue: 91)! // windowUnderMousePointer
  let kWindowHandlerField = CGEventField(rawValue: 92)! // windowThatCanHandleThisEvent

  func postMove(_ position: CGPoint) {
    guard let ev = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: position, mouseButton: .left) else { return }
    if windowId > 0 && safariPID > 0 {
      ev.setIntegerValueField(kWindowField, value: windowId)
      ev.setIntegerValueField(kWindowHandlerField, value: windowId)
      ev.postToPid(safariPID)
    } else {
      ev.post(tap: .cghidEventTap)
    }
  }

  postMove(point)
  let ms = max(0, min(dwellMs, 5000)) // clamp 0-5000ms to prevent runaway blocking
  usleep(UInt32(ms * 1000))
  if restoreMouse, let savedPosition = savedPosition {
    postMove(savedPosition)
  }

  let targetInfo = windowId > 0 ? " (window \(windowId), background)" : ""
  return ["result": "hovered at (\(Int(x)),\(Int(y))) for \(ms)ms\(targetInfo)\(restoreMouse ? " (mouse restored)" : "")"]
}

// ========== CGEvent Native Click ==========
// Performs a REAL OS-level mouse click that produces isTrusted: true in the browser.
// Requires Accessibility permissions (same as AppleScript automation).

func performNativeClick(x: Double, y: Double, doubleClick: Bool = false, windowId: Int64 = 0) -> [String: Any] {
  if let denied = ensurePostEventAccess() { return denied }
  let point = CGPoint(x: x, y: y)

  // --- Window-targeted click ---
  // When windowId is provided, we set CGEventField.windowNumber on the event.
  // This sends the click to the specific window WITHOUT moving the physical mouse
  // and WITHOUT bringing Safari to the foreground.
  // When windowId is 0 (not provided), fall back to global post (legacy behavior).

  // Get Safari PID for process-targeted event posting (when windowId is set)
  var safariPID: pid_t = 0
  if windowId > 0 {
    let ws = NSWorkspace.shared
    for app in ws.runningApplications {
      if app.bundleIdentifier == "com.apple.Safari" {
        safariPID = app.processIdentifier
        break
      }
    }
    if safariPID == 0 {
      return ["error": "Safari process not found"]
    }
  }

  // Helper: configure event with window targeting
  // kCGMouseEventWindowUnderMousePointer = 91 (not bridged to Swift CGEventField)
  // kCGMouseEventWindowUnderMousePointerThatCanHandleThisEvent = 92
  let kWindowField = CGEventField(rawValue: 91)! // windowUnderMousePointer
  let kWindowHandlerField = CGEventField(rawValue: 92)! // windowThatCanHandleThisEvent

  func configureEvent(_ event: CGEvent) {
    if windowId > 0 {
      // Target the specific window — the event goes to that window
      // even if it's behind other windows, and the mouse stays where it is.
      event.setIntegerValueField(kWindowField, value: windowId)
      event.setIntegerValueField(kWindowHandlerField, value: windowId)
    }
  }

  // Helper: post event — to Safari process if targeted, global otherwise
  func postEvent(_ event: CGEvent) {
    if windowId > 0 {
      event.postToPid(safariPID)
    } else {
      event.post(tap: .cghidEventTap)
    }
  }

  if windowId == 0 {
    // Legacy path: no window targeting. Move mouse + restore (old behavior).
    // Optional: when the position can't be read, skip the restore instead of
    // jumping the cursor to a fabricated (0,0).
    let savedPosition = CGEvent(source: nil)?.location
    defer {
      if let savedPosition = savedPosition,
         let restoreEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: savedPosition, mouseButton: .left) {
        restoreEvent.post(tap: .cghidEventTap)
      }
    }
    guard let moveEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left) else {
      return ["error": "Failed to create mouse move event"]
    }
    moveEvent.post(tap: .cghidEventTap)
    usleep(20_000)
  }
  // When windowId > 0, we do NOT move the mouse at all.

  // Create mouse down/up events at the target coordinates
  guard let downEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left) else {
    return ["error": "Failed to create mouse down event"]
  }
  guard let upEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left) else {
    return ["error": "Failed to create mouse up event"]
  }
  configureEvent(downEvent)
  configureEvent(upEvent)

  if doubleClick {
    // First click
    downEvent.setIntegerValueField(.mouseEventClickState, value: 1)
    upEvent.setIntegerValueField(.mouseEventClickState, value: 1)
    postEvent(downEvent)
    usleep(50_000)
    postEvent(upEvent)
    usleep(50_000)

    // Second click
    guard let down2 = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left) else {
      return ["error": "Failed to create second mouse down event"]
    }
    guard let up2 = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left) else {
      return ["error": "Failed to create second mouse up event"]
    }
    configureEvent(down2)
    configureEvent(up2)
    down2.setIntegerValueField(.mouseEventClickState, value: 2)
    up2.setIntegerValueField(.mouseEventClickState, value: 2)
    postEvent(down2)
    usleep(50_000)
    postEvent(up2)
  } else {
    // Single click
    downEvent.setIntegerValueField(.mouseEventClickState, value: 1)
    upEvent.setIntegerValueField(.mouseEventClickState, value: 1)
    postEvent(downEvent)
    usleep(50_000)
    postEvent(upEvent)
  }

  let targetInfo = windowId > 0 ? " (window \(windowId), background)" : ""
  return ["result": "clicked at (\(Int(x)),\(Int(y)))\(doubleClick ? " (double)" : "")\(targetInfo)"]
}

// ========== CGEvent Native Keyboard ==========
// Sends keyboard events (keystrokes, shortcuts) targeted to a specific window
// WITHOUT activating Safari or stealing focus. Same principle as native click.

func performNativeKeyboard(keyCode: UInt16, flags: CGEventFlags = [], windowId: Int64 = 0) -> [String: Any] {
  if let denied = ensurePostEventAccess() { return denied }
  // Get Safari PID
  var safariPID: pid_t = 0
  if windowId > 0 {
    let ws = NSWorkspace.shared
    for app in ws.runningApplications {
      if app.bundleIdentifier == "com.apple.Safari" {
        safariPID = app.processIdentifier
        break
      }
    }
    if safariPID == 0 {
      return ["error": "Safari process not found"]
    }
  }

  let kWindowField = CGEventField(rawValue: 91)!
  let kWindowHandlerField = CGEventField(rawValue: 92)!

  guard let keyDown = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true) else {
    return ["error": "Failed to create key down event"]
  }
  guard let keyUp = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false) else {
    return ["error": "Failed to create key up event"]
  }

  keyDown.flags = flags
  keyUp.flags = flags

  if windowId > 0 {
    keyDown.setIntegerValueField(kWindowField, value: windowId)
    keyDown.setIntegerValueField(kWindowHandlerField, value: windowId)
    keyUp.setIntegerValueField(kWindowField, value: windowId)
    keyUp.setIntegerValueField(kWindowHandlerField, value: windowId)
    keyDown.postToPid(safariPID)
    usleep(30_000)
    keyUp.postToPid(safariPID)
  } else {
    keyDown.post(tap: .cghidEventTap)
    usleep(30_000)
    keyUp.post(tap: .cghidEventTap)
  }

  let targetInfo = windowId > 0 ? " (window \(windowId), background)" : ""
  return ["result": "key \(keyCode) pressed\(targetInfo)"]
}

// ========== Response Helper ==========

func respond(_ obj: [String: Any]) {
  if let data = try? JSONSerialization.data(withJSONObject: obj),
     let str = String(data: data, encoding: .utf8) {
    print(str)
  } else {
    print("{\"error\":\"serialization failed\"}")
  }
  fflush(stdout)
}

let args = CommandLine.arguments

// ========== CLI Mode: Screen Recording preflight ==========
// Runs under the exact responsibility-disclaimed identity used by capture.
if args.count >= 2 && args[1] == "--screen-preflight" {
  if let error = reexecDisclaimedIfNeeded() {
    respond(["error": error])
    exit(1)
  }
  respond(screenCapturePreflight())
  exit(0)
}

// ========== CLI Mode: --screenshot <windowId> <outPath> ==========
if args.count >= 2 && args[1] == "--screenshot" {
  guard args.count >= 4, let windowId = UInt32(args[2]) else {
    respond(["error": "usage: safari-helper --screenshot <windowId> <outPath>"])
    exit(2)
  }
  if let error = reexecDisclaimedIfNeeded() {
    respond(["error": error])
    exit(1)
  }
  let result = captureWindow(windowId: windowId, toPath: args[3])
  respond(result)
  if let error = result["error"] as? String {
    exit(error == "__SCREENSHOT_PERMISSION_DENIED__" ? 3 : 1)
  }
  exit(0)
}

// ========== CLI Mode: --click X Y [--window WID] [--double] ==========
// For direct invocation: safari-helper --click 500 300 --window 4127
if args.count >= 4 && args[1] == "--click" {
  guard let x = Double(args[2]), let y = Double(args[3]) else {
    respond(["error": "Invalid coordinates: \(args[2]) \(args[3])"])
    exit(1)
  }
  var isDouble = false
  var windowId: Int64 = 0
  var i = 4
  while i < args.count {
    if args[i] == "--double" {
      isDouble = true
    } else if args[i] == "--window" && i + 1 < args.count {
      windowId = Int64(args[i + 1]) ?? 0
      i += 1
    }
    i += 1
  }
  let result = performNativeClick(x: x, y: y, doubleClick: isDouble, windowId: windowId)
  respond(result)
  exit(result["error"] != nil ? 1 : 0)
}

// ========== CLI Mode: --paste --window WID ==========
// Convenience: Cmd+V via CGEvent (no activate needed)
if args.count >= 2 && args[1] == "--paste" {
  var windowId: Int64 = 0
  var i = 2
  while i < args.count {
    if args[i] == "--window" && i + 1 < args.count {
      windowId = Int64(args[i + 1]) ?? 0
      i += 1
    }
    i += 1
  }
  // keyCode 9 = V key
  let result = performNativeKeyboard(keyCode: 9, flags: .maskCommand, windowId: windowId)
  respond(result)
  exit(result["error"] != nil ? 1 : 0)
}

// ========== Daemon Mode: JSON lines on stdin ==========

// Counts AppleScript executions currently blocked inside executeAndReturnError.
// Each 30s timeout leaves its GCD thread stuck there, and the global pool is
// finite (~64 threads): past a small threshold the daemon exits so the Node
// watchdog respawns a clean one instead of degrading into a wedged process
// that accepts stdin but can no longer dispatch work.
let _inFlightLock = NSLock()
var _inFlightScripts = 0

func handleLine(_ line: String) {
  guard !line.isEmpty else { return }

  guard let data = line.data(using: .utf8),
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
    respond(["error": "invalid input"])
    return
  }

  // Handle CGEvent click command
  if let clickData = json["click"] as? [String: Any],
     let x = clickData["x"] as? Double,
     let y = clickData["y"] as? Double {
    let isDouble = (clickData["double"] as? Bool) ?? false
    let windowId = Int64((clickData["windowId"] as? Int) ?? 0)
    respond(performNativeClick(x: x, y: y, doubleClick: isDouble, windowId: windowId))
    return
  }

  // Handle CGEvent hover command — native mouse move to trigger real :hover / mouseenter
  // {"hover": {"x": 500, "y": 300, "windowId": 4127, "dwellMs": 500, "restoreMouse": true}}
  if let hoverData = json["hover"] as? [String: Any],
     let x = hoverData["x"] as? Double,
     let y = hoverData["y"] as? Double {
    let windowId = Int64((hoverData["windowId"] as? Int) ?? 0)
    let dwellMs = (hoverData["dwellMs"] as? Int) ?? 500
    let restoreMouse = (hoverData["restoreMouse"] as? Bool) ?? true
    respond(performNativeHover(x: x, y: y, windowId: windowId, dwellMs: dwellMs, restoreMouse: restoreMouse))
    return
  }

  // Handle CGEvent keyboard command
  // {"keyboard": {"keyCode": 9, "flags": ["cmd"], "windowId": 4127}}
  // keyCode 9 = V, flags: cmd/shift/alt/ctrl
  if let kbData = json["keyboard"] as? [String: Any],
     let keyCode = kbData["keyCode"] as? Int {
    // CGEvent virtualKey is UInt16 — a JSON value outside 0...65535 would trap the daemon
    // on the UInt16() conversion below. Validate before converting.
    guard keyCode >= 0 && keyCode <= 0xFFFF else {
      respond(["error": "keyCode out of range (0-65535): \(keyCode)"])
      return
    }
    let windowId = Int64((kbData["windowId"] as? Int) ?? 0)
    var flags: CGEventFlags = []
    if let flagNames = kbData["flags"] as? [String] {
      for f in flagNames {
        switch f.lowercased() {
          case "cmd": flags.insert(.maskCommand)
          case "shift": flags.insert(.maskShift)
          case "alt", "option": flags.insert(.maskAlternate)
          case "ctrl", "control": flags.insert(.maskControl)
          default: break
        }
      }
    }
    respond(performNativeKeyboard(keyCode: UInt16(keyCode), flags: flags, windowId: windowId))
    return
  }

  // Handle preflight — report permission state WITHOUT acting. Used by safari_doctor
  // to turn the silent-failure permission chain into an actionable checklist (issue #29/#14/#15).
  if json["preflight"] != nil {
    respond([
      "result": "preflight",
      "accessibility": CGPreflightPostEventAccess(),
      "screenRecording": CGPreflightScreenCaptureAccess()
    ])
    return
  }

  // Handle getFrontApp — returns frontmost application bundle ID (native, ~0.1ms)
  if json["getFrontApp"] != nil {
    let frontApp = NSWorkspace.shared.frontmostApplication
    respond(["result": frontApp?.localizedName ?? "", "bundleId": frontApp?.bundleIdentifier ?? ""])
    return
  }

  // Handle activateApp — activate a specific app by bundle ID (native, ~1ms)
  // Used to restore focus to previous app instead of hiding Safari (less jarring)
  if let bundleId = json["activateApp"] as? String {
    if let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first {
      app.activate()
      respond(["result": "activated"])
    } else {
      respond(["error": "app not found: \(bundleId)"])
    }
    return
  }

  // Handle hideSafari — hide Safari to prevent focus stealing (native, ~1ms)
  if json["hideSafari"] != nil {
    if let safariApp = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Safari").first {
      safariApp.hide()
      respond(["result": "hidden"])
    } else {
      respond(["error": "Safari not running"])
    }
    return
  }

  // Handle AppleScript command
  guard let script = json["script"] as? String else {
    respond(["error": "invalid input — expected 'script', 'click', 'keyboard', 'getFrontApp', or 'hideSafari'"])
    return
  }

  // Focus preservation is handled by the Node.js layer (osascript() function
  // and extensionOrFallback). The daemon must NOT manage focus — it runs every
  // 3 seconds for background checks, and restoring focus here steals Safari
  // from the user whenever they switch to it.

  guard let nsScript = NSAppleScript(source: script) else {
    respond(["error": "failed to compile AppleScript"])
    return
  }

  // Execute on a background thread to avoid blocking stdin reading.
  // Heavy pages (SourceForge, etc.) can cause executeAndReturnError() to block
  // for 10-30+ seconds, preventing ALL subsequent commands from being read.
  _inFlightLock.lock()
  let alreadyStuck = _inFlightScripts
  _inFlightLock.unlock()
  if alreadyStuck >= 8 {
    respond(["error": "daemon wedged: \(alreadyStuck) AppleScript executions still blocked past their timeout — exiting for a clean respawn"])
    exit(1)
  }

  let semaphore = DispatchSemaphore(value: 0)
  var scriptResult: NSAppleEventDescriptor?
  var scriptError: NSDictionary?

  _inFlightLock.lock(); _inFlightScripts += 1; _inFlightLock.unlock()
  DispatchQueue.global(qos: .userInitiated).async {
    var errorDict: NSDictionary?
    scriptResult = nsScript.executeAndReturnError(&errorDict)
    scriptError = errorDict
    _inFlightLock.lock(); _inFlightScripts -= 1; _inFlightLock.unlock()
    semaphore.signal()
  }

  // Wait up to 30 seconds for the script to complete.
  // If it times out, respond with error but don't block the loop forever.
  let waitResult = semaphore.wait(timeout: .now() + 30.0)

  if waitResult == .timedOut {
    respond(["error": "AppleScript execution timed out (30s)"])
  } else if let error = scriptError {
    let msg = (error["NSAppleScriptErrorMessage"] as? String) ?? "AppleScript error"
    respond(["error": msg])
  } else {
    respond(["result": scriptResult?.stringValue ?? ""])
  }
}

while let line = readLine(strippingNewline: true) {
  // Command-line Swift has no runloop, so the implicit top-level autorelease pool
  // never drains — every NSAppleScript / NSDictionary allocated per command was
  // retained until process exit. Drain per command.
  autoreleasepool { handleLine(line) }
}

// stdin closed — the parent Node process is gone (clean shutdown or crash). GCD
// threads still blocked inside executeAndReturnError would keep this process alive
// as an orphan holding Apple Events / Accessibility grants; with no parent left to
// read results there is nothing useful to finish. Exit explicitly.
exit(0)
