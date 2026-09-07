import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { subscribeAgentActions, subscribeFlags } from "./firestore";

jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((_, name) => name),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => ({ where: args })),
  orderBy: jest.fn((...args) => ({ orderBy: args })),
  limit: jest.fn((count) => ({ limit: count })),
  onSnapshot: jest.fn(() => jest.fn()),
}));

beforeEach(() => {
  jest.clearAllMocks();
  collection.mockImplementation((_, name) => name);
  query.mockImplementation((...args) => args);
  where.mockImplementation((...args) => ({ where: args }));
  orderBy.mockImplementation((...args) => ({ orderBy: args }));
  limit.mockImplementation((count) => ({ limit: count }));
  onSnapshot.mockImplementation(() => jest.fn());
});
test.each([[subscribeFlags, "flags"], [subscribeAgentActions, "agent_actions"]])(
  "%s scopes the query before ordering and does not use the global 50-record cap",
  (subscribe, name) => {
    const stop = subscribe(jest.fn(), jest.fn(), "agent-123");
    expect(collection).toHaveBeenCalledWith({}, name);
    expect(where).toHaveBeenCalledWith("agentId", "==", "agent-123");
    expect(orderBy).toHaveBeenCalledWith("timestamp", "desc");
    expect(query).toHaveBeenCalledWith(name, { where: ["agentId", "==", "agent-123"] }, { orderBy: ["timestamp", "desc"] });
    expect(limit).not.toHaveBeenCalled();
    expect(onSnapshot).toHaveBeenCalled();
    expect(typeof stop).toBe("function");
  }
);
