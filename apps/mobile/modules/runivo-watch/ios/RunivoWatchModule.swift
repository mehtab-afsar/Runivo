// L4, phone side: sends the live run to the Runivo watch app and receives its
// Start / Pause / Resume / End taps. The phone keeps recording GPS.
import ExpoModulesCore
import WatchConnectivity

public class RunivoWatchModule: Module {
  private let bridge = WatchBridge()

  public func definition() -> ModuleDefinition {
    Name("RunivoWatch")
    Events("onCommand")

    OnCreate {
      self.bridge.onCommand = { [weak self] command in
        self?.sendEvent("onCommand", ["command": command])
      }
      self.bridge.activate()
    }

    Function("isAvailable") { () -> Bool in
      return WCSession.isSupported() && WCSession.default.isPaired && WCSession.default.isWatchAppInstalled
    }

    // The latest run state: replaces the previous one on the watch.
    Function("sendState") { (state: [String: Any]) in
      self.bridge.send(state)
    }
  }
}

final class WatchBridge: NSObject, WCSessionDelegate {
  var onCommand: ((String) -> Void)?

  func activate() {
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func send(_ state: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let s = WCSession.default
    guard s.activationState == .activated, s.isPaired, s.isWatchAppInstalled else { return }
    if s.isReachable {
      s.sendMessage(state, replyHandler: nil, errorHandler: nil)
    } else {
      try? s.updateApplicationContext(state)
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    if let c = message["command"] as? String { DispatchQueue.main.async { self.onCommand?(c) } }
  }
}
