import { z } from "zod";

export const QuerySchema = z.object({
  query: z
    .string()
    .min(10, "query must be at least 10 characters long")
    .max(100, "query must be at most 100 characters long"),
});
