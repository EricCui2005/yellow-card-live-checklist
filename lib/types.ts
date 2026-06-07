export type Direction = "send" | "receive";
export type ChannelType = "bank" | "momo";
export type TerminalStatus = "COMPLETE" | "FAILED";
export type Outcome = "success" | "failure";

// A channel object as returned by GET /channels. `channelId` is the primary
// key — every other dimension below is a property of the channel and can be
// derived from the lookup table.
export interface Channel {
  channelId: string;
  country: string;
  countryName: string;
  channelType: ChannelType;
  direction: Direction;
  paymentMethod: string;
  settlementTime: string;
}

// What the customer uploads. The launchPlan is at the COARSE granularity:
// (country, channelType, direction). The dashboard resolves each tuple to the
// matching channel(s) in channels.json. Multiple channels may resolve from one
// tuple (e.g. ZA bank send → EFT and Automated Batched Payment).
export interface LaunchPlanEntry {
  country: string;
  channelType: ChannelType;
  direction: Direction;
  notesNotTested?: string;
}

export interface KycParty {
  name: string;
  country: string;
  idType?: string;
  idNumber?: string;
  additionalIdType?: string;
  additionalIdNumber?: string;
}

export interface SandboxTransaction {
  id: string;
  sequenceId: string;
  direction: Direction;
  country: string;
  channelType: ChannelType;
  channelId: string;
  destinationAccountNumber?: string;
  sourceAccountNumber?: string;
  terminalStatus: TerminalStatus;
  createdAt: string;
  amountUsd: number;
  recipient?: KycParty;
  sender?: KycParty;
}

// The exact shape of the JSON file a customer uploads to the verification
// portal.
export interface Submission {
  businessName: string;
  useCase: string;
  primaryContact: { name: string; role: string; email: string };
  requestedGoLiveDate: string;
  submittedAt: string;
  launchPlan: LaunchPlanEntry[];
  selfAttestations: {
    productionStaticIps: string[];
    requestedKeyScope: string;
    topUpStablecoin: string;
    topUpNetwork: string;
    topUpTxHash: string;
    kycTierPlan: string;
  };
}

export interface CoverageCellResult {
  entry: LaunchPlanEntry;
  channel: Channel;
  outcome: Outcome;
  matchedTransactions: SandboxTransaction[];
}

export interface ReviewPacket {
  submission: Submission;
  coverage: CoverageCellResult[];
  unresolvedEntries: LaunchPlanEntry[];
  stats: {
    cellsRequired: number;
    cellsCovered: number;
    cellsMissing: number;
    unresolvedCount: number;
  };
  verdict: "ready" | "minor-gaps" | "not-ready";
}
