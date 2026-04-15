import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily at 2:00 AM to check if invoices need to be generated
crons.daily(
  "generate-invoices",
  { hourUTC: 0, minuteUTC: 0 }, // midnight UTC = 2AM SAST
  internal.invoiceGeneration.generateInvoices
);

export default crons;
