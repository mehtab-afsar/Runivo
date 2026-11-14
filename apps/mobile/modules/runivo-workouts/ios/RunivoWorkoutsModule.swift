// T7: put a Runivo training session on the runner's Apple Watch (Workout app)
// with WorkoutKit. iOS 17+; on older iOS `isSupported` is false and the
// button stays hidden.
import ExpoModulesCore
import HealthKit
#if canImport(WorkoutKit)
import WorkoutKit
#endif

struct StepRecord: Record {
  @Field var kind: String = "run"        // warmup | run | recover | cooldown
  @Field var distanceM: Double? = nil
  @Field var durationSec: Double? = nil
}

struct SessionRecord: Record {
  @Field var title: String = "Runivo session"
  @Field var date: String = ""           // YYYY-MM-DD, local
  @Field var steps: [StepRecord] = []
}

public class RunivoWorkoutsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RunivoWorkouts")

    AsyncFunction("isSupported") { () -> Bool in
      #if canImport(WorkoutKit)
      if #available(iOS 17.0, *) { return WorkoutScheduler.isSupported }
      #endif
      return false
    }

    AsyncFunction("schedule") { (session: SessionRecord) async throws -> Bool in
      #if canImport(WorkoutKit)
      if #available(iOS 17.0, *) {
        guard WorkoutScheduler.isSupported else { return false }
        let state = await WorkoutScheduler.shared.requestAuthorization()
        guard state == .authorized else { return false }

        func goal(_ s: StepRecord) -> WorkoutGoal {
          if let m = s.distanceM, m > 0 { return .distance(m, .meters) }
          if let t = s.durationSec, t > 0 { return .time(t, .seconds) }
          return .open
        }

        var warmup: WorkoutStep? = nil
        var cooldown: WorkoutStep? = nil
        var intervalSteps: [IntervalStep] = []
        for s in session.steps {
          switch s.kind {
          case "warmup": warmup = WorkoutStep(goal: goal(s))
          case "cooldown": cooldown = WorkoutStep(goal: goal(s))
          case "recover":
            intervalSteps.append(IntervalStep(.recovery, goal: goal(s)))
          default:
            intervalSteps.append(IntervalStep(.work, goal: goal(s)))
          }
        }
        let blocks = intervalSteps.isEmpty ? [] : [IntervalBlock(steps: intervalSteps, iterations: 1)]
        let workout = CustomWorkout(
          activity: .running,
          location: .outdoor,
          displayName: String(session.title.prefix(40)),
          warmup: warmup,
          blocks: blocks,
          cooldown: cooldown
        )

        let parts = session.date.split(separator: "-").compactMap { Int($0) }
        var when = DateComponents()
        if parts.count == 3 { when.year = parts[0]; when.month = parts[1]; when.day = parts[2]; when.hour = 7 }
        try await WorkoutScheduler.shared.schedule(WorkoutPlan(.custom(workout)), at: when)
        return true
      }
      #endif
      return false
    }
  }
}
