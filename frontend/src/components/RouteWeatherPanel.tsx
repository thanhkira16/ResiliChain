import { useState } from "react";
import { AlertCircle, CloudSun, LoaderCircle, Route, Send, ThermometerSun, Wind } from "lucide-react";
import {
  getRouteWeather,
  parseRouteCities,
  RouteWeatherStop,
  weatherSeverityStyle,
} from "../services/weatherService";

interface RouteWeatherPanelProps {
  onWeatherChange: (stops: RouteWeatherStop[]) => void;
}

export function RouteWeatherPanel({ onWeatherChange }: RouteWeatherPanelProps) {
  const [routeInput, setRouteInput] = useState("");
  const [stops, setStops] = useState<RouteWeatherStop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedCities, setFailedCities] = useState<string[]>([]);

  const loadRouteWeather = async () => {
    const cities = parseRouteCities(routeInput);
    if (cities.length < 2) {
      setError("Please enter at least two cities along the route.");
      return;
    }
    if (cities.length > 10) {
      setError("Maximum 10 cities supported per query.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setFailedCities([]);
    try {
      const result = await getRouteWeather(cities);
      setStops(result.stops);
      setFailedCities(result.failedCities);
      onWeatherChange(result.stops);
      if (result.stops.length === 0) setError("No weather data found for the entered cities.");
    } catch (requestError) {
      setStops([]);
      onWeatherChange([]);
      setError(requestError instanceof Error ? requestError.message : "Unable to fetch weather data.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3" aria-labelledby="route-weather-heading">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
          <CloudSun className="w-4 h-4" />
        </div>
        <div>
          <h2 id="route-weather-heading" className="text-sm font-bold text-slate-900">Route Weather</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Enter cities in order of travel.</p>
        </div>
      </div>

      <label htmlFor="route-cities" className="sr-only">Cities along the route</label>
      <textarea
        id="route-cities"
        value={routeInput}
        onChange={(event) => setRouteInput(event.target.value)}
        placeholder="Can Tho → Ho Chi Minh City → Da Nang → Hanoi"
        rows={2}
        className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-500">Separate using →, comma, semicolon, or newline.</span>
        <button
          type="button"
          onClick={loadRouteWeather}
          disabled={isLoading}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {isLoading ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {isLoading ? "Loading..." : "Check Weather"}
        </button>
      </div>

      {error && (
        <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {failedCities.length > 0 && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
          Unable to fetch data for: {failedCities.join(", ")}.
        </div>
      )}

      {stops.length > 0 && (
        <ol className="space-y-2 border-t border-slate-100 pt-3" aria-label="Weather conditions by city">
          {stops.map((stop, index) => {
            const style = weatherSeverityStyle[stop.severity];
            return (
              <li key={`${stop.location.latitude}-${stop.location.longitude}`} className="rounded-lg border border-slate-200 p-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-slate-900">{stop.location.name}</span>
                      <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold" style={{ color: style.color }}>
                        <span className={`h-2 w-2 rounded-full ${style.dotClass}`} />{stop.severityLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-600">{stop.condition} · {stop.isDay ? "Daytime" : "Nighttime"}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                      <span className="inline-flex items-center gap-1"><ThermometerSun className="h-3 w-3" />{stop.temperatureC}°C</span>
                      <span className="inline-flex items-center gap-1"><Wind className="h-3 w-3" />{stop.windSpeedKmh} km/h</span>
                      <span className="inline-flex items-center gap-1"><Route className="h-3 w-3" />{stop.precipitationMm} mm</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
