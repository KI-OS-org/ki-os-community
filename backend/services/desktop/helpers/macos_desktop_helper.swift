import Foundation
import AppKit
import CoreGraphics

func jsonOutput(_ obj: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: obj, options: []), let s = String(data: data, encoding: .utf8) {
        print(s)
    } else {
        print("{\"success\":false,\"error\":\"json_output_failed\"}")
    }
}

func frontmost() -> (String?, String?) {
    let app = NSWorkspace.shared.frontmostApplication?.localizedName
    return (app, nil) // window title requires Accessibility API (kAXTitleAttribute)
}

func idleMs() -> Int {
    let source = CGEventSource(stateID: .combinedSessionState)
    let secs = source?.secondsSinceLastEventType(.mouseMoved) ?? source?.secondsSinceLastEventType(.leftMouseDown) ?? 9999
    return Int(secs * 1000.0)
}

func saveScreenshot(_ target: String) throws {
    guard let image = CGDisplayCreateImage(CGMainDisplayID()) else {
        throw NSError(domain: "desktop", code: 1, userInfo: [NSLocalizedDescriptionKey: "screenshot_failed"])
    }
    let rep = NSBitmapImageRep(cgImage: image)
    guard let data = rep.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "desktop", code: 2, userInfo: [NSLocalizedDescriptionKey: "png_encoding_failed"])
    }
    try data.write(to: URL(fileURLWithPath: target))
}

func postMouse(type: CGEventType, x: Double, y: Double, button: CGMouseButton = .left) {
    let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: CGPoint(x: x, y: y), mouseButton: button)
    event?.post(tap: .cghidEventTap)
}

func keyCode(for key: String) -> CGKeyCode {
    switch key.lowercased() {
    case "enter": return 36
    case "tab": return 48
    case "space": return 49
    case "escape", "esc": return 53
    case "left": return 123
    case "right": return 124
    case "down": return 125
    case "up": return 126
    default: return 36
    }
}

func postKey(_ code: CGKeyCode, down: Bool, flags: CGEventFlags = []) {
    let event = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: down)
    event?.flags = flags
    event?.post(tap: .cghidEventTap)
}

func typeText(_ text: String) {
    for scalar in text.unicodeScalars {
        let down = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true)
        down?.keyboardSetUnicodeString(stringLength: 1, unicodeString: [scalar.value])
        let up = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false)
        up?.keyboardSetUnicodeString(stringLength: 1, unicodeString: [scalar.value])
        down?.post(tap: .cghidEventTap)
        usleep(20000)
        up?.post(tap: .cghidEventTap)
        usleep(20000)
    }
}

func flags(for keys: [String]) -> CGEventFlags {
    var f: CGEventFlags = []
    for key in keys {
        switch key.lowercased() {
        case "cmd", "command", "win": f.insert(.maskCommand)
        case "shift": f.insert(.maskShift)
        case "alt", "option": f.insert(.maskAlternate)
        case "ctrl", "control": f.insert(.maskControl)
        default: break
        }
    }
    return f
}

let args = CommandLine.arguments
let jsonArg = args.count > 1 ? args[1] : "{}"
let data = jsonArg.data(using: .utf8) ?? Data()
let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
let mode = payload["mode"] as? String ?? "status"
let (app, title) = frontmost()
var result: [String: Any] = [
    "success": true,
    "platform": "darwin",
    "adapter": "macos-swift",
    "frontmostApp": app as Any,
    "activeWindowTitle": title as Any,
    "idleMs": idleMs()
]

do {
    if mode == "status" {
        let threshold = payload["userActiveThresholdMs"] as? Int ?? 250
        result["userActive"] = (result["idleMs"] as? Int ?? 9999) < threshold
        jsonOutput(result)
        exit(0)
    }
    if mode == "screenshot" {
        let target = payload["target"] as? String ?? "/tmp/desktop-screenshot.png"
        try saveScreenshot(target)
        result["path"] = target
        jsonOutput(result)
        exit(0)
    }
    if mode == "action" {
        let action = payload["action"] as? String ?? ""
        let x = payload["x"] as? Double ?? Double(payload["x"] as? Int ?? 0)
        let y = payload["y"] as? Double ?? Double(payload["y"] as? Int ?? 0)
        if action == "move" {
            CGWarpMouseCursorPosition(CGPoint(x: x, y: y))
        } else if action == "click" || action == "rightClick" || action == "doubleClick" {
            let button: CGMouseButton = action == "rightClick" ? .right : .left
            let downType: CGEventType = action == "rightClick" ? .rightMouseDown : .leftMouseDown
            let upType: CGEventType = action == "rightClick" ? .rightMouseUp : .leftMouseUp
            postMouse(type: .mouseMoved, x: x, y: y, button: button)
            postMouse(type: downType, x: x, y: y, button: button)
            postMouse(type: upType, x: x, y: y, button: button)
            if action == "doubleClick" {
                usleep(80000)
                postMouse(type: downType, x: x, y: y, button: button)
                postMouse(type: upType, x: x, y: y, button: button)
            }
        } else if action == "drag" {
            let toX = payload["toX"] as? Double ?? Double(payload["toX"] as? Int ?? 0)
            let toY = payload["toY"] as? Double ?? Double(payload["toY"] as? Int ?? 0)
            let steps = max(payload["steps"] as? Int ?? 12, 3)
            postMouse(type: .leftMouseDown, x: x, y: y)
            for i in 1...steps {
                let nx = x + ((toX - x) * Double(i) / Double(steps))
                let ny = y + ((toY - y) * Double(i) / Double(steps))
                postMouse(type: .leftMouseDragged, x: nx, y: ny)
                usleep(15000)
            }
            postMouse(type: .leftMouseUp, x: toX, y: toY)
        } else if action == "scroll" {
            let delta = payload["delta"] as? Int ?? 120
            let event = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1, wheel1: Int32(delta), wheel2: 0, wheel3: 0)
            event?.post(tap: .cghidEventTap)
        } else if action == "type" {
            let text = payload["text"] as? String ?? ""
            typeText(text)
        } else if action == "key" {
            let key = payload["key"] as? String ?? "enter"
            let code = keyCode(for: key)
            postKey(code, down: true)
            usleep(20000)
            postKey(code, down: false)
        } else if action == "hotkey" {
            let keys = payload["keys"] as? [String] ?? []
            let main = keys.last ?? "enter"
            let code = keyCode(for: main)
            let f = flags(for: keys)
            postKey(code, down: true, flags: f)
            usleep(20000)
            postKey(code, down: false, flags: f)
        } else if action == "wait" {
            let durationMs = payload["durationMs"] as? Int ?? 100
            usleep(useconds_t(durationMs * 1000))
        } else {
            throw NSError(domain: "desktop", code: 3, userInfo: [NSLocalizedDescriptionKey: "unsupported_action:\(action)"])
        }
        result["action"] = action
        jsonOutput(result)
        exit(0)
    }
    throw NSError(domain: "desktop", code: 4, userInfo: [NSLocalizedDescriptionKey: "unsupported_mode"])
} catch {
    jsonOutput(["success": false, "error": error.localizedDescription, "platform": "darwin", "adapter": "macos-swift"])
    exit(1)
}
