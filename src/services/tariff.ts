import { db } from "../lib/db";
import type { CalculateCostInput } from "@postago/shared";

export interface CostEstimate {
  routeId: string;
  ratePerKg: number;
  totalCost: number;
  minDays: number;
  maxDays: number;
  transportType: string;
  originCountry: string;
  destinationCountry: string;
}

export async function calculateCost(
  input: CalculateCostInput,
): Promise<CostEstimate[]> {
  const routes = await db.route.findMany({
    where: {
      originCountry: input.originCountry,
      destinationCountry: input.destinationCountry,
      isActive: true,
      ...(input.transportType ? { transportType: input.transportType } : {}),
    },
    orderBy: { ratePerKg: "asc" },
  });

  return routes.map((route) => ({
    routeId: route.id,
    ratePerKg: Number(route.ratePerKg),
    totalCost: Number(route.ratePerKg) * input.weightKg,
    minDays: route.minDays,
    maxDays: route.maxDays,
    transportType: route.transportType,
    originCountry: route.originCountry,
    destinationCountry: route.destinationCountry,
  }));
}
