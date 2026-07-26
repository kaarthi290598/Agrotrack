import { mutation } from "./_generated/server";
import { requireAdmin } from "./authHelpers";

/** Dev seed disabled — requires ADMIN and still refuses to run. */
export const seedMultiOrgData = mutation({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    throw new Error(
      "Seed disabled. Use a dedicated internal tool if you need demo data."
    );
  },
});
