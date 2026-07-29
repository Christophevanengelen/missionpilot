import { systemHealthFunction } from "@/workflows/health";
import { planRecomputeFunction } from "@/workflows/plan";

/** Every function must be registered here to be served (app/api/inngest). */
export const functions = [systemHealthFunction, planRecomputeFunction];
