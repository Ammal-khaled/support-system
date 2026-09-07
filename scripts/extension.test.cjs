const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function harness(failFlag = false) {
  const writes = [];
  const context = vm.createContext({
    importScripts() {}, console, Math,
    getAuthSession: async () => ({ uid: "agent-1", name: "Agent One", idToken: "test-token" }),
    chrome: { runtime: { onInstalled: { addListener() {} }, onMessage: { addListener() {} } },
      tabs: { sendMessage: async () => {} } },
    fetch: async (_url, options) => {
      assert.equal(options.headers.Authorization, "Bearer test-token");
      writes.push(JSON.parse(options.body).writes[0]);
      return { ok: !failFlag, status: failFlag ? 403 : 200, json: async () => ({}) };
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../chrome-extension/background.js"), "utf8"), context);
  return { context, writes };
}

const agent = { agentId: "agent-1", agentName: "Agent One" };
const phrase = { wrongPhrase: "guaranteed refund", severity: "critical" };

test("critical flag creates one linked high-priority ticket after the flag", async () => {
  const { context, writes } = harness();
  await context.checkCritical("A guaranteed refund.", [phrase], [], agent, {});
  assert.equal(writes.length, 2);
  const flag = writes[0].update;
  const ticket = writes[1].update;
  assert.match(flag.name, /\/flags\//);
  assert.equal(ticket.fields.flagRef.referenceValue, flag.name);
  assert.equal(ticket.fields.status.stringValue, "Open");
  assert.equal(ticket.fields.priority.stringValue, "High");
  assert.equal(ticket.fields.createdById.stringValue, agent.agentId);
});

test("failed flag never creates a ticket", async () => {
  const { context, writes } = harness(true);
  await assert.rejects(context.checkCritical("A guaranteed refund.", [phrase], [], agent, {}), /Flag write failed/);
  assert.equal(writes.length, 1);
});

test("soft-skill flag does not create a ticket", async () => {
  const { context, writes } = harness();
  await context.logSoftSkill("A guaranteed refund.", [{ ...phrase, severity: "soft_skill" }], agent);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].update.fields.type.stringValue, "soft_skill");
});

test("a changed account cannot write a flag as another agent", async () => {
  const { context, writes } = harness();
  await assert.rejects(context.checkCritical("A guaranteed refund.", [phrase], [], { ...agent, agentId: "someone-else" }, {}), /account changed/);
  assert.equal(writes.length, 0);
});
