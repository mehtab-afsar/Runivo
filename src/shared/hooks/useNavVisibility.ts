import { createContext, useContext } from 'react';

interface NavVisibilityContextType {
  navVisible: boolean;
  setNavVisible: (visible: boolean) => void;
}

export const NavVisibilityContext = createContext<NavVisibilityContextType>({
  navVisible: true,
  setNavVisible: () => {},
});

export const useNavVisibility = () => useContext(NavVisibilityContext);
