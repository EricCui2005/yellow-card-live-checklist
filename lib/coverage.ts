import channelsFixture from "@/fixtures/channels.json";
import { getCustomer } from "./customers";
import type {
  Channel,
  CoverageCellResult,
  LaunchPlanEntry,
  Outcome,
  ReviewPacket,
  SandboxTransaction,
} from "./types";

const SUCCESS_PATTERN = "1111111111";
const FAILURE_PATTERN = "0000000000";

function resolveEntry(entry: LaunchPlanEntry, channels: Channel[]): Channel[] {
  return channels.filter(
    (ch) =>
      ch.country === entry.country &&
      ch.channelType === entry.channelType &&
      ch.direction === entry.direction,
  );
}

function accountForDirection(tx: SandboxTransaction): string | undefined {
  return tx.direction === "send"
    ? tx.destinationAccountNumber
    : tx.sourceAccountNumber;
}

// Classifies a sandbox transaction against the documented test patterns.
// Bank accounts match exactly; mobile money accounts match by trailing 10
// digits regardless of country-code prefix.
function classifyOutcome(
  tx: SandboxTransaction,
  channel: Channel,
): Outcome | null {
  const account = accountForDirection(tx);
  if (!account) return null;

  if (channel.channelType === "bank") {
    if (account === SUCCESS_PATTERN) return "success";
    if (account === FAILURE_PATTERN) return "failure";
    return null;
  }

  if (account.endsWith(SUCCESS_PATTERN)) return "success";
  if (account.endsWith(FAILURE_PATTERN)) return "failure";
  return null;
}

function buildCoverage(
  plan: LaunchPlanEntry[],
  transactions: SandboxTransaction[],
  channels: Channel[],
): { coverage: CoverageCellResult[]; unresolved: LaunchPlanEntry[] } {
  const coverage: CoverageCellResult[] = [];
  const unresolved: LaunchPlanEntry[] = [];

  for (const entry of plan) {
    const matches = resolveEntry(entry, channels);
    if (matches.length === 0) {
      unresolved.push(entry);
      continue;
    }
    for (const channel of matches) {
      for (const outcome of ["success", "failure"] as const) {
        const matched = transactions.filter((tx) => {
          if (tx.channelId !== channel.channelId) return false;
          if (classifyOutcome(tx, channel) !== outcome) return false;
          const expectedTerminal = outcome === "success" ? "COMPLETE" : "FAILED";
          return tx.terminalStatus === expectedTerminal;
        });
        coverage.push({ entry, channel, outcome, matchedTransactions: matched });
      }
    }
  }
  return { coverage, unresolved };
}

function deriveVerdict(
  cellsMissing: number,
  unresolvedCount: number,
): ReviewPacket["verdict"] {
  if (unresolvedCount > 0) return "not-ready";
  if (cellsMissing === 0) return "ready";
  return "minor-gaps";
}

export function buildReviewPacket(customerId?: string): ReviewPacket {
  const customer = getCustomer(customerId);
  const channels = channelsFixture as Channel[];

  const { coverage, unresolved } = buildCoverage(
    customer.submission.launchPlan,
    customer.transactions,
    channels,
  );

  const cellsRequired = coverage.length;
  const cellsCovered = coverage.filter((c) => c.matchedTransactions.length > 0).length;
  const cellsMissing = cellsRequired - cellsCovered;
  const unresolvedCount = unresolved.length;

  return {
    submission: customer.submission,
    coverage,
    unresolvedEntries: unresolved,
    stats: { cellsRequired, cellsCovered, cellsMissing, unresolvedCount },
    verdict: deriveVerdict(cellsMissing, unresolvedCount),
  };
}

export function getRawSubmissionJson(customerId?: string) {
  return getCustomer(customerId).submission;
}
