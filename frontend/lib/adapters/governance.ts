import { orbitFetch } from "@/lib/adapters/http-client";

export const governanceAdapter = {
  async health() {
    return orbitFetch("/governance/health");
  },
};
