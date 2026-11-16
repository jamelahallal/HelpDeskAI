import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Inbox,
  Mail,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Timer,
  UserCheck,
  Workflow,
  type LucideIcon,
} from "lucide-react";

type Step = {
  number: string;
  icon: LucideIcon;
  title: string;
  text: string;
  badge: string;
};

const steps: Step[] = [
  {
    number: "01",
    icon: Inbox,
    title: "Requester submits a ticket",
    badge: "SLA Timer Starts",
    text: "Title, description and category. The API stores it and sets the SLA deadline from the priority (P1 = 1h, P2 = 4h, P3 = 8h, P4 = 24h).",
  },
  {
    number: "02",
    icon: Database,
    title: "Knowledge is retrieved (RAG)",
    badge: "pgvector Search",
    text: "The ticket text is embedded and matched against knowledge-base articles stored in PostgreSQL with pgvector.",
  },
  {
    number: "03",
    icon: Bot,
    title: "The AI service analyzes it",
    badge: "FastAPI + Schema",
    text: "A FastAPI service receives the ticket plus the best matching articles and returns category, priority, urgency, summary, suggested team, a draft reply and possible duplicates.",
  },
  {
    number: "04",
    icon: UserCheck,
    title: "An agent decides",
    badge: "Human-in-the-Loop",
    text: "Suggestions appear on the ticket. The agent accepts, edits or ignores each one. Nothing is changed automatically.",
  },
  {
    number: "05",
    icon: Workflow,
    title: "n8n automates the follow-up",
    badge: "Event Workflows",
    text: "Workflows send notifications, warn before an SLA is breached, escalate P1 tickets and ask for feedback after resolution.",
  },
];

const features: {
  icon: LucideIcon;
  title: string;
  accent: string;
  points: string[];
}[] = [
  {
    icon: Ticket,
    title: "Tickets & SLAs",
    accent: "bg-blue-500/10 text-blue-600 border-blue-200/60",
    points: [
      "Lifecycle: new → assigned → in progress → resolved → closed",
      "Public comments and agent-only internal notes",
      "At risk at 75% of the SLA, breached when the deadline passes",
      "Full audit history and assignment history",
    ],
  },
  {
    icon: Sparkles,
    title: "AI analysis",
    accent: "bg-indigo-500/10 text-indigo-600 border-indigo-200/60",
    points: [
      "Suggested category, priority, urgency and summary",
      "Suggested support team and draft response",
      "Duplicate-ticket detection",
      "Schema-validated output, stored separately from approved values",
    ],
  },
  {
    icon: BookOpen,
    title: "Knowledge base & RAG",
    accent: "bg-emerald-500/10 text-emerald-600 border-emerald-200/60",
    points: [
      "Agents and admins manage articles",
      "Articles are embedded and searched with pgvector",
      "Relevant excerpts ground the AI's suggested reply",
      "Agents can see which articles were used and why",
    ],
  },
  {
    icon: Workflow,
    title: "n8n automation",
    accent: "bg-amber-500/10 text-amber-600 border-amber-200/60",
    points: [
      "New ticket: notify support and request analysis",
      "SLA warning: alert the assigned agent",
      "P1 escalation: notify admins on breach",
      "Resolution follow-up: request a satisfaction rating",
    ],
  },
];

const roles = [
  {
    name: "Requester",
    tag: "Self-Service Portal",
    color: "border-t-blue-500",
    text: "Creates tickets, follows progress, closes resolved tickets and rates the support.",
  },
  {
    name: "Agent",
    tag: "AI-Assisted Workspace",
    color: "border-t-indigo-600",
    text: "Works the queue, reviews AI suggestions, assigns, comments and resolves.",
  },
  {
    name: "Admin",
    tag: "System & SLA Control",
    color: "border-t-emerald-500",
    text: "Manages users, SLA rules, the knowledge base and watches workload and automation health.",
  },
];

export default function HomePage() {
  const [suggestionStatus, setSuggestionStatus] = useState<"pending" | "accepted" | "ignored">("pending");

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-slate-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <span className="text-lg">
              HelpDesk<span className="text-indigo-600">AI</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
            <a
              href="#how"
              className="hidden rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-block"
            >
              How it works
            </a>
            <a
              href="#features"
              className="hidden rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-block"
            >
              Features
            </a>
            <Link
              href="/login"
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-slate-700 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-50"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-3.5 py-2 text-white shadow-sm shadow-indigo-600/25 transition-all hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-600/20"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section with Subtle Glow & Interactive Demo Card */}
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-white pt-14 pb-20 sm:pt-20 sm:pb-24">
          {/* Decorative background gradient */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-40 -z-0 flex justify-center overflow-hidden blur-3xl"
          >
            <div className="h-[340px] w-[780px] rounded-full bg-gradient-to-tr from-indigo-100 via-blue-50 to-purple-100 opacity-80" />
          </div>

          <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3.5 py-1 text-xs font-medium text-indigo-700 shadow-2xs">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                AI-assisted IT support, with a human always in control
              </span>

              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.12]">
                An IT helpdesk that reads, suggests and automates —{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  and lets people decide.
                </span>
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                HelpDeskAI combines ticketing and SLA tracking with retrieval-augmented AI analysis and n8n
                workflows, so agents spend less time triaging and more time solving.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-all hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30"
                >
                  Create an account <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900"
                >
                  Sign in
                </Link>
              </div>
            </div>

            {/* Interactive Live Ticket Triage Preview */}
            <div className="mx-auto mt-14 max-w-4xl rounded-2xl border border-slate-200/90 bg-slate-900 p-2 shadow-2xl shadow-slate-900/10">
              <div className="rounded-xl bg-white p-5 sm:p-6">
                {/* Mock Window Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
                      #TCK-1042
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      VPN disconnects every 15 mins on macOS Sequoia
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      <Clock className="h-3 w-3" /> SLA: 3h 42m left (P2)
                    </span>
                  </div>
                </div>

                {/* Split View: Ticket Body + AI Suggestion */}
                <div className="mt-4 grid gap-5 md:grid-cols-5">
                  <div className="space-y-3 md:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Requester Note
                    </div>
                    <p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                      "Ever since updating my MacBook this morning, WireGuard drops connection every 15 minutes and
                      forces me to re-authenticate SSO."
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Database className="h-3.5 w-3.5 text-emerald-600" />
                      <span>
                        Matched KB: <strong className="font-medium text-slate-700">KB-089 (94% match)</strong>
                      </span>
                    </div>
                  </div>

                  {/* Interactive AI Triage Box */}
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 md:col-span-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                        <Bot className="h-4 w-4" /> AI Triage Suggestion
                      </span>
                      {suggestionStatus === "pending" && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-600 shadow-2xs">
                          Awaiting agent review
                        </span>
                      )}
                      {suggestionStatus === "accepted" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" /> Applied to Ticket
                        </span>
                      )}
                      {suggestionStatus === "ignored" && (
                        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                          Dismissed
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-md border border-indigo-200/70 bg-white px-2 py-1 text-slate-700">
                        Team: <strong>Network Ops</strong>
                      </span>
                      <span className="rounded-md border border-indigo-200/70 bg-white px-2 py-1 text-slate-700">
                        Priority: <strong className="text-amber-600">P2 · High</strong>
                      </span>
                    </div>

                    <p className="mt-3 rounded-lg border border-indigo-100 bg-white p-2.5 text-xs leading-relaxed text-slate-600">
                      <span className="font-semibold text-slate-800">Draft reply:</span> Hi! This is a known MTU
                      token refresh issue on macOS Sequoia. Please reset your WireGuard profile via Self-Service...
                    </p>

                    <div className="mt-3.5 flex items-center justify-between gap-2">
                      {suggestionStatus === "pending" ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setSuggestionStatus("accepted")}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-indigo-700"
                          >
                            <Check className="h-3.5 w-3.5" /> Accept & Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => setSuggestionStatus("ignored")}
                            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            Ignore
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSuggestionStatus("pending")}
                          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          <RotateCcw className="h-3 w-3" /> Reset interactive demo
                        </button>
                      )}
                      <span className="text-[11px] text-slate-400">Try clicking a button</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                End-to-End Pipeline
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                How a ticket flows through the system
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                From the moment a request is submitted to the follow-up after it is resolved.
              </p>
            </div>

            <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {steps.map(({ number, icon: Icon, title, text, badge }) => (
                <li
                  key={title}
                  className="group relative rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {badge}
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-600">{number}</span>
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
                </li>
              ))}
            </ol>

            {/* Dark Architecture Strip for Visual Contrast */}
            <div className="mt-12 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 text-white shadow-lg">
              <div className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-indigo-400">
                System Architecture
              </div>
              <div className="flex min-w-[740px] items-center justify-between gap-2 text-xs sm:text-sm">
                {[
                  "React app",
                  "Express API",
                  "PostgreSQL + pgvector",
                  "FastAPI AI service",
                  "n8n",
                  "Email / Mailpit",
                ].map((node, i, arr) => (
                  <div key={node} className="flex items-center gap-2">
                    <div className="rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-center font-medium text-slate-100 shadow-inner">
                      {node}
                    </div>
                    {i < arr.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-indigo-400" />}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-slate-400">
                The API is the single source of truth: roles, status changes and audit records always go through it.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-slate-200/80 bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Capabilities
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">What's inside</h2>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {features.map(({ icon: Icon, title, accent, points }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-6 transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                  </div>
                  <ul className="mt-5 space-y-2.5 text-sm text-slate-600">
                    {points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Human in the loop + SLA + notifications */}
        <section className="border-t border-slate-200/80 bg-slate-50/70 py-16">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-3">
            {[
              {
                icon: UserCheck,
                title: "Human in the loop",
                text: "AI output is a suggestion. It never assigns, resolves or closes a ticket without an agent's approval.",
              },
              {
                icon: Timer,
                title: "SLA-driven",
                text: "Every ticket carries a deadline. Warnings and escalations fire before and after it is missed.",
              },
              {
                icon: BellRing,
                title: "Stay informed",
                text: "In-app notifications and email for created, assigned, status-changed, SLA-warning and resolved events.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Roles */}
        <section className="border-t border-slate-200/80 bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Role-Based Access
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Built for three roles</h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {roles.map((r) => (
                <div
                  key={r.name}
                  className={`rounded-2xl border border-t-4 border-slate-200/90 ${r.color} bg-white p-6 shadow-2xs transition hover:shadow-md`}
                >
                  <span className="text-xs font-medium text-slate-500">{r.tag}</span>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{r.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="border-t border-slate-200/80 bg-slate-50 py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 px-6 py-14 text-center text-white shadow-xl shadow-indigo-900/15 sm:px-12">
              <h2 className="text-3xl font-bold tracking-tight">Ready to try it?</h2>
              <p className="mx-auto mt-3 max-w-md text-indigo-100">
                Sign in with your account or create a requester account to test the AI triage pipeline.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3.5">
                <Link
                  href="/login"
                  className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/50 bg-indigo-600/40 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xs transition hover:bg-indigo-500/50"
                >
                  <Mail className="h-4 w-4" /> Register
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        HelpDeskAI · Full-Stack AI & Workflow Portfolio Project
      </footer>
    </div>
  );
}