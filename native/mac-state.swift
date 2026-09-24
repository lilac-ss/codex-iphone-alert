import AppKit
import CoreGraphics
import Foundation

// No Accessibility/Apple Events access, window titles, or session identifiers.
func snapshot() -> [String: Any] {
    let session = CGSessionCopyCurrentDictionary() as? [String: Any]
    let front = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
    let locked = session?["CGSSessionScreenIsLocked"] as? Bool
    let onConsole = session?[kCGSessionOnConsoleKey as String] as? Bool
    let loggedIn = session?[kCGSessionLoginDoneKey as String] as? Bool
    var result: [String: Any] = ["codexFront": front.map { $0 == "com.openai.codex" } ?? NSNull() as Any]
    // CGSession omits ScreenIsLocked in an unlocked, active GUI session.
    // Only accept that documented-in-project observation together with both
    // positive session flags; a failed/partial dictionary stays unknown.
    if locked == true || onConsole == false || front == "com.apple.loginwindow" {
        result["locked"] = true
    } else if locked == false || (session != nil && onConsole == true && loggedIn == true) {
        result["locked"] = false
    } else {
        result["locked"] = NSNull()
    }
    return result
}
if let data = try? JSONSerialization.data(withJSONObject: snapshot(), options: [.sortedKeys]),
   let text = String(data: data, encoding: .utf8) { print(text) }
