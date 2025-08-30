import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToCSV, exportHTMLTableAsPDF } from "@/lib/export";
import {
  Users,
  FileText,
  TreePine,
  BarChart3,
  Download,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  IndianRupee,
  MapPin,
  Filter,
} from "lucide-react";

// Mock data - in real app this would come from API
const mockFarmers: any[] = [];

const mockProjects = [
  {
    id: "1",
    name: "Agroforestry Initiative",
    type: "agroforestry",
    participants: 45,
    totalCredits: 567.8,
    status: "active",
    createdDate: "2024-01-01",
  },
  {
    id: "2",
    name: "Rice Carbon Project",
    type: "rice_based",
    participants: 23,
    totalCredits: 234.5,
    status: "active",
    createdDate: "2024-02-01",
  },
];

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [farmers, setFarmers] = useState(mockFarmers);
  const [loadingFarmers, setLoadingFarmers] = useState(false);
  const [projects, setProjects] = useState(mockProjects);
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [newProject, setNewProject] = useState({
    name: "",
    type: "",
    description: "",
    creditRate: "",
    requirements: "",
  });
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationTitle, setVerificationTitle] = useState("");
  const [verificationBody, setVerificationBody] =
    useState<React.ReactNode>(null);
  const [satLatLon, setSatLatLon] = useState("");
  const [iotText, setIotText] = useState("");

  if (!isAuthenticated || user?.type !== "admin") {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        setLoadingFarmers(true);
        const token = localStorage.getItem("auth_token");
        const res = await fetch("/api/admin/farmers", {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Failed with ${res.status}`);
        }
        const data = await res.json();
        setFarmers(data.farmers || []);
      } catch (e) {
        console.error("Failed to fetch farmers", e);
        toast.error("Failed to load farmers");
      } finally {
        setLoadingFarmers(false);
      }
    };
    fetchFarmers();
  }, []);

  const handleFarmerStatusUpdate = async (
    farmerId: string,
    newStatus: string,
  ) => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/admin/farmer-status", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ farmerId, status: newStatus }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed with ${res.status}`);
      }
      setFarmers((prev) =>
        prev.map((farmer) =>
          farmer.id === farmerId ? { ...farmer, status: newStatus } : farmer,
        ),
      );
      toast.success(`Farmer status updated to ${newStatus}`);
    } catch (e) {
      toast.error("Failed to update farmer status");
      console.error(e);
    }
  };

  const handleCreateProject = () => {
    if (!newProject.name || !newProject.type) {
      toast.error("Please fill in required fields");
      return;
    }

    const project = {
      id: Date.now().toString(),
      ...newProject,
      participants: 0,
      totalCredits: 0,
      status: "active",
      createdDate: new Date().toISOString().split("T")[0],
    };

    setProjects((prev) => [...prev, project]);
    setNewProject({
      name: "",
      type: "",
      description: "",
      creditRate: "",
      requirements: "",
    });
    setShowNewProjectDialog(false);
    toast.success("Project created successfully!");
  };

  const exportReport = (type: string) => {
    if (type.includes("Farmer")) {
      const headers = [
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "status", label: "Status" },
        { key: "landSize", label: "Land Size" },
        { key: "carbonCredits", label: "Credits" },
      ];
      const rows = farmers.map((f: any) => ({
        name: f.name || f.email,
        email: f.email,
        status: getStatus(f),
        landSize: getLand(f),
        carbonCredits: getCredits(f),
      }));
      if (type.toLowerCase().includes("excel")) {
        exportToCSV("farmers.csv", rows, headers);
      } else {
        const table = `<table><thead><tr>${headers
          .map((h) => `<th>${h.label}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (r) =>
              `<tr>${headers
                .map((h) => `<td>${(r as any)[h.key]}</td>`)
                .join("")}</tr>`,
          )
          .join("")}</tbody></table>`;
        exportHTMLTableAsPDF("farmers.pdf", "Farmer Report", table);
      }
      toast.success("Farmer report exported");
      return;
    }

    if (type.includes("Carbon")) {
      const headers = [
        { key: "name", label: "Name" },
        { key: "credits", label: "Credits" },
        { key: "value", label: "Estimated Value (INR)" },
      ];
      const rows = farmers.map((f: any) => ({
        name: f.name || f.email,
        credits: getCredits(f),
        value: getCredits(f) * 500,
      }));
      if (type.toLowerCase().includes("excel")) {
        exportToCSV("carbon-credits.csv", rows, headers);
      } else {
        const table = `<table><thead><tr>${headers
          .map((h) => `<th>${h.label}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (r) =>
              `<tr>${headers
                .map((h) => `<td>${(r as any)[h.key]}</td>`)
                .join("")}</tr>`,
          )
          .join("")}</tbody></table>`;
        exportHTMLTableAsPDF(
          "carbon-credits.pdf",
          "Carbon Credit Report",
          table,
        );
      }
      toast.success("Carbon report exported");
      return;
    }

    if (type.includes("Project")) {
      const headers = [
        { key: "name", label: "Project" },
        { key: "type", label: "Type" },
        { key: "participants", label: "Participants" },
        { key: "totalCredits", label: "Total Credits" },
        { key: "status", label: "Status" },
      ];
      const rows = projects;
      if (type.toLowerCase().includes("excel")) {
        exportToCSV("projects.csv", rows, headers);
      } else {
        const table = `<table><thead><tr>${headers
          .map((h) => `<th>${h.label}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (r: any) =>
              `<tr>${headers
                .map((h) => `<td>${(r as any)[h.key]}</td>`)
                .join("")}</tr>`,
          )
          .join("")}</tbody></table>`;
        exportHTMLTableAsPDF("projects.pdf", "Project Report", table);
      }
      toast.success("Project report exported");
      return;
    }

    toast.error("Unsupported report type");
  };

  const getStatus = (f: any) =>
    f.status ? f.status : f.verified ? "verified" : "pending";
  const getCredits = (f: any) =>
    typeof f.carbonCredits === "number" ? f.carbonCredits : 0;
  const getLand = (f: any) => (typeof f.landSize === "number" ? f.landSize : 0);

  const calculateStats = () => {
    const totalFarmers = farmers.length;
    const verifiedFarmers = farmers.filter(
      (f) => getStatus(f) === "verified",
    ).length;
    const totalCredits = farmers.reduce((sum, f) => sum + getCredits(f), 0);
    const totalLand = farmers.reduce((sum, f) => sum + getLand(f), 0);

    return { totalFarmers, verifiedFarmers, totalCredits, totalLand };
  };

  const stats = calculateStats();

  const analyzeSatellite = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const [latStr, lonStr] = satLatLon.split(",");
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      const res = await fetch("/api/satellite/ndvi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lat, lon }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `Failed with ${res.status}`);
      toast.success("Satellite request submitted");
      console.log("NDVI response", data);
    } catch (e: any) {
      toast.error(e.message || "Satellite analysis failed");
    }
  };

  const validateIot = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const payload = JSON.parse(iotText || "{}");
      const res = await fetch("/api/iot/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `Failed with ${res.status}`);
      toast.success("IoT payload stored");
    } catch (e: any) {
      toast.error(e.message || "Invalid IoT JSON");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome, {user?.admin?.name || user?.admin?.email}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/90 backdrop-blur border border-emerald-100 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Farmers
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.totalFarmers}
                  </p>
                </div>
                <Users className="h-8 w-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur border border-emerald-100 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Verified Farmers
                  </p>
                  <p className="text-3xl font-bold text-green-600">
                    {stats.verifiedFarmers}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur border border-emerald-100 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Credits
                  </p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {stats.totalCredits.toFixed(1)}
                  </p>
                </div>
                <TreePine className="h-8 w-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur border border-emerald-100 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Land (Ha)
                  </p>
                  <p className="text-3xl font-bold text-amber-600">
                    {stats.totalLand.toFixed(1)}
                  </p>
                </div>
                <MapPin className="h-8 w-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="farmers" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="farmers">Farmer Management</TabsTrigger>
            <TabsTrigger value="projects">Project Management</TabsTrigger>
            <TabsTrigger value="mrv">MRV Tools</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="farmers">
            <Card className="bg-white/90 border border-emerald-100 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Farmer Management</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportReport("Farmers")}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Land Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingFarmers && (
                      <TableRow>
                        <TableCell colSpan={7}>Loading farmers...</TableCell>
                      </TableRow>
                    )}
                    {!loadingFarmers && farmers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7}>No farmers found</TableCell>
                      </TableRow>
                    )}
                    {!loadingFarmers &&
                      farmers.map((farmer) => (
                        <TableRow key={farmer.id}>
                          <TableCell className="font-medium">
                            {farmer.name || farmer.email}
                          </TableCell>
                          <TableCell>{farmer.email}</TableCell>
                          <TableCell>
                            {typeof farmer.location === "string"
                              ? farmer.location
                              : farmer.location?.state ||
                                farmer.location?.pincode ||
                                "-"}
                          </TableCell>
                          <TableCell>{getLand(farmer)} Ha</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                getStatus(farmer) === "verified"
                                  ? "default"
                                  : getStatus(farmer) === "pending"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {getStatus(farmer)}
                            </Badge>
                          </TableCell>
                          <TableCell>{getCredits(farmer)}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedFarmer(farmer)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {getStatus(farmer) === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleFarmerStatusUpdate(
                                        farmer.id,
                                        "verified",
                                      )
                                    }
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      handleFarmerStatusUpdate(
                                        farmer.id,
                                        "rejected",
                                      )
                                    }
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card className="bg-white/90 border border-emerald-100 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TreePine className="h-5 w-5" />
                    <span>Project Management</span>
                  </div>
                  <Dialog
                    open={showNewProjectDialog}
                    onOpenChange={setShowNewProjectDialog}
                  >
                    <DialogTrigger asChild>
                      <Button className="bg-green-600 hover:bg-green-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Project
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="projectName">Project Name *</Label>
                          <Input
                            id="projectName"
                            value={newProject.name}
                            onChange={(e) =>
                              setNewProject({
                                ...newProject,
                                name: e.target.value,
                              })
                            }
                            placeholder="Enter project name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="projectType">Project Type *</Label>
                          <Select
                            onValueChange={(value) =>
                              setNewProject({ ...newProject, type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select project type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="agroforestry">
                                Agroforestry
                              </SelectItem>
                              <SelectItem value="rice_based">
                                Rice Based
                              </SelectItem>
                              <SelectItem value="soil_carbon">
                                Soil Carbon
                              </SelectItem>
                              <SelectItem value="biomass">Biomass</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={newProject.description}
                            onChange={(e) =>
                              setNewProject({
                                ...newProject,
                                description: e.target.value,
                              })
                            }
                            placeholder="Enter project description"
                          />
                        </div>
                        <div>
                          <Label htmlFor="creditRate">
                            Credit Rate (per hectare)
                          </Label>
                          <Input
                            id="creditRate"
                            type="number"
                            step="0.1"
                            value={newProject.creditRate}
                            onChange={(e) =>
                              setNewProject({
                                ...newProject,
                                creditRate: e.target.value,
                              })
                            }
                            placeholder="Enter credit rate"
                          />
                        </div>
                        <div>
                          <Label htmlFor="requirements">Requirements</Label>
                          <Textarea
                            id="requirements"
                            value={newProject.requirements}
                            onChange={(e) =>
                              setNewProject({
                                ...newProject,
                                requirements: e.target.value,
                              })
                            }
                            placeholder="Enter project requirements"
                          />
                        </div>
                        <Button
                          onClick={handleCreateProject}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          Create Project
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((project) => (
                    <Card
                      key={project.id}
                      className="bg-white border-l-4 border-l-green-500 shadow-sm"
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{project.name}</h3>
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700"
                            >
                              {project.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">
                                Participants:
                              </span>
                              <p className="font-medium">
                                {project.participants}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-600">
                                Total Credits:
                              </span>
                              <p className="font-medium">
                                {project.totalCredits}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-xs text-gray-500">
                              Created: {project.createdDate}
                            </span>
                            <Button size="sm" variant="outline">
                              Manage
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mrv">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white/90 border border-emerald-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Carbon Credit Calculator</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">
                          {stats.totalCredits.toFixed(1)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Total Credits Generated
                        </p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">
                          {(stats.totalCredits * 500).toLocaleString("en-IN")}
                        </p>
                        <p className="text-sm text-gray-600">
                          Total Value (INR)
                        </p>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => exportReport("Carbon Credits")}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Credit Report
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/90 border border-emerald-100 shadow-sm">
                <CardHeader>
                  <CardTitle>Verification Tools</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setVerificationTitle("Satellite Data Analysis");
                        setVerificationBody(
                          <div className="space-y-3 text-sm">
                            <p>
                              Paste a location to fetch NDVI (lat,lon)
                            </p>
                            <Input
                              placeholder="Latitude,Longitude"
                              value={satLatLon}
                              onChange={(e) => setSatLatLon(e.target.value)}
                            />
                            <Button className="mt-2" onClick={analyzeSatellite}>Analyze</Button>
                          </div>,
                        );
                        setShowVerificationDialog(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Satellite Data Analysis
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setVerificationTitle("Field Verification Reports");
                        setVerificationBody(
                          <div className="space-y-3 text-sm">
                            <p>
                              Upload field images or PDFs to attach to farmer
                              records.
                            </p>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.png"
                              multiple
                              className="block w-full text-sm"
                            />
                            <Button className="mt-2">Upload</Button>
                          </div>,
                        );
                        setShowVerificationDialog(true);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Field Verification Reports
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setVerificationTitle("IoT Sensor Data");
                        setVerificationBody(
                          <div className="space-y-3 text-sm">
                            <p>
                              Paste IoT payload (JSON) for quick validation.
                            </p>
                            <Textarea
                              placeholder='{"sensorId":"S-01","soilMoisture":23.4,"ph":6.8}'
                              rows={6}
                              value={iotText}
                              onChange={(e) => setIotText(e.target.value)}
                            />
                            <Button className="mt-2" onClick={validateIot}>Validate</Button>
                          </div>,
                        );
                        setShowVerificationDialog(true);
                      }}
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      IoT Sensor Data
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setVerificationTitle("AI Verification Engine");
                        setVerificationBody(
                          <div className="space-y-3 text-sm">
                            <p>
                              Run heuristic checks on farmer profile and
                              activity logs.
                            </p>
                            <Button>Run Checks</Button>
                          </div>,
                        );
                        setShowVerificationDialog(true);
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      AI Verification Engine
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <Card className="bg-gradient-to-br from-white to-indigo-50 border-indigo-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Reporting & Export</span>
                </CardTitle>
                <CardDescription>
                  Generate and export MRV reports for stakeholders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="p-4 bg-white border border-emerald-100 shadow-sm">
                    <h3 className="font-semibold mb-2">Farmer Report</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Comprehensive farmer data and verification status
                    </p>
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => exportReport("PDF Farmer")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => exportReport("Excel Farmer")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-4 bg-white border border-emerald-100 shadow-sm">
                    <h3 className="font-semibold mb-2">Carbon Credit Report</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Detailed carbon credit calculations and verification
                    </p>
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => exportReport("PDF Carbon")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => exportReport("Excel Carbon")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-4 bg-white border border-emerald-100 shadow-sm">
                    <h3 className="font-semibold mb-2">Project Report</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Project performance and participant data
                    </p>
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => exportReport("PDF Project")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => exportReport("Excel Project")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                      </Button>
                    </div>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Farmer Details Modal */}
        {selectedFarmer && (
          <Dialog
            open={!!selectedFarmer}
            onOpenChange={() => setSelectedFarmer(null)}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  Farmer Details - {selectedFarmer.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <p className="text-sm text-gray-600">
                      {selectedFarmer.email}
                    </p>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <p className="text-sm text-gray-600">
                      {selectedFarmer.phone}
                    </p>
                  </div>
                  <div>
                    <Label>Location</Label>
                    <p className="text-sm text-gray-600">
                      {typeof selectedFarmer.location === "string"
                        ? selectedFarmer.location
                        : selectedFarmer.location?.state ||
                          selectedFarmer.location?.pincode ||
                          "-"}
                    </p>
                  </div>
                  <div>
                    <Label>Land Size</Label>
                    <p className="text-sm text-gray-600">
                      {getLand(selectedFarmer)} hectares
                    </p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Badge
                      variant={
                        getStatus(selectedFarmer) === "verified"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {getStatus(selectedFarmer)}
                    </Badge>
                  </div>
                  <div>
                    <Label>Carbon Credits</Label>
                    <p className="text-sm text-gray-600">
                      {getCredits(selectedFarmer)}
                    </p>
                  </div>
                </div>
                {getStatus(selectedFarmer) === "pending" && (
                  <div className="flex space-x-2 pt-4">
                    <Button
                      onClick={() => {
                        handleFarmerStatusUpdate(selectedFarmer.id, "verified");
                        setSelectedFarmer(null);
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        handleFarmerStatusUpdate(selectedFarmer.id, "rejected");
                        setSelectedFarmer(null);
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        <Dialog
          open={showVerificationDialog}
          onOpenChange={setShowVerificationDialog}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{verificationTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">{verificationBody}</div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
