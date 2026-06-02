import { useEffect, useState } from "react";

export function useSpaceTelemetry() {
  const [metrics, setMetrics] = useState({
    trackedDebris: 14258,
    activePayloads: 3491,
    closeApproaches: 24,
    kesslerProbability: 41.2, // percent
  });

  const [threatEvents, setThreatEvents] = useState([]);

  useEffect(() => {
    // Generate initial set of events
    const initialEvents = [
      {
        id: 1,
        target: "STARLINK-4122",
        threatLevel: "WARNING",
        distance: "4.12 km",
        time: "12:28:15",
      },
      {
        id: 2,
        target: "COSMOS-2251",
        threatLevel: "CRITICAL",
        distance: "0.85 km",
        time: "12:29:40",
      },
    ];
    setThreatEvents(initialEvents);

    const interval = setInterval(() => {
      // Dynamic noise variation for metrics
      setMetrics((prev) => ({
        ...prev,
        closeApproaches: Math.max(
          10,
          prev.closeApproaches + (Math.random() > 0.5 ? 1 : -1),
        ),
        kesslerProbability: Math.min(
          100,
          Math.max(0, prev.kesslerProbability + (Math.random() - 0.5) * 0.1),
        ),
      }));

      // Random alert triggers
      if (Math.random() > 0.7) {
        const ids = [
          "GPS-14",
          "STARLINK-5219",
          "FENGYUN-1C DEBRIS",
          "IRIDIUM 33 DEBRIS",
          "ONEWEB-0134",
        ];
        const target = ids[Math.floor(Math.random() * ids.length)];
        const threatLevel = Math.random() > 0.75 ? "CRITICAL" : "WARNING";
        const dist = (0.3 + Math.random() * 4.7).toFixed(2);

        setThreatEvents((prev) => [
          {
            id: Date.now(),
            target,
            threatLevel,
            distance: `${dist} km`,
            time: new Date().toTimeString().split(" ")[0],
          },
          ...prev.slice(0, 4),
        ]);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return { metrics, threatEvents };
}
