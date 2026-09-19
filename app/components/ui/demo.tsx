import * as React from "react";
import {
  AgentWorkflow,
  type AgentPhase,
  type ToolDefinition,
} from "~/components/ui/ai-agent-response";
import { RotateCcw, Database, ShieldCheck, Cpu } from "lucide-react";

export const CUSTOM_TOOLS: Record<string, ToolDefinition> = {
  db_inspect: {
    name: "db_inspect",
    label: "Inspect Schema",
    icon: Database,
    iconClassName: "text-emerald-500",
    monoChip: true,
  },
  vuln_scan: {
    name: "vuln_scan",
    label: "Security Audit",
    icon: ShieldCheck,
    iconClassName: "text-rose-500",
  },
  cluster_exec: {
    name: "cluster_exec",
    label: "Deploy Canary",
    icon: Cpu,
    iconClassName: "text-sky-500",
    monoChip: true,
  },
};

export const MULTI_ROUND_AGENT_WORKFLOW: AgentPhase[] = [
  // ── PHASE 1: Audit & Discovery ──
  {
    trace: [
      {
        type: "reasoning",
        sentences: [
          "Auditing authentication middleware AST for algorithm injection vulnerabilities and permissive defaults.",
          "Inspecting the global Express auth middleware call tree to locate the jwt.verify invocation.",
          "The current verify implementation accepts undefined algorithms, exposing an algorithm confusion vulnerability ('none' cipher exploit).",
          "Tracing where process.env.JWT_SECRET is sourced to guarantee the cryptographic key is never exposed via response headers.",
          "Analyzing the token expiration timestamp format to prevent UNIX 2038 integer wrap-around errors.",
          "Formulating a strict allowlist schema requiring HS256 algorithm pinning across all protected API routes.",
        ],
        durationSeconds: 9.8,
      },
      {
        type: "tool",
        toolName: "vuln_scan",
        secondary: "AST Check (3 files)",
        details: [
          { text: "✓ Found jwt.verify call at line 42 with missing algorithm constraint" },
          { text: "✓ Verified process.env.JWT_SECRET is isolated from debug log streams" },
        ],
      },
      {
        type: "tool",
        primary: "Read AST tree",
        secondary: "src/types/auth.d.ts",
        mono: true,
        details: [
          { text: "export interface AuthSession { sub: string; role: Role; exp: number }" },
          { text: "3 imported downstream route handlers depend on this contract" },
        ],
      },
      {
        type: "search",
        primary: "Search mitigation specs",
        secondary: "RFC 7519 algorithm confusion",
        sources: [
          { name: "Auth0 Security Advisory", url: "https://auth0.com" },
          { name: "Node JOSE Standards", url: "https://github.com" },
          { name: "OWASP JWT Cheat Sheet", url: "https://owasp.org" },
        ],
      },
    ],
    message: "I completed the security audit. Found an unpinned algorithm vulnerability in `src/middleware/auth.ts` that could allow unsigned tokens. Beginning the patch and LRU revocation cache implementation now.",
  },

  // ── PHASE 2: Code Patching, In-Memory Cache & Terminal Test Run ──
  {
    trace: [
      {
        type: "reasoning",
        sentences: [
          "Designing an in-memory sliding LRU cache with an automatic 15-minute TTL to track revoked token fingerprints.",
          "Ensuring thread safety and race-condition immunity during concurrent cache writes during cluster renewal handshakes.",
          "Adding a 10-second clock tolerance window (clockTolerance: 10) to guard against minor NTP drift between edge regions.",
          "Refactoring the jwt.verify wrapper to reject any payload lacking valid issuer and audience claim signatures.",
          "Injecting comprehensive TypeScript assertions to validate the patched session envelope.",
        ],
        durationSeconds: 10.4,
      },
      {
        type: "tool",
        primary: "Patch file",
        secondary: "src/auth/jwt-verifier.ts",
        mono: true,
        add: 3,
        del: 1,
        diffFile: "src/auth/jwt-verifier.ts",
        diffRows: [
          { old: 12, cur: 12, type: "ctx", text: "export const verifyOptions: jwt.VerifyOptions = {" },
          { old: 13, cur: null, type: "del", text: "  algorithms: undefined," },
          { old: null, cur: 13, type: "add", text: "  algorithms: ['HS256'], // pinned against cipher downgrade" },
          { old: null, cur: 14, type: "add", text: "  issuer: 'api.enterprise.internal'," },
          { old: null, cur: 15, type: "add", text: "  clockTolerance: 10," },
          { old: 14, cur: 16, type: "ctx", text: "};" },
        ],
      },
      {
        type: "tool",
        toolName: "db_inspect",
        secondary: "sessions.revoked_tokens",
        details: [
          { text: "✓ LRU TTL indexed in Redis cluster" },
          { text: "✓ 0 slow query alerts on key expiration" },
        ],
      },
      {
        type: "terminal",
        primary: "Execute tests",
        secondary: "npm run test:auth -- --coverage",
        command: "npm run test:auth -- --coverage",
        exitCode: 0,
        durationMs: 412,
        output: `PASS tests/auth/jwt-verifier.test.ts\n  ✓ should pin HS256 algorithm (18ms)\n  ✓ should reject unsigned tokens with HTTP 401 (12ms)\n  ✓ should validate issuer and audience claims (8ms)\n  ✓ should enforce sliding 15-minute LRU eviction (24ms)\n\nTest Suites: 1 passed, 1 total\nTests:       14 passed, 14 total\nCoverage:    100% Statements, 100% Branches`,
      },
    ],
    message: "Security patch applied and verified with clean TypeScript compilation and 100% test coverage. Moving to adversarial regression testing and cluster canary deployment.",
  },

  // ── PHASE 3: Adversarial Fuzzing, Regression Matrix & Canary ──
  {
    trace: [
      {
        type: "reasoning",
        sentences: [
          "Synthesizing adversarial signature matrix and staging canary environment.",
          "Generating forged JWTs signed with algorithm 'none', asymmetric RSA keys, and corrupted header signatures.",
          "Verifying that all malformed and expired tokens return an unambiguous HTTP 401 Unauthorized without stack traces.",
          "Benchmarking token verification latency under synthetic 5,000 req/s load to confirm p99 stays below 12ms.",
          "Running the canary health probe across staging-cluster-01 before promoting the configuration.",
        ],
        durationSeconds: 8.2,
      },
      {
        type: "tool",
        primary: "Add test matrix",
        secondary: "tests/auth/adversarial.test.ts",
        mono: true,
        add: 6,
        del: 1,
        diffFile: "tests/auth/adversarial.test.ts",
        diffRows: [
          { old: 41, cur: 41, type: "ctx", text: "describe('Adversarial Algorithm Invariant', () => {" },
          { old: 42, cur: null, type: "del", text: "  // TODO: verify algorithm none reject" },
          { old: null, cur: 42, type: "add", text: "  it('should reject algorithm none with HTTP 401', async () => {" },
          { old: null, cur: 43, type: "add", text: "    const forged = forgeUnsignedToken({ sub: 'admin' });" },
          { old: null, cur: 44, type: "add", text: "    await expect(verifySession(forged)).rejects.toThrow('invalid algorithm');" },
          { old: null, cur: 45, type: "add", text: "  });" },
          { old: 43, cur: 46, type: "ctx", text: "});" },
        ],
      },
      {
        type: "terminal",
        primary: "Run canary probe",
        secondary: "kubectl rollout status deployment/auth-service",
        command: "kubectl rollout status deployment/auth-service --namespace=staging",
        exitCode: 0,
        durationMs: 890,
        output: `Waiting for deployment "auth-service" rollout to finish: 1 of 3 updated replicas are available...\nWaiting for deployment "auth-service" rollout to finish: 2 of 3 updated replicas are available...\n✓ deployment "auth-service" successfully rolled out\n✓ Canary probe healthy (p99 latency 9.4ms, 0 errors)`,
      },
      {
        type: "tool",
        toolName: "cluster_exec",
        secondary: "staging-cluster-01",
        details: [
          { text: "Traffic shifted: 10% → 100%" },
          { text: "Cluster latency: p99 9.4ms (Healthy)" },
        ],
      },
    ],
    message: "All 28 regression tests passed with zero regressions. The JWT auth middleware now pins HS256, validates revocation via the LRU cache, and successfully passed canary verification.",
  },
];

export default function ThinkingStateDemo() {
  const [replayKey, setReplayKey] = React.useState(0);

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center justify-start pt-14 pb-28 px-4 sm:px-6 selection:bg-primary/20 antialiased [font-synthesis:none]">
      {/* Floating Replay Action */}
      <div className="fixed top-6 left-6 z-20">
        <button
          type="button"
          onClick={() => setReplayKey((k) => k + 1)}
          className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-all duration-150 hover:border-border hover:text-foreground active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer shadow-xs"
        >
          <RotateCcw className="size-3" aria-hidden="true" />
          <span>Replay</span>
        </button>
      </div>

      {/* Main Chat Thread Container */}
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* User Prompt Message */}
        <div className="flex justify-end">
          <div className="rounded-2xl bg-muted px-4 py-2.5 text-[14px] leading-relaxed text-foreground max-w-[88%] shadow-xs text-balance">
            Can you audit our auth middleware for security vulnerabilities, patch any algorithm bypasses, and add regression tests?
          </div>
        </div>

        {/* Multi-Round Agent Workflow */}
        <div className="flex flex-col">
          <AgentWorkflow
            key={replayKey}
            phases={MULTI_ROUND_AGENT_WORKFLOW}
            tools={CUSTOM_TOOLS}
            workingLabel="Working..."
          />
        </div>
      </div>
    </div>
  );
}
