import { Link } from "wouter";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  Bot,
  Database,
  Inbox,
  Mail,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserCheck,
  Workflow,
  Timer,
  type LucideIcon,
} from "lucide-react";

type Step = { icon: LucideIcon; title: string; text: string };

const steps: Step[] = [
  {
    icon: Inbox,
    title: "1. Requester submits a ticket",
    text: "Title, description and category. The API stores it and sets the SLA deadline from the priority (P1 = 1h, P2 = 4h, P3 = 8h, P4 = 24h).",
  },
  {
    icon: Database,
    title: "2. Knowledge is retrieved (RAG)",
    text: "The ticket text is embedded and matched against knowledge-base articles stored in PostgreSQL with pgvector.",
  },
  {
    icon: Bot,
    title: "3. The AI service analyzes it",
    text: "A FastAPI service receives the ticket plus the best matching articles and returns category, priority, urgency, summary, suggested team, a draft reply and possible duplicates.",
  },
  {
    icon: UserCheck,
    title: "4. An agent decides",
    text: "Suggestions appear on the ticket. The agent accepts, edits or ignores each one. Nothing is changed automatically.",
  },
  {
    icon: Workflow,
    title: "5. n8n automates the follow-up",
    text: "Workflows send notifications, warn before an SLA is breached, escalate P1 tickets and ask for feedback after resolution.",
  },
];

const features: { icon: LucideIcon; title: string; points: string[] }[] = [
  {
    icon: Ticket,
    title: "Tickets & SLAs",
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
    points: [
      "New ticket: notify support and request analysis",
      "SLA warning: alert the assigned agent",
      "P1 escalation: notify admins on breach",
      "Resolution follow-up: request a satisfaction rating",
    ],
  },
];

const roles = [
  { name: "Requester", text: "Creates tickets, follows progress, closes resolved tickets and rates the support." },
  { name: "Agent", text: "Works the queue, reviews AI suggestions, assigns, comments and resolves." },
  { name: "Admin", text: "Manages users, SLA rules, the knowledge base and watches workload and automation health." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            HelpDeskAI
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <a href="#how" className="hidden px-3 py-2 hover:underline sm:inline">How it works</a>
            <a href="#features" className="hidden px-3 py-2 hover:underline sm:inline">Features</a>
            <Link href="/login" className="rounded-md border px-3 py-2 hover:bg-muted">
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-primary px-3 py-2 text-primary-foreground hover:opacity-90"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> AI-assisted IT support, with a human always in control
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            An IT helpdesk that reads, suggests and automates — and lets people decide.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            HelpDeskAI combines ticketing and SLA tracking with retrieval-augmented AI analysis and n8n
            workflows, so agents spend less time triaging and more time solving.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-primary-foreground hover:opacity-90"
            >
              Create an account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="rounded-md border px-5 py-2.5 hover:bg-muted">
              Sign in
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t bg-muted/40 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-2xl font-semibold">How a ticket flows through the system</h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
              From the moment a request is submitted to the follow-up after it is resolved.
            </p>
            <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {steps.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-xl border bg-background p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>

            {/* Architecture strip */}
            <div className="mt-10 overflow-x-auto rounded-xl border bg-background p-5">
              <div className="flex min-w-[720px] items-center justify-between gap-2 text-xs sm:text-sm">
                {["React app", "Express API", "PostgreSQL + pgvector", "FastAPI AI service", "n8n", "Email / Mailpit"].map(
                  (node, i, arr) => (
                    <div key={node} className="flex items-center gap-2">
                      <div className="rounded-lg border bg-muted px-3 py-2 text-center font-medium">{node}</div>
                      {i < arr.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </div>
                  ),
                )}
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                The API is the single source of truth: roles, status changes and audit records always go through it.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-2xl font-semibold">What's inside</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {features.map(({ icon: Icon, title, points }) => (
                <div key={title} className="rounded-xl border p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-medium">{title}</h3>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    {points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Human in the loop + SLA + notifications */}
        <section className="border-t bg-muted/40 py-16">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 md:grid-cols-3">
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
              <div key={title} className="rounded-xl border bg-background p-5">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-medium">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Roles */}
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-2xl font-semibold">Built for three roles</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {roles.map((r) => (
                <div key={r.name} className="rounded-xl border p-5">
                  <h3 className="font-medium">{r.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t py-16 text-center">
          <h2 className="text-2xl font-semibold">Ready to try it?</h2>
          <p className="mt-2 text-muted-foreground">Sign in with your account or create a requester account.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/login" className="rounded-md bg-primary px-5 py-2.5 text-primary-foreground hover:opacity-90">
              Sign in
            </Link>
            <Link href="/register" className="inline-flex items-center gap-2 rounded-md border px-5 py-2.5 hover:bg-muted">
              <Mail className="h-4 w-4" /> Register
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        HelpDeskAI · portfolio project
      </footer>
    </div>
  );
}