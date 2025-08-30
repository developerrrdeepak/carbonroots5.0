import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Globe,
  MapPin,
  Thermometer,
  Droplets,
  Cloud,
  Wind,
} from "lucide-react";

interface WeatherData {
  temperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  wind: number | null;
  weatherCode: number | null;
  time: string | null;
}

function codeToDesc(code: number | null) {
  if (code == null) return "-";
  const map: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Drizzle: Light",
    53: "Drizzle: Moderate",
    55: "Drizzle: Dense",
    56: "Freezing Drizzle: Light",
    57: "Freezing Drizzle: Dense",
    61: "Rain: Slight",
    63: "Rain: Moderate",
    65: "Rain: Heavy",
    66: "Freezing Rain: Light",
    67: "Freezing Rain: Heavy",
    71: "Snow fall: Slight",
    73: "Snow fall: Moderate",
    75: "Snow fall: Heavy",
    77: "Snow grains",
    80: "Rain showers: Slight",
    81: "Rain showers: Moderate",
    82: "Rain showers: Violent",
    85: "Snow showers: Slight",
    86: "Snow showers: Heavy",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return map[code] ?? `Weather code ${code}`;
}

export default function LiveWeather() {
  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WeatherData>({
    temperature: null,
    humidity: null,
    precipitation: null,
    wind: null,
    weatherCode: null,
    time: null,
  });

  const getLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude.toFixed(5);
        const lo = pos.coords.longitude.toFixed(5);
        setLat(la);
        setLon(lo);
        toast.success("Location detected");
      },
      (err) => {
        console.error(err);
        toast.error("Unable to get location");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const fetchWeather = async () => {
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    if (Number.isNaN(la) || Number.isNaN(lo)) {
      toast.error("Enter valid latitude and longitude");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        latitude: String(la),
        longitude: String(lo),
        current:
          "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
        hourly: "temperature_2m,precipitation_probability,cloud_cover",
        forecast_days: "1",
        timezone: "auto",
      });
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to fetch weather");
      const json = await res.json();
      const cur = json.current || {};
      setData({
        temperature: cur.temperature_2m ?? null,
        humidity: cur.relative_humidity_2m ?? null,
        precipitation: cur.precipitation ?? null,
        wind: cur.wind_speed_10m ?? null,
        weatherCode: cur.weather_code ?? null,
        time: cur.time ?? null,
      });
      toast.success("Weather updated");
    } catch (e) {
      console.error(e);
      toast.error("Weather fetch failed");
    } finally {
      setLoading(false);
    }
  };

  const humidityProgress = useMemo(
    () =>
      data.humidity == null ? 0 : Math.max(0, Math.min(100, data.humidity)),
    [data.humidity],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Globe className="h-5 w-5" />
          <span>Weather Integration</span>
        </CardTitle>
        <CardDescription>
          Local weather and predictions without API keys (Open-Meteo)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <Label htmlFor="lat">Latitude</Label>
              <Input
                id="lat"
                placeholder="e.g. 28.61"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lon">Longitude</Label>
              <Input
                id="lon"
                placeholder="e.g. 77.20"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={getLocation}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Use GPS
              </Button>
              <Button
                type="button"
                className="w-full"
                onClick={fetchWeather}
                disabled={loading}
              >
                {loading ? "Fetching..." : "Get Weather"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-600">Temperature</p>
              <p className="text-xl font-bold text-blue-700 flex items-center justify-center">
                <Thermometer className="h-4 w-4 mr-1" />
                {data.temperature ?? "-"}°C
              </p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-600">Humidity</p>
              <p className="text-xl font-bold text-green-700 flex items-center justify-center">
                <Droplets className="h-4 w-4 mr-1" />
                {data.humidity ?? "-"}%
              </p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-xs text-gray-600">Precipitation</p>
              <p className="text-xl font-bold text-amber-700">
                {data.precipitation ?? "-"} mm
              </p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-xs text-gray-600">Wind</p>
              <p className="text-xl font-bold text-purple-700">
                {data.wind ?? "-"} km/h
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              <span className="text-sm">Condition</span>
            </div>
            <Badge variant="secondary">{codeToDesc(data.weatherCode)}</Badge>
          </div>

          <div>
            <Label className="text-xs text-gray-600">Humidity</Label>
            <Progress value={humidityProgress} />
            <p className="text-xs text-gray-500 mt-1">
              {data.time
                ? `As of ${new Date(data.time).toLocaleString()}`
                : "No data yet"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
