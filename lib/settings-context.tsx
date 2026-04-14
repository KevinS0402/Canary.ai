import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SettingsContextValue = {
  selectedDate: Date | null;
  setSelectedDate: (date: Date | null) => void;
  clearSelectedDate: () => void;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

type SettingsProviderProps = {
  children: ReactNode;
};

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const value = useMemo<SettingsContextValue>(
    () => ({
      selectedDate,
      setSelectedDate,
      clearSelectedDate: () => setSelectedDate(null),
    }),
    [selectedDate],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
