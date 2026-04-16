import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { haptic } from "@shared/lib/haptics";

interface TrainingCalendarProps {
  /** Array of runs with startTime (unix ms) and distanceMeters */
  runs: { startTime: number; distanceMeters: number }[];
}

const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

const LEGEND = [
  { label: "Rest", color: "bg-gray-50" },
  { label: "Light", color: "bg-[#FEF0EE]" },
  { label: "Medium", color: "bg-[#D93518]/40" },
  { label: "Hard", color: "bg-[#D93518]" },
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthName(month: number): string {
  return [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][month];
}

function getIntensity(distanceMeters: number): "rest" | "light" | "medium" | "hard" {
  if (distanceMeters <= 0) return "rest";
  const km = distanceMeters / 1000;
  if (km < 3) return "light";
  if (km <= 7) return "medium";
  return "hard";
}

export default function TrainingCalendar({ runs }: TrainingCalendarProps) {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [direction, setDirection] = useState(0);

  const distanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const run of runs) {
      const date = new Date(run.startTime);
      const key = formatDateKey(date);
      map[key] = (map[key] || 0) + run.distanceMeters;
    }
    return map;
  }, [runs]);

  const { cells, totalRuns, totalKm } = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfWeek(currentYear, currentMonth);
    const grid: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      grid.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      grid.push(d);
    }

    let runs = 0;
    let km = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dist = distanceMap[key] || 0;
      if (dist > 0) {
        runs++;
        km += dist / 1000;
      }
    }

    return { cells: grid, totalRuns: runs, totalKm: km };
  }, [currentYear, currentMonth, distanceMap]);

  const todayKey = formatDateKey(now);

  function navigateMonth(delta: number) {
    haptic();
    setDirection(delta);
    let newMonth = currentMonth + delta;
    let newYear = currentYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => navigateMonth(-1)}
          className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-900">
          {getMonthName(currentMonth)} {currentYear}
        </span>
        <button
          onClick={() => navigateMonth(1)}
          className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map((d, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-[10px] text-gray-400 font-medium"
            style={{ width: 36, height: 20 }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${currentYear}-${currentMonth}`}
          initial={{ opacity: 0, x: direction * 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -20 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-7 gap-1"
        >
          {cells.map((day, i) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${i}`}
                  className="bg-transparent"
                  style={{ width: 36, height: 36 }}
                />
              );
            }

            const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const distance = distanceMap[dateKey] || 0;
            const intensity = getIntensity(distance);
            const isToday = dateKey === todayKey;

            let bgClass = "bg-gray-50";
            let textClass = "text-gray-600";
            if (intensity === "light") {
              bgClass = "bg-[#FEF0EE]";
              textClass = "text-[#B82D14]";
            } else if (intensity === "medium") {
              bgClass = "bg-[#D93518]/40";
              textClass = "text-[#B82D14]";
            } else if (intensity === "hard") {
              bgClass = "bg-[#D93518]";
              textClass = "text-white";
            }

            const ringClass = isToday ? "ring-2 ring-[#D93518] ring-offset-1" : "";

            return (
              <div
                key={dateKey}
                className={`flex items-center justify-center rounded-lg text-xs font-medium ${bgClass} ${textClass} ${ringClass}`}
                style={{ width: 36, height: 36 }}
              >
                {day}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-3">
        {LEGEND.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-[10px] text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Monthly summary */}
      <p className="text-xs text-gray-500 text-center mt-2">
        {totalRuns} runs · {totalKm.toFixed(1)} km
      </p>
    </div>
  );
}
