import sunriseSubmission from "@/fixtures/customers/sunrise/submission.json";
import sunriseTransactions from "@/fixtures/customers/sunrise/transactions.json";
import kondoSubmission from "@/fixtures/customers/kondo/submission.json";
import kondoTransactions from "@/fixtures/customers/kondo/transactions.json";
import westwindSubmission from "@/fixtures/customers/westwind/submission.json";
import westwindTransactions from "@/fixtures/customers/westwind/transactions.json";
import type { SandboxTransaction, Submission } from "./types";

export interface CustomerFixture {
  id: string;
  label: string;
  blurb: string;
  submission: Submission;
  transactions: SandboxTransaction[];
}

export const CUSTOMERS: CustomerFixture[] = [
  {
    id: "kondo",
    label: "Kondo Capital",
    blurb: "Ready for sign-off",
    submission: kondoSubmission as Submission,
    transactions: kondoTransactions as SandboxTransaction[],
  },
  {
    id: "westwind",
    label: "Westwind Payments",
    blurb: "Minor gaps",
    submission: westwindSubmission as Submission,
    transactions: westwindTransactions as SandboxTransaction[],
  },
  {
    id: "sunrise",
    label: "Sunrise Remit",
    blurb: "Not ready (unresolved + gaps)",
    submission: sunriseSubmission as Submission,
    transactions: sunriseTransactions as SandboxTransaction[],
  },
];

export const DEFAULT_CUSTOMER_ID = "kondo";

export function getCustomer(id: string | undefined): CustomerFixture {
  return CUSTOMERS.find((c) => c.id === id) ?? CUSTOMERS.find((c) => c.id === DEFAULT_CUSTOMER_ID)!;
}
