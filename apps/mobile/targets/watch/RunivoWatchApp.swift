// L4: Runivo on the wrist. The phone records GPS and scores the run; the
// watch shows the live numbers and sends Start / Pause / Resume / End.
import SwiftUI
import WatchConnectivity

@main
struct RunivoWatchApp: App {
  @StateObject private var link = PhoneLink()
  var body: some Scene {
    WindowGroup { RunView().environmentObject(link) }
  }
}

final class PhoneLink: NSObject, ObservableObject, WCSessionDelegate {
  @Published var phase = "ready"
  @Published var distance = "0.00"
  @Published var unit = "km"
  @Published var time = "0:00"
  @Published var pace = "–:––"
  @Published var paceLabel = "Pace /km"
  @Published var zone = ""
  @Published var reachable = false

  override init() {
    super.init()
    if WCSession.isSupported() {
      WCSession.default.delegate = self
      WCSession.default.activate()
    }
  }

  func send(_ command: String) {
    guard WCSession.default.isReachable else { return }
    WCSession.default.sendMessage(["command": command], replyHandler: nil, errorHandler: nil)
    WKInterfaceDevice.current().play(.click)
  }

  private func apply(_ s: [String: Any]) {
    DispatchQueue.main.async {
      self.phase = s["phase"] as? String ?? self.phase
      self.distance = s["distance"] as? String ?? self.distance
      self.unit = s["unit"] as? String ?? self.unit
      self.time = s["time"] as? String ?? self.time
      self.pace = s["pace"] as? String ?? self.pace
      self.paceLabel = s["paceLabel"] as? String ?? self.paceLabel
      self.zone = s["zone"] as? String ?? ""
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    DispatchQueue.main.async { self.reachable = session.isReachable }
    apply(session.receivedApplicationContext)
  }
  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async { self.reachable = session.isReachable }
  }
  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { apply(message) }
  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) { apply(applicationContext) }
}

struct RunView: View {
  @EnvironmentObject var link: PhoneLink
  private let red = Color(red: 1.0, green: 0.27, blue: 0.09)

  var body: some View {
    VStack(spacing: 4) {
      if !link.reachable && link.phase == "ready" {
        Text("Open Runivo on your phone to start").font(.footnote).multilineTextAlignment(.center).foregroundStyle(.secondary)
      }
      Text(link.distance).font(.system(size: 44, weight: .heavy, design: .rounded)).monospacedDigit()
      Text(link.unit).font(.caption2).foregroundStyle(.secondary)
      HStack {
        VStack { Text(link.time).font(.headline).monospacedDigit(); Text("Time").font(.caption2).foregroundStyle(.secondary) }
        Spacer()
        VStack { Text(link.pace).font(.headline).monospacedDigit(); Text(link.paceLabel).font(.caption2).foregroundStyle(.secondary) }
      }
      if !link.zone.isEmpty { Text(link.zone).font(.caption2).foregroundStyle(red) }
      Spacer(minLength: 4)
      controls
    }
    .padding(.horizontal, 6)
  }

  @ViewBuilder private var controls: some View {
    switch link.phase {
    case "running":
      Button("Pause") { link.send("pause") }.tint(.yellow)
    case "paused":
      HStack {
        Button("Resume") { link.send("resume") }.tint(.green)
        Button("End") { link.send("end") }.tint(red)
      }
    case "done":
      Text("Saved on your phone").font(.footnote).foregroundStyle(.secondary)
    default:
      Button("Start") { link.send("start") }.tint(red).disabled(!link.reachable)
    }
  }
}
