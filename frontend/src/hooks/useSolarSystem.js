import { useState, useEffect } from "react";

export function useSolarSystem(targetDate = null) {
  const [orbitData, setOrbitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSolarSystem = async () => {
      try {
        setLoading(true);

        // Dynamically build the URL based on whether a date is requested
        let url = "http://localhost:8000/api/solar-system";
        if (targetDate) {
          // Convert native JS Date object to ISO string
          url += `?target_date=${targetDate.toISOString()}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const json = await response.json();

        if (json.status === "success" && json.data) {
          setOrbitData(json.data);
        } else {
          throw new Error("Invalid payload structure received from ORCAS API.");
        }
      } catch (err) {
        console.error("Failed to fetch interplanetary data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSolarSystem();
  }, [targetDate]); // Re-run the fetch whenever the targetDate changes

  return { orbitData, loading, error };
}
