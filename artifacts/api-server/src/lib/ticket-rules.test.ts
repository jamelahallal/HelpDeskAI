import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSla,
  canChangeAssignment,
  canManageTicket,
  canReadTicket,
  canTransitionTicket,
  createSlaDeadline,
  defaultSlaHours,
  statusAfterAssignment,
} from "./ticket-rules";

const createdAt = new Date("2026-10-28T10:00:00.000Z");
const assignedAgentId = "agent-1";
const requesterId = "requester-1";

test("SLA deadlines follow the priority response-hour rules", () => {
  assert.deepEqual(defaultSlaHours, { P1: 1, P2: 4, P3: 8, P4: 24 });
  assert.equal(
    createSlaDeadline(createdAt, defaultSlaHours.P1).toISOString(),
    "2026-10-28T11:00:00.000Z",
  );
});

test("SLA warning begins at 75 percent, breaches at deadline, and resolves cleanly", () => {
  const deadline = createSlaDeadline(createdAt, 4);
  assert.deepEqual(
    calculateSla("in_progress", createdAt, deadline, createdAt.getTime() + 3 * 60 * 60 * 1000),
    { slaPercent: 75, slaState: "warning" },
  );
  assert.deepEqual(
    calculateSla("assigned", createdAt, deadline, deadline.getTime()),
    { slaPercent: 100, slaState: "breached" },
  );
  assert.deepEqual(
    calculateSla("resolved", createdAt, deadline, createdAt.getTime() + 30_000),
    { slaPercent: 100, slaState: "resolved" },
  );
});

test("ticket visibility is scoped to the user's role and ownership", () => {
  assert.equal(canReadTicket({
    role: "requester", userId: requesterId, requesterId, assignedAgentId,
  }), true);
  assert.equal(canReadTicket({
    role: "requester", userId: "other-requester", requesterId, assignedAgentId,
  }), false);
  assert.equal(canReadTicket({
    role: "agent", userId: assignedAgentId, requesterId, assignedAgentId,
  }), true);
  assert.equal(canReadTicket({
    role: "agent", userId: "other-agent", requesterId, assignedAgentId: null,
  }), true);
  assert.equal(canReadTicket({
    role: "agent", userId: "other-agent", requesterId, assignedAgentId,
  }), false);
  assert.equal(canReadTicket({
    role: "admin", userId: "admin-1", requesterId, assignedAgentId,
  }), true);
});

test("ticket status transitions are linear and role-aware", () => {
  const shared = {
    role: "agent" as const,
    userId: assignedAgentId,
    requesterId,
    assignedAgentId,
    currentStatus: "assigned" as const,
  };
  assert.equal(canTransitionTicket({ ...shared, nextStatus: "in_progress" }), true);
  assert.equal(canTransitionTicket({ ...shared, nextStatus: "resolved" }), false);
  assert.equal(canTransitionTicket({ ...shared, nextStatus: "closed" }), false);
  assert.equal(canTransitionTicket({
    ...shared,
    userId: "other-agent",
    nextStatus: "in_progress",
  }), false);
  assert.equal(canTransitionTicket({
    role: "requester",
    userId: requesterId,
    requesterId,
    assignedAgentId,
    currentStatus: "resolved",
    nextStatus: "closed",
  }), true);
  assert.equal(canTransitionTicket({
    role: "requester",
    userId: "other-requester",
    requesterId,
    assignedAgentId,
    currentStatus: "resolved",
    nextStatus: "closed",
  }), false);
});

test("assignment updates the initial status without skipping later work", () => {
  assert.equal(statusAfterAssignment("new", true), "assigned");
  assert.equal(statusAfterAssignment("assigned", false), "new");
  assert.equal(statusAfterAssignment("in_progress", false), "in_progress");
  assert.equal(canManageTicket("requester"), false);
  assert.equal(canManageTicket("agent"), true);
  assert.equal(canManageTicket("admin"), true);
});

test("agents can only claim unassigned tickets or release their own", () => {
  const base = { role: "agent" as const, userId: "agent-1" };
  assert.equal(canChangeAssignment({ ...base, currentAgentId: null, nextAgentId: "agent-1" }), true);
  assert.equal(canChangeAssignment({ ...base, currentAgentId: "agent-1", nextAgentId: null }), true);
  assert.equal(canChangeAssignment({ ...base, currentAgentId: null, nextAgentId: null }), true);
  assert.equal(canChangeAssignment({ ...base, currentAgentId: null, nextAgentId: "agent-2" }), false);
  assert.equal(canChangeAssignment({ ...base, currentAgentId: "agent-1", nextAgentId: "agent-2" }), false);
  assert.equal(canChangeAssignment({ ...base, currentAgentId: "agent-2", nextAgentId: "agent-1" }), false);
  assert.equal(canChangeAssignment({ ...base, currentAgentId: "agent-2", nextAgentId: null }), false);
});

test("admins can assign to anyone and requesters can never assign", () => {
  assert.equal(canChangeAssignment({ role: "admin", userId: "admin-1", currentAgentId: "agent-2", nextAgentId: "agent-3" }), true);
  assert.equal(canChangeAssignment({ role: "requester", userId: "r-1", currentAgentId: null, nextAgentId: "r-1" }), false);
});
