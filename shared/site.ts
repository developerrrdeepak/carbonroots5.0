export interface PublicStats {
  activeSensors: number;
  totalFarmers: number;
  totalIncomeINR: number; // total income in INR
  languagesSupported: number;
  supportLabel: string; // e.g., "24/7"
  updatedAt?: string;
}

export const defaultPublicStats: PublicStats = {
  activeSensors: 0,
  totalFarmers: 0,
  totalIncomeINR: 0,
  languagesSupported: 1,
  supportLabel: "24/7",
};
