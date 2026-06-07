import React from "react";
import Link from "next/link";
import { buildReviewPacket, getRawSubmissionJson } from "@/lib/coverage";
import { CUSTOMERS, DEFAULT_CUSTOMER_ID, getCustomer } from "@/lib/customers";
import type { CoverageCellResult, LaunchPlanEntry, Channel } from "@/lib/types";

const VERDICT_COPY = {
  ready: {
    label: "Ready for sign-off",
    blurb:
      "All planned launch cells have matching sandbox transactions and no unresolved entries.",
    color: "var(--yc-good)",
    bg: "var(--yc-good-bg)",
  },
  "minor-gaps": {
    label: "Minor gaps — review before sign-off",
    blurb:
      "Coverage is partial. Decide whether to request the missing sandbox runs or proceed.",
    color: "var(--yc-warn)",
    bg: "var(--yc-warn-bg)",
  },
  "not-ready": {
    label: "Not ready — unresolved launch entries",
    blurb:
      "The customer asked to launch with channels that don't exist in the current catalog. Resolve the launch plan before issuing live credentials.",
    color: "var(--yc-bad)",
    bg: "var(--yc-bad-bg)",
  },
} as const;

interface CoverageRow {
  entry: LaunchPlanEntry;
  channel: Channel;
  success: CoverageCellResult;
  failure: CoverageCellResult;
}

function groupCoverageByChannel(coverage: CoverageCellResult[]): CoverageRow[] {
  const map = new Map<string, CoverageRow>();
  for (const result of coverage) {
    const key = result.channel.channelId;
    const existing = map.get(key);
    if (existing) {
      if (result.outcome === "success") existing.success = result;
      else existing.failure = result;
    } else {
      map.set(key, {
        entry: result.entry,
        channel: result.channel,
        success: result.outcome === "success" ? result : ({} as CoverageCellResult),
        failure: result.outcome === "failure" ? result : ({} as CoverageCellResult),
      });
    }
  }
  return Array.from(map.values());
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
}

function fmtDateOnly(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function ReviewPacketPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const params = await searchParams;
  const currentId = getCustomer(params.customer).id;
  const packet = buildReviewPacket(currentId);
  const verdict = VERDICT_COPY[packet.verdict];
  const grouped = groupCoverageByChannel(packet.coverage);
  const rawSubmission = getRawSubmissionJson(currentId);

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 32px 80px" }}>
      <Disclaimer />

      <CustomerTabs currentId={currentId} />

      <header style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: "var(--yc-yellow)",
              fontWeight: 600,
            }}
          >
            Yellow Card · Go-Live Review Packet
          </div>
          <div style={{ fontSize: 12, color: "var(--yc-muted)" }} className="mono">
            Auto-assembled · {fmtDate(packet.submission.submittedAt)}
          </div>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "4px 0 4px", color: "var(--yc-text-strong)" }}>
          {packet.submission.businessName}
        </h1>
        <div style={{ color: "var(--yc-muted)", fontSize: 14 }}>
          {packet.submission.useCase}
        </div>
      </header>

      <section
        style={{
          background: verdict.bg,
          borderLeft: `4px solid ${verdict.color}`,
          padding: "16px 20px",
          borderRadius: 6,
          marginBottom: 28,
        }}
      >
        <div style={{ fontWeight: 600, color: verdict.color, fontSize: 15 }}>
          {verdict.label}
        </div>
        <div style={{ fontSize: 13, marginTop: 4, color: "var(--yc-text)" }}>
          {verdict.blurb}
        </div>
        <div style={{ marginTop: 16 }}>
          <MetricsRow>
            <MetricCard
              value={`${packet.stats.cellsCovered}/${packet.stats.cellsRequired}`}
              label="coverage cells observed"
              tone={packet.stats.cellsCovered === packet.stats.cellsRequired ? "good" : "neutral"}
            />
            <MetricCard
              value={packet.stats.cellsMissing}
              label="cells missing"
              tone={packet.stats.cellsMissing > 0 ? "warn" : "neutral"}
            />
            <MetricCard
              value={packet.stats.unresolvedCount}
              label="unresolved entries"
              tone={packet.stats.unresolvedCount > 0 ? "bad" : "neutral"}
            />
            <MetricCard
              value={grouped.length}
              label="channels resolved"
              tone="neutral"
            />
          </MetricsRow>
        </div>
      </section>

      <Section title="Customer details">
        <KvGrid
          rows={[
            ["Primary contact", `${packet.submission.primaryContact.name} · ${packet.submission.primaryContact.role}`],
            ["Contact email", packet.submission.primaryContact.email],
            ["Requested go-live", fmtDateOnly(packet.submission.requestedGoLiveDate)],
            ["Use case", packet.submission.useCase],
          ]}
        />
      </Section>

      <Section
        title="Sandbox coverage matrix"
        subtitle="Each row is a channel the customer asked to launch with, resolved from their submitted (country, channelType, direction) tuple. One submission entry can resolve to multiple channels (e.g. ZA bank send → EFT and Automated Batched Payment) and each is checked independently. Matches show the customer's sequenceId for that sandbox transaction."
      >
        <div
          style={{
            border: "1px solid var(--yc-border-strong)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  background: "var(--yc-card-alt)",
                  textAlign: "left",
                  borderBottom: "1px solid var(--yc-yellow-rule)",
                }}
              >
                <th style={th}>Country</th>
                <th style={thDiv}>Type</th>
                <th style={thDiv}>Direction</th>
                <th style={thDiv}>Method (resolved)</th>
                <th style={thDiv}>Success</th>
                <th style={thDiv}>Failure</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((row, idx) => (
                <React.Fragment key={row.channel.channelId}>
                  <tr
                    style={{
                      borderTop: idx === 0 ? "none" : "1px solid var(--yc-border)",
                      background: idx % 2 === 1 ? "var(--yc-row-alt)" : "transparent",
                    }}
                  >
                    <td style={tdFirst}>
                      <div>{row.channel.countryName}</div>
                      <div className="mono" style={countryCodeStyle}>
                        {row.channel.country}
                      </div>
                    </td>
                    <td style={td}>
                      <Pill>{row.channel.channelType}</Pill>
                    </td>
                    <td style={td}>{row.channel.direction}</td>
                    <td style={td}>
                      <div>{row.channel.paymentMethod}</div>
                      <div className="mono" style={countryCodeStyle}>
                        {row.channel.channelId}
                      </div>
                    </td>
                    <td style={td}>
                      <OutcomeCell result={row.success} />
                    </td>
                    <td style={td}>
                      <OutcomeCell result={row.failure} />
                    </td>
                  </tr>
                  {row.entry.notesNotTested && (
                    <tr
                      style={{
                        background: idx % 2 === 1 ? "var(--yc-row-alt)" : "transparent",
                      }}
                    >
                      <td
                        colSpan={6}
                        style={{
                          padding: "0 12px 12px 12px",
                          fontSize: 12,
                          color: "var(--yc-muted)",
                          lineHeight: 1.5,
                          fontStyle: "italic",
                        }}
                      >
                        <span style={{ color: "var(--yc-yellow)", fontStyle: "normal", marginRight: 6 }}>
                          ⚐ Not exercised:
                        </span>
                        {row.entry.notesNotTested}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {packet.unresolvedEntries.length > 0 && (
        <Section
          title="Unresolved launch-plan entries"
          subtitle="The customer asked to launch with these tuples but no matching channel exists in the current channels catalog."
        >
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {packet.unresolvedEntries.map((e, i) => (
              <li key={i} style={{ marginBottom: 4 }} className="mono">
                {e.country} · {e.channelType} · {e.direction}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Customer self-attestations"
        subtitle="Captured from the submission. These are values the reviewer would otherwise chase by email or Slack."
      >
        <KvGrid
          rows={[
            ["Production static IPs", packet.submission.selfAttestations.productionStaticIps.join(", "), true],
            ["Requested API key scope", packet.submission.selfAttestations.requestedKeyScope],
            ["Top-up stablecoin", `${packet.submission.selfAttestations.topUpStablecoin} on ${packet.submission.selfAttestations.topUpNetwork}`],
            ["Top-up tx hash", packet.submission.selfAttestations.topUpTxHash, true],
            ["KYC tier plan", packet.submission.selfAttestations.kycTierPlan],
          ]}
        />
      </Section>

      <Section
        title="Raw customer submission"
        subtitle="The exact JSON the customer uploaded. Everything in this packet is derived from this file plus the channels lookup and the customer's sandbox transaction history."
        defaultOpen={false}
      >
        <pre
          className="mono"
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--yc-text)",
            background: "var(--yc-card-alt)",
            padding: 14,
            border: "1px solid var(--yc-border)",
            borderRadius: 6,
            overflowX: "auto",
            whiteSpace: "pre",
          }}
        >
{JSON.stringify(rawSubmission, null, 2)}
        </pre>
      </Section>
    </main>
  );
}

function Disclaimer() {
  return (
    <div
      style={{
        background: "var(--yc-yellow-bg)",
        border: "1px solid var(--yc-yellow-border)",
        color: "var(--yc-yellow-soft)",
        padding: "10px 14px",
        borderRadius: 6,
        fontSize: 12,
        marginBottom: 20,
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: "var(--yc-yellow)" }}>Demo · mocked data.</strong>{" "}
      In a live deployment, the dashboard would query the customer's sandbox API
      (channels catalog + transaction history) using their sandbox credentials.
      Everything below is rendered from static JSON fixtures so that the review
      flow can be evaluated end-to-end without a live sandbox connection.
    </div>
  );
}

function CustomerTabs({ currentId }: { currentId: string }) {
  return (
    <nav
      aria-label="Demo customer selector"
      style={{
        display: "flex",
        gap: 4,
        marginBottom: 22,
        borderBottom: "1px solid var(--yc-border)",
        overflowX: "auto",
      }}
    >
      {CUSTOMERS.map((c) => {
        const active = c.id === currentId;
        const href = c.id === DEFAULT_CUSTOMER_ID ? "/" : `/?customer=${c.id}`;
        return (
          <Link
            key={c.id}
            href={href}
            style={{
              padding: "10px 14px",
              textDecoration: "none",
              borderBottom: active
                ? "2px solid var(--yc-yellow)"
                : "2px solid transparent",
              marginBottom: -1,
              color: active ? "var(--yc-yellow)" : "var(--yc-muted)",
              fontSize: 13,
              fontWeight: 500,
              minWidth: 160,
            }}
          >
            <div>{c.label}</div>
            <div
              style={{
                fontSize: 11,
                color: "var(--yc-muted)",
                marginTop: 2,
                fontWeight: 400,
              }}
            >
              {c.blurb}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

function Section({
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} style={{ marginBottom: 24 }}>
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 0",
          userSelect: "none",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 12,
            color: "var(--yc-yellow)",
            fontSize: 10,
            transition: "transform 0.15s",
          }}
          className="section-chevron"
        >
          ▸
        </span>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--yc-yellow)",
            letterSpacing: 0.2,
            margin: 0,
          }}
        >
          {title}
        </h2>
      </summary>
      {subtitle && (
        <div
          style={{
            fontSize: 12,
            color: "var(--yc-muted)",
            marginTop: 6,
            marginBottom: 14,
            maxWidth: 760,
            lineHeight: 1.55,
            paddingLeft: 22,
          }}
        >
          {subtitle}
        </div>
      )}
      <div
        style={{
          background: "var(--yc-card)",
          border: "1px solid var(--yc-border-strong)",
          borderRadius: 8,
          padding: 18,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          marginTop: subtitle ? 0 : 10,
        }}
      >
        {children}
      </div>
    </details>
  );
}

function MetricsRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

type MetricTone = "good" | "bad" | "warn" | "neutral";

const TONE_STYLES: Record<MetricTone, { value: string; bg: string; border: string }> = {
  good: {
    value: "var(--yc-good)",
    bg: "rgba(70, 194, 133, 0.06)",
    border: "rgba(70, 194, 133, 0.30)",
  },
  bad: {
    value: "var(--yc-bad)",
    bg: "rgba(255, 93, 82, 0.06)",
    border: "rgba(255, 93, 82, 0.30)",
  },
  warn: {
    value: "var(--yc-yellow)",
    bg: "rgba(255, 207, 51, 0.06)",
    border: "rgba(255, 207, 51, 0.30)",
  },
  neutral: {
    value: "var(--yc-text-strong)",
    bg: "rgba(255, 255, 255, 0.04)",
    border: "var(--yc-border)",
  },
};

function MetricCard({
  value,
  label,
  tone = "neutral",
}: {
  value: number | string;
  label: string;
  tone?: MetricTone;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 6,
        background: t.bg,
        border: `1px solid ${t.border}`,
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: t.value,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--yc-muted)",
          marginTop: 6,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function KvGrid({ rows }: { rows: Array<[string, string, boolean?]> }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        rowGap: 10,
        columnGap: 18,
        fontSize: 13,
      }}
    >
      {rows.map(([k, v, mono]) => (
        <React.Fragment key={k}>
          <div style={{ color: "var(--yc-muted)" }}>{k}</div>
          <div className={mono ? "mono" : undefined}>{v}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: "var(--yc-yellow-bg)",
        border: "1px solid var(--yc-yellow-border)",
        color: "var(--yc-yellow-soft)",
        fontSize: 11,
        letterSpacing: 0.4,
      }}
    >
      {children}
    </span>
  );
}

function OutcomeCell({ result }: { result: CoverageCellResult }) {
  if (!result || !result.matchedTransactions) {
    return <span style={{ color: "var(--yc-muted)" }}>—</span>;
  }
  const matched = result.matchedTransactions;
  if (matched.length === 0) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--yc-bad)",
          background: "var(--yc-bad-bg)",
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        ✕ missing
      </span>
    );
  }
  const first = matched[0];
  return (
    <div>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--yc-good)",
          background: "var(--yc-good-bg)",
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 12,
          marginBottom: 4,
        }}
      >
        ✓ observed{matched.length > 1 ? ` (${matched.length})` : ""}
      </span>
      <div className="mono" style={{ fontSize: 11, color: "var(--yc-muted)" }}>
        {first.sequenceId}
      </div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--yc-muted)", opacity: 0.7 }}>
        {fmtDate(first.createdAt)}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: "var(--yc-muted)",
  fontWeight: 600,
  padding: "10px 12px",
};

const thDiv: React.CSSProperties = {
  ...th,
  borderLeft: "1px solid var(--yc-border)",
};

const td: React.CSSProperties = {
  padding: "12px",
  verticalAlign: "top",
  borderLeft: "1px solid var(--yc-border)",
};

const tdFirst: React.CSSProperties = {
  padding: "12px",
  verticalAlign: "top",
  color: "var(--yc-text-strong)",
  fontWeight: 500,
};

const countryCodeStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: "var(--yc-muted)",
  marginTop: 2,
};
