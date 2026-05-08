import React, { createContext, useContext, useState, useCallback } from 'react';

interface CoachNavContextValue {
  coachActive: boolean;
  setCoachActive: (v: boolean) => void;
}

const CoachNavContext = createContext<CoachNavContextValue>({
  coachActive: false,
  setCoachActive: () => {},
});

export function CoachNavProvider({ children }: { children: React.ReactNode }) {
  const [coachActive, setCoachActiveState] = useState(false);
  const setCoachActive = useCallback((v: boolean) => setCoachActiveState(v), []);
  return (
    <CoachNavContext.Provider value={{ coachActive, setCoachActive }}>
      {children}
    </CoachNavContext.Provider>
  );
}

export function useCoachNav() {
  return useContext(CoachNavContext);
}
