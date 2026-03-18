import { createContext, useContext, useMemo, useState } from "react";

const EventTypeContext = createContext({
  eventTypeId: "",
  setEventTypeId: () => {}
});

export function EventTypeProvider({ children }) {
  const [eventTypeId, setEventTypeId] = useState("");

  const value = useMemo(
    () => ({
      eventTypeId,
      setEventTypeId
    }),
    [eventTypeId]
  );

  return (
    <EventTypeContext.Provider value={value}>
      {children}
    </EventTypeContext.Provider>
  );
}

export function useEventType() {
  return useContext(EventTypeContext);
}
