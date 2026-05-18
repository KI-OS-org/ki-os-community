import { orbitFetch } from "@/lib/adapters/http-client";

export const routingAdapter = {
  async health() {
    return orbitFetch("/routing/health");
  },
};
