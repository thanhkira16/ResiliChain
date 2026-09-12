export interface WeatherReport {
  location: {
    name: string;
    country?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  };
  observedAt: string;
  timezone: string;
  condition: string;
  weatherCode: number;
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPercent: number;
  precipitationMm: number;
  cloudCoverPercent: number;
  windSpeedKmh: number;
  windDirectionDegrees: number;
  isDay: boolean;
  source: "Open-Meteo";
}

export type WeatherSeverity = "GOOD" | "CAUTION" | "POOR" | "SEVERE";

export interface RouteWeatherStop extends WeatherReport {
  requestedCity: string;
  severity: WeatherSeverity;
  severityLabel: string;
}

const severeCodes = new Set([65, 67, 75, 82, 86, 95, 96, 99]);
const poorCodes = new Set([45, 48, 55, 57, 63, 66, 73, 80, 81, 85]);
const cautionCodes = new Set([51, 53, 56, 61, 71, 77]);

export function assessWeatherSeverity(report: WeatherReport): Pick<RouteWeatherStop, "severity" | "severityLabel"> {
  if (severeCodes.has(report.weatherCode) || report.windSpeedKmh >= 50) {
    return { severity: "SEVERE", severityLabel: "Nguy hiểm" };
  }
  if (poorCodes.has(report.weatherCode) || report.precipitationMm >= 2 || report.windSpeedKmh >= 30) {
    return { severity: "POOR", severityLabel: "Thời tiết xấu" };
  }
  if (cautionCodes.has(report.weatherCode) || report.precipitationMm > 0 || report.windSpeedKmh >= 20) {
    return { severity: "CAUTION", severityLabel: "Cần theo dõi" };
  }
  return { severity: "GOOD", severityLabel: "Ổn định" };
}

export const weatherSeverityStyle: Record<WeatherSeverity, { color: string; dotClass: string }> = {
  SEVERE: { color: "#ef4444", dotClass: "bg-red-500" },
  POOR: { color: "#f97316", dotClass: "bg-orange-500" },
  CAUTION: { color: "#f59e0b", dotClass: "bg-amber-400" },
  GOOD: { color: "#10b981", dotClass: "bg-emerald-500" },
};

export function parseRouteCities(route: string): string[] {
  const cities = route
    .split(/,|;|\n|→|->/)
    .map((city) => city.trim())
    .filter(Boolean);

  return [...new Set(cities.map((city) => city.toLocaleLowerCase("vi-VN")))].map(
    (city) => cities.find((candidate) => candidate.toLocaleLowerCase("vi-VN") === city)!
  );
}

export async function getRouteWeather(cities: string[]): Promise<{ stops: RouteWeatherStop[]; failedCities: string[] }> {
  const response = await fetch("/api/ai/weather/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cities }),
  });
  const payload = await response.json() as {
    success?: boolean;
    error?: string;
    data?: Array<{ city: string; data?: WeatherReport; error?: string }>;
  };

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || "Không thể lấy dữ liệu thời tiết tuyến đường.");
  }

  const failedCities = payload.data.filter((item) => !item.data).map((item) => item.city);
  const stops = payload.data.flatMap((item) => {
    if (!item.data) return [];
    return [{ ...item.data, requestedCity: item.city, ...assessWeatherSeverity(item.data) }];
  });

  return { stops, failedCities };
}
