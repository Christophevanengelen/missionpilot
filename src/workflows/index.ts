import { systemHealthFunction } from "@/workflows/health";

/** Every function must be registered here to be served (app/api/inngest). */
export const functions = [systemHealthFunction];
