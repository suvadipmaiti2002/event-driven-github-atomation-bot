import { useState, useEffect, useCallback, useRef } from "react";
import { WebhookEventLog, fetchEventLogs } from "../api/events";

export function useEvents(pollIntervalMs: number = 3000) {
  const [events, setEvents] = useState<WebhookEventLog[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const isFirstLoad = useRef(true);

  const loadEvents = useCallback(async (isSilent: boolean = false) => {
    // Only show the big loading spinner on the first initial page load
    if (!isSilent && isFirstLoad.current) {
      setIsLoadingEvents(true);
    }
    setEventsError(null);

    try {
      const data = await fetchEventLogs();
      setEvents(data);
    } catch (err: any) {
      // Don't flash errors on background silent polls unless persistent
      if (!isSilent) {
        setEventsError(err?.message || "Failed to load events.");
      }
    } finally {
      if (isFirstLoad.current) {
        setIsLoadingEvents(false);
        isFirstLoad.current = false;
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadEvents(false);
  }, [loadEvents]);

  // Live Background Polling (Auto-sync every 3 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      // Only poll when the browser tab is visible
      if (document.visibilityState === "visible") {
        loadEvents(true);
      }
    }, pollIntervalMs);

    return () => clearInterval(timer);
  }, [loadEvents, pollIntervalMs]);

  return {
    events,
    isLoadingEvents,
    eventsError,
    refreshEvents: () => loadEvents(false),
  };
}
