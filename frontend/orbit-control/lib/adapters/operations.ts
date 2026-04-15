import { orbitFetch } from "@/lib/adapters/http-client";

export const operationsAdapter = {
  async health() {
    return orbitFetch("/operations/health");
  },
};
