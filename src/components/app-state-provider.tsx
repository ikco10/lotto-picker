"use client";

import { createContext, useContext, useState } from "react";

type CurrentResultsContextValue = {
  results: number[][];
  setResults: React.Dispatch<React.SetStateAction<number[][]>>;
};

const CurrentResultsContext = createContext<CurrentResultsContextValue | null>(null);

export const AppStateProvider = ({ children }: { children: React.ReactNode }) => {
  const [results, setResults] = useState<number[][]>([]);

  return (
    <CurrentResultsContext.Provider value={{ results, setResults }}>
      {children}
    </CurrentResultsContext.Provider>
  );
};

export const useCurrentResults = () => {
  const context = useContext(CurrentResultsContext);

  if (!context) {
    throw new Error("useCurrentResults must be used within AppStateProvider");
  }

  return context;
};
