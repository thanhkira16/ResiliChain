import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

/** The payload accepted by POST /api/ai/weather. */
export interface WeatherRequest {
  city?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}

interface Location {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface WeatherReport {
  location: Location;
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

export class WeatherRequestError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = "WeatherRequestError";
  }
}

const WeatherState = Annotation.Root({
  request: Annotation<WeatherRequest>,
  city: Annotation<string | undefined>,
  latitude: Annotation<number | undefined>,
  longitude: Annotation<number | undefined>,
  location: Annotation<Location | undefined>,
  report: Annotation<WeatherReport | undefined>,
  error: Annotation<WeatherRequestError | undefined>,
});

type WeatherGraphState = typeof WeatherState.State;

function asOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text || undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new WeatherRequestError("Dịch vụ thời tiết trả về dữ liệu không hợp lệ.", 502);
  }
}

async function normaliseInput(state: WeatherGraphState) {
  const city = asOptionalText(state.request.city);
  const latitude = asFiniteNumber(state.request.latitude);
  const longitude = asFiniteNumber(state.request.longitude);
  const receivedLatitude = state.request.latitude !== undefined && state.request.latitude !== null && state.request.latitude !== "";
  const receivedLongitude = state.request.longitude !== undefined && state.request.longitude !== null && state.request.longitude !== "";

  const hasCoordinateValue = receivedLatitude || receivedLongitude;
  if (!city && (!receivedLatitude || !receivedLongitude)) {
    return { error: new WeatherRequestError("Cần cung cấp tên thành phố hoặc đầy đủ latitude và longitude.") };
  }
  if (hasCoordinateValue && (receivedLatitude !== receivedLongitude || latitude === undefined || longitude === undefined)) {
    return { error: new WeatherRequestError("latitude và longitude phải được cung cấp cùng nhau và là số hợp lệ.") };
  }
  if (latitude !== undefined && (latitude < -90 || latitude > 90 || longitude! < -180 || longitude! > 180)) {
    return { error: new WeatherRequestError("Tọa độ nằm ngoài phạm vi hợp lệ (latitude -90..90, longitude -180..180).") };
  }

  return { city, latitude, longitude };
}

function afterNormalise(state: WeatherGraphState): "resolveLocation" | typeof END {
  return state.error ? END : "resolveLocation";
}

async function resolveLocation(state: WeatherGraphState) {
  // Coordinates supplied by the caller are authoritative. City is retained as a label only.
  if (state.latitude !== undefined && state.longitude !== undefined) {
    return {
      location: {
        name: state.city || "Vị trí đã cung cấp",
        latitude: state.latitude,
        longitude: state.longitude,
      },
    };
  }

  try {
    const endpoint = new URL("https://geocoding-api.open-meteo.com/v1/search");
    endpoint.searchParams.set("name", state.city!);
    endpoint.searchParams.set("count", "1");
    endpoint.searchParams.set("language", "vi");
    endpoint.searchParams.set("format", "json");
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) {
      throw new WeatherRequestError("Không thể tra cứu vị trí thành phố từ Open-Meteo.", 502);
    }

    const data = await readJson(response) as {
      results?: Array<{ name: string; country?: string; latitude: number; longitude: number; timezone?: string }>;
    };
    const result = data.results?.[0];
    if (!result) {
      throw new WeatherRequestError(`Không tìm thấy thành phố “${state.city}”. Hãy thử tên đầy đủ hoặc nhập tọa độ.`, 404);
    }
    return {
      location: {
        name: result.name,
        country: result.country,
        latitude: result.latitude,
        longitude: result.longitude,
        timezone: result.timezone,
      },
    };
  } catch (error) {
    return { error: error instanceof WeatherRequestError ? error : new WeatherRequestError("Không thể kết nối dịch vụ định vị thời tiết.", 502) };
  }
}

function afterLocation(state: WeatherGraphState): "fetchWeather" | typeof END {
  return state.error ? END : "fetchWeather";
}

const weatherConditions: Record<number, string> = {
  0: "Trời quang",
  1: "Chủ yếu quang đãng",
  2: "Có mây rải rác",
  3: "Nhiều mây",
  45: "Sương mù",
  48: "Sương mù đọng băng",
  51: "Mưa phùn nhẹ",
  53: "Mưa phùn vừa",
  55: "Mưa phùn dày",
  56: "Mưa phùn đóng băng nhẹ",
  57: "Mưa phùn đóng băng dày",
  61: "Mưa nhẹ",
  63: "Mưa vừa",
  65: "Mưa to",
  66: "Mưa đóng băng nhẹ",
  67: "Mưa đóng băng to",
  71: "Tuyết nhẹ",
  73: "Tuyết vừa",
  75: "Tuyết dày",
  77: "Mưa tuyết hạt",
  80: "Mưa rào nhẹ",
  81: "Mưa rào vừa",
  82: "Mưa rào mạnh",
  85: "Mưa tuyết nhẹ",
  86: "Mưa tuyết mạnh",
  95: "Dông",
  96: "Dông kèm mưa đá nhẹ",
  99: "Dông kèm mưa đá mạnh",
};

async function fetchWeather(state: WeatherGraphState) {
  try {
    const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
    endpoint.searchParams.set("latitude", String(state.location!.latitude));
    endpoint.searchParams.set("longitude", String(state.location!.longitude));
    endpoint.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m");
    endpoint.searchParams.set("timezone", "auto");
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new WeatherRequestError("Không thể lấy dữ liệu thời tiết từ Open-Meteo.", 502);

    const data = await readJson(response) as {
      timezone?: string;
      current?: {
        time: string;
        temperature_2m: number;
        relative_humidity_2m: number;
        apparent_temperature: number;
        is_day: number;
        precipitation: number;
        weather_code: number;
        cloud_cover: number;
        wind_speed_10m: number;
        wind_direction_10m: number;
      };
    };
    if (!data.current) throw new WeatherRequestError("Open-Meteo không trả về dữ liệu thời tiết hiện tại.", 502);

    return {
      report: {
        location: { ...state.location!, timezone: data.timezone || state.location!.timezone },
        observedAt: data.current.time,
        timezone: data.timezone || state.location!.timezone || "auto",
        condition: weatherConditions[data.current.weather_code] || "Không xác định",
        weatherCode: data.current.weather_code,
        temperatureC: data.current.temperature_2m,
        apparentTemperatureC: data.current.apparent_temperature,
        humidityPercent: data.current.relative_humidity_2m,
        precipitationMm: data.current.precipitation,
        cloudCoverPercent: data.current.cloud_cover,
        windSpeedKmh: data.current.wind_speed_10m,
        windDirectionDegrees: data.current.wind_direction_10m,
        isDay: data.current.is_day === 1,
        source: "Open-Meteo",
      } satisfies WeatherReport,
    };
  } catch (error) {
    return { error: error instanceof WeatherRequestError ? error : new WeatherRequestError("Không thể kết nối dịch vụ thời tiết.", 502) };
  }
}

/**
 * A small LangGraph workflow: validate input -> resolve location -> fetch current weather.
 * No LLM or private weather credential is required.
 */
const weatherGraph = new StateGraph(WeatherState)
  .addNode("normaliseInput", normaliseInput)
  .addNode("resolveLocation", resolveLocation)
  .addNode("fetchWeather", fetchWeather)
  .addEdge(START, "normaliseInput")
  .addConditionalEdges("normaliseInput", afterNormalise, ["resolveLocation", END])
  .addConditionalEdges("resolveLocation", afterLocation, ["fetchWeather", END])
  .addEdge("fetchWeather", END)
  .compile();

export async function getWeather(input: WeatherRequest): Promise<WeatherReport> {
  const result = await weatherGraph.invoke({ request: input });
  if (result.error) throw result.error;
  if (!result.report) throw new WeatherRequestError("Không thể hoàn tất yêu cầu thời tiết.", 502);
  return result.report;
}
