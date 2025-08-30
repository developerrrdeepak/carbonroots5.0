import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, Upload as UploadIcon, Leaf, MapPin } from "lucide-react";

interface AnalysisResult {
  avgGreenness: number; // -1..1
  vegetationScore: number; // 0..100
  width: number;
  height: number;
  fileSizeKB: number;
  analyzedAt: string;
  location?: { lat: number; lon: number } | null;
}

export default function PhotoUploadAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setResult(null);
  };

  const requestLocation = async () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        toast.success("Location captured");
      },
      (err) => {
        console.error(err);
        toast.error("Unable to get location");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const analyze = async () => {
    if (!imgRef.current || !file) {
      toast.error("Select a photo first");
      return;
    }
    setAnalyzing(true);
    await new Promise((r) => setTimeout(r, 10)); // allow UI to update

    const img = imgRef.current;
    const canvas = document.createElement("canvas");
    // downscale for speed
    const maxDim = 640;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.floor(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.floor(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Canvas not supported");
      setAnalyzing(false);
      return;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let sum = 0;
    let count = 0;
    const stride = 4 * 4; // sample every 4th pixel
    for (let i = 0; i < data.length; i += stride) {
      const r = data[i];
      const g = data[i + 1];
      // const b = data[i + 2];
      const denom = g + r + 1e-6;
      const gIdx = (g - r) / denom; // proxy for greenness [-1,1]
      sum += gIdx;
      count++;
    }
    const avgGreenness = sum / Math.max(1, count);
    const vegetationScore = Math.round(((avgGreenness + 1) / 2) * 100);

    const analysis: AnalysisResult = {
      avgGreenness,
      vegetationScore,
      width: img.naturalWidth,
      height: img.naturalHeight,
      fileSizeKB: Math.round(file.size / 1024),
      analyzedAt: new Date().toISOString(),
      location,
    };
    setResult(analysis);
    setAnalyzing(false);
    toast.success("Analysis complete");
  };

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify({ notes, result }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `photo-analysis-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const statusBadge = useMemo(() => {
    if (!result) return null;
    const score = result.vegetationScore;
    if (score >= 66)
      return <Badge className="bg-green-100 text-green-800">High vegetation</Badge>;
    if (score >= 33)
      return <Badge className="bg-amber-100 text-amber-800">Moderate vegetation</Badge>;
    return <Badge variant="secondary">Low vegetation</Badge>;
  }, [result]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Camera className="h-5 w-5" />
          <span>Photo Upload & Analysis</span>
        </CardTitle>
        <CardDescription>
          Capture or select a field photo. We estimate vegetation using green-channel index on-device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="photo">Select Photo</Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-gray-500">Accepts JPEG/PNG from camera or gallery</p>
            </div>
            <div className="space-y-2">
              <Label>Location (optional)</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="w-full" onClick={requestLocation}>
                  <MapPin className="h-4 w-4 mr-2" />
                  Use GPS
                </Button>
              </div>
              {location && (
                <p className="text-xs text-gray-600">Lat {location.lat.toFixed(5)}, Lon {location.lon.toFixed(5)}</p>
              )}
            </div>
          </div>

          {previewUrl && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-auto rounded-lg border"
                  onLoad={() => {
                    // image is ready for analysis
                  }}
                />
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add field context (crop, stage, anomalies)" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={analyze} disabled={analyzing}>
                    <Leaf className="h-4 w-4 mr-2" />
                    {analyzing ? "Analyzing..." : "Analyze Photo"}
                  </Button>
                  <Button variant="outline" onClick={exportJson} disabled={!result}>
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Export Analysis (JSON)
                  </Button>
                </div>
                {result && (
                  <div className="space-y-2 p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Vegetation score</span>
                      <span className="font-semibold">{result.vegetationScore}/100</span>
                    </div>
                    <Progress value={result.vegetationScore} />
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>
                        {result.width}×{result.height}px · {result.fileSizeKB} KB
                      </span>
                      {statusBadge}
                    </div>
                    {result.location && (
                      <p className="text-xs text-gray-600 flex items-center"><MapPin className="h-3 w-3 mr-1" /> Lat {result.location.lat.toFixed(5)}, Lon {result.location.lon.toFixed(5)}</p>
                    )}
                    <p className="text-xs text-gray-500">Analyzed at {new Date(result.analyzedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
