import React, { createContext, useContext, useState, useCallback } from 'react';

// Shared by anything that needs the bottom tab bar out of the way — coach
// chat originally, the dashboard spotlight tour now. One flag each rather
// than a single "hideTabBar" boolean so each feature owns its own lifecycle.
interface CoachNavContextValue {
  coachActive: boolean;
  setCoachActive: (v: boolean) => void;
  tourActive: boolean;
  setTourActive: (v: boolean) => void;
}

const CoachNavContext = createContext<CoachNavContextValue>({
  coachActive: false,
  setCoachActive: () => {},
  tourActive: false,
  setTourActive: () => {},
});

export function CoachNavProvider({ children }: { children: React.ReactNode }) {
  const [coachActive, setCoachActiveState] = useState(false);
  const setCoachActive = useCallback((v: boolean) => setCoachActiveState(v), []);
  const [tourActive, setTourActiveState] = useState(false);
  const setTourActive = useCallback((v: boolean) => setTourActiveState(v), []);
  return (
    <CoachNavContext.Provider value={{ coachActive, setCoachActive, tourActive, setTourActive }}>
      {children}
    </CoachNavContext.Provider>
  );
}

export function useCoachNav() {
  return useContext(CoachNavContext);
}
