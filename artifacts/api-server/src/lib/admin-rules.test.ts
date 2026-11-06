import assert from "node:assert/strict";
import test from "node:test";
import { userChangeProblem, validateSlaHours } from "./admin-rules";

const valid = { P1: 1, P2: 4, P3: 8, P4: 24 };

test("default SLA hours are valid", () => {
  assert.equal(validateSlaHours(valid), null);
});

test("equal hours across priorities are allowed", () => {
  assert.equal(validateSlaHours({ P1: 2, P2: 2, P3: 2, P4: 2 }), null);
});

test("an urgent priority cannot get more time than a relaxed one", () => {
  assert.match(validateSlaHours({ ...valid, P1: 5 }) ?? "", /P1 cannot allow more time than P2/);
  assert.match(validateSlaHours({ ...valid, P4: 6 }) ?? "", /P3 cannot allow more time than P4/);
});

test("SLA hours must be whole numbers within range", () => {
  assert.match(validateSlaHours({ ...valid, P1: 0 }) ?? "", /P1 must be a whole number/);
  assert.match(validateSlaHours({ ...valid, P2: 2.5 }) ?? "", /P2 must be a whole number/);
  assert.match(validateSlaHours({ ...valid, P4: 721 }) ?? "", /P4 must be a whole number/);
});

const admin = { id: "admin-1", role: "admin" as const, isActive: true };
const agent = { id: "agent-1", role: "agent" as const, isActive: true };

test("an admin cannot demote or deactivate themselves", () => {
  assert.ok(userChangeProblem({ actorId: "admin-1", target: admin, changes: { role: "agent" }, openAssignedTickets: 0 }));
  assert.ok(userChangeProblem({ actorId: "admin-1", target: admin, changes: { isActive: false }, openAssignedTickets: 0 }));
});

test("an admin can still edit their own non-privileged fields", () => {
  assert.equal(userChangeProblem({ actorId: "admin-1", target: admin, changes: { role: "admin", isActive: true }, openAssignedTickets: 0 }), null);
  assert.equal(userChangeProblem({ actorId: "admin-1", target: admin, changes: {}, openAssignedTickets: 0 }), null);
});

test("staff with open tickets cannot be deactivated or demoted", () => {
  assert.match(userChangeProblem({ actorId: "admin-1", target: agent, changes: { isActive: false }, openAssignedTickets: 3 }) ?? "", /3 open tickets/);
  assert.match(userChangeProblem({ actorId: "admin-1", target: agent, changes: { role: "requester" }, openAssignedTickets: 1 }) ?? "", /1 open ticket\./);
});

test("staff with no open tickets can be deactivated, and agent to admin is always allowed", () => {
  assert.equal(userChangeProblem({ actorId: "admin-1", target: agent, changes: { isActive: false }, openAssignedTickets: 0 }), null);
  assert.equal(userChangeProblem({ actorId: "admin-1", target: agent, changes: { role: "admin" }, openAssignedTickets: 5 }), null);
});

test("reactivating an already-inactive user is not treated as a deactivation", () => {
  const inactiveAgent = { ...agent, isActive: false };
  assert.equal(userChangeProblem({ actorId: "admin-1", target: inactiveAgent, changes: { isActive: false }, openAssignedTickets: 2 }), null);
});
