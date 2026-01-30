import { SynergyEngine } from "./SynergyEngine";

// Shared singleton engine instance for the entire application
// Avoids creating multiple instances in different hooks
export const sharedEngine = new SynergyEngine();
