import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

function sortByText(items, fields) {
  return [...items].sort((a, b) => {
    const aValue = fields.map((field) => a[field]).find(Boolean) || "";
    const bValue = fields.map((field) => b[field]).find(Boolean) || "";
    return String(aValue).localeCompare(String(bValue));
  });
}

function mapSnapshot(snapshot) {
  return snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }));
}

function parseJsonField(value, fallback) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function subscribeCollection(collectionName, callback, onError, sorter) {
  return onSnapshot(
    collection(db, collectionName),
    (snapshot) => {
      const rows = mapSnapshot(snapshot);
      callback(sorter ? sorter(rows) : rows);
    },
    (error) => {
      console.error(`Error listening to ${collectionName}:`, error);
      if (onError) onError(error);
    }
  );
}

async function fetchCollection(collectionName, sorter) {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    const rows = mapSnapshot(snapshot);
    return sorter ? sorter(rows) : rows;
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
  }
}

export const subscribePolicies = (callback, onError) =>
  subscribeCollection(
    "knowledge_base",
    callback,
    onError,
    (rows) => sortByText(rows, ["title", "category"])
  );

export const getPolicies = () =>
  fetchCollection("knowledge_base", (rows) => sortByText(rows, ["title", "category"]));

export const getPolicyById = async (id) => {
  try {
    const policyDoc = await getDoc(doc(db, "knowledge_base", id));
    if (!policyDoc.exists()) return null;
    return { id: policyDoc.id, ...policyDoc.data() };
  } catch (error) {
    console.error("Error fetching policy:", error);
    return null;
  }
};

export const getUserById = async (id) => {
  try {
    const userDoc = await getDoc(doc(db, "users", id));
    if (!userDoc.exists()) return null;
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
};

function normalizePolicyInput(titleOrPolicy, content, category) {
  return typeof titleOrPolicy === "object"
    ? titleOrPolicy
    : { title: titleOrPolicy, content, category };
}

export const addPolicy = async (titleOrPolicy, content, category) => {
  try {
    const policy = normalizePolicyInput(titleOrPolicy, content, category);
    await addDoc(collection(db, "knowledge_base"), {
      ...policy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error adding policy:", error);
    return false;
  }
};

export const updatePolicy = async (id, titleOrPolicy, content, category) => {
  try {
    const policy = normalizePolicyInput(titleOrPolicy, content, category);
    await updateDoc(doc(db, "knowledge_base", id), {
      ...policy,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error updating policy:", error);
    return false;
  }
};

export const deletePolicy = async (id) => {
  try {
    await deleteDoc(doc(db, "knowledge_base", id));
    return true;
  } catch (error) {
    console.error("Error deleting policy:", error);
    return false;
  }
};

export const subscribeBannedPhrases = (callback, onError) =>
  subscribeCollection(
    "banned_phrases",
    callback,
    onError,
    (rows) => sortByText(rows, ["wrongPhrase", "category"])
  );

export const getBannedPhrases = () =>
  fetchCollection("banned_phrases", (rows) => sortByText(rows, ["wrongPhrase", "category"]));

export const addBannedPhrase = async (wrongPhrase, correctPhrase, severity, category) => {
  try {
    await addDoc(collection(db, "banned_phrases"), {
      wrongPhrase,
      correctPhrase,
      severity,
      category,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error adding banned phrase:", error);
    return false;
  }
};

export const updateBannedPhrase = async (id, wrongPhrase, correctPhrase, severity, category) => {
  try {
    await updateDoc(doc(db, "banned_phrases", id), {
      wrongPhrase,
      correctPhrase,
      severity,
      category,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error updating banned phrase:", error);
    return false;
  }
};

export const deleteBannedPhrase = async (id) => {
  try {
    await deleteDoc(doc(db, "banned_phrases", id));
    return true;
  } catch (error) {
    console.error("Error deleting banned phrase:", error);
    return false;
  }
};

export const subscribeUsers = (callback, onError) =>
  subscribeCollection(
    "users",
    callback,
    onError,
    (rows) => sortByText(rows, ["name", "email"])
  );

export const updateUserProfile = async (id, updates) => {
  await updateDoc(doc(db, "users", id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export function getActionTypeName(actionType) {
  return actionType.name || actionType.label || actionType.actionType || actionType.value || "";
}

export const subscribeActionTypes = (callback, onError) =>
  subscribeCollection(
    "action_types",
    callback,
    onError,
    (rows) =>
      [...rows].sort((a, b) =>
        getActionTypeName(a).localeCompare(getActionTypeName(b))
      )
  );

export const getActionTypes = () =>
  fetchCollection("action_types", (rows) =>
    [...rows].sort((a, b) => getActionTypeName(a).localeCompare(getActionTypeName(b)))
  );

export const addActionType = async (name) => {
  try {
    await addDoc(collection(db, "action_types"), {
      name,
      value: name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error adding action type:", error);
    return false;
  }
};

export const updateActionType = async (id, name) => {
  try {
    await updateDoc(doc(db, "action_types", id), {
      name,
      value: name,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error updating action type:", error);
    return false;
  }
};

export const deleteActionType = async (id) => {
  try {
    await deleteDoc(doc(db, "action_types", id));
    return true;
  } catch (error) {
    console.error("Error deleting action type:", error);
    return false;
  }
};

export const subscribeFlags = (callback, onError, agentId) => {
  const flagsQuery = query(collection(db, "flags"),
    ...(agentId ? [where("agentId", "==", agentId)] : []),
    orderBy("timestamp", "desc"), ...(agentId ? [] : [limit(50)]));

  return onSnapshot(
    flagsQuery,
    (snapshot) => callback(mapSnapshot(snapshot)),
    (error) => {
      console.error("Error listening to flags:", error);
      if (onError) onError(error);
    }
  );
};

export const getFlags = () =>
  fetchCollection("flags", (rows) =>
    [...rows].sort((a, b) => {
      const aTime = a.timestamp?.toMillis?.() || 0;
      const bTime = b.timestamp?.toMillis?.() || 0;
      return bTime - aTime;
    })
  );

export const markFlagReviewed = async (id) => {
  await updateDoc(doc(db, "flags", id), {
    reviewed: true,
    reviewedAt: serverTimestamp(),
  });
};

export const updateFlagReview = async (id, updates) => {
  await updateDoc(doc(db, "flags", id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteFlag = async (id) => {
  await deleteDoc(doc(db, "flags", id));
};

export const addSoftSkillFlag = async ({
  agentId = "demo_agent",
  agentName = "Demo Agent",
  matchedPhrase = "AI soft-skills review",
  transcriptSnippet,
  feedback,
}) => {
  await addDoc(collection(db, "flags"), {
    agentId,
    agentName,
    type: "soft_skill",
    matchedPhrase,
    kbArticleId: null,
    transcriptSnippet,
    feedback,
    reviewed: false,
    source: "tier_2_ai",
    timestamp: serverTimestamp(),
  });
};

export const subscribeAgentActions = (callback, onError, agentId) => {
  const actionsQuery = query(collection(db, "agent_actions"),
    ...(agentId ? [where("agentId", "==", agentId)] : []),
    orderBy("timestamp", "desc"), ...(agentId ? [] : [limit(50)]));

  return onSnapshot(
    actionsQuery,
    (snapshot) => callback(mapSnapshot(snapshot)),
    (error) => {
      console.error("Error listening to agent actions:", error);
      if (onError) onError(error);
    }
  );
};

export const subscribeAfterCallReports = (callback, onError, agentId) => {
  const reportsQuery = query(collection(db, "after_call_reports"),
    ...(agentId ? [where("agentId", "==", agentId)] : []),
    orderBy("createdAt", "desc"), ...(agentId ? [] : [limit(50)]));

  return onSnapshot(
    reportsQuery,
    (snapshot) => callback(mapSnapshot(snapshot).map((report) => ({
      ...report,
      softSkills: parseJsonField(report.softSkills, {}),
      bannedPhrases: parseJsonField(report.bannedPhrases, []),
      incorrectInformation: parseJsonField(report.incorrectInformation, []),
      recommendations: parseJsonField(report.recommendations, []),
    }))),
    (error) => {
      console.error("Error listening to after-call reports:", error);
      if (onError) onError(error);
    }
  );
};

export const getAgentFlagsByDateRange = async (agentId, startDate, endDate) => {
  const snapshot = await getDocs(query(
    collection(db, "flags"),
    where("agentId", "==", agentId),
    where("timestamp", ">=", startDate),
    where("timestamp", "<=", endDate),
    orderBy("timestamp", "desc")
  ));
  return mapSnapshot(snapshot);
};

export const getAgentActionsByDateRange = async (agentId, startDate, endDate) => {
  const snapshot = await getDocs(query(
    collection(db, "agent_actions"),
    where("agentId", "==", agentId),
    where("timestamp", ">=", startDate),
    where("timestamp", "<=", endDate),
    orderBy("timestamp", "desc")
  ));
  return mapSnapshot(snapshot);
};

export const logAgentAction = async ({ agentId, agentName, actionType, note, source }) => {
  await addDoc(collection(db, "agent_actions"), {
    agentId,
    agentName,
    actionType,
    note: note || "",
    status: "open",
    source: source || "configured_quick_action",
    timestamp: serverTimestamp(),
  });
};

export const updateAgentAction = async (id, updates) => {
  await updateDoc(doc(db, "agent_actions", id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const subscribeTickets = (callback, onError, agentId) => {
  const ticketsQuery = agentId
    ? query(collection(db, "tickets"), where("createdById", "==", agentId))
    : query(collection(db, "tickets"), orderBy("updatedAt", "desc"), limit(100));

  return onSnapshot(
    ticketsQuery,
    (snapshot) => callback(mapSnapshot(snapshot)),
    (error) => {
      console.error("Error listening to tickets:", error);
      if (onError) onError(error);
    }
  );
};

export const createTicket = async (ticket) => {
  const now = serverTimestamp();

  return addDoc(collection(db, "tickets"), {
    ...ticket,
    status: ticket.status || "Open",
    createdAt: now,
    updatedAt: now,
  });
};

export const updateTicket = async (id, updates) => {
  await updateDoc(doc(db, "tickets", id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

// Resolve old name-only bookmarks without guessing when names are duplicated.
export const resolveAgentId = async (name) => {
  const sources = [["flags", "agentName", "agentId"],
    ["agent_actions", "agentName", "agentId"], ["tickets", "createdByName", "createdById"]];
  const ids = new Set();
  await Promise.all(sources.map(async ([collectionName, nameField, idField]) => {
    const snapshot = await getDocs(query(collection(db, collectionName), where(nameField, "==", name)));
    snapshot.docs.forEach((item) => {
      const id = item.data()[idField];
      if (id) ids.add(id);
    });
  }));
  if (ids.size !== 1) throw new Error("Open this agent from the Agents tab to select their unique ID.");
  return [...ids][0];
};

export const subscribeCoachingNote = (agentId, callback, onError) =>
  onSnapshot(
    doc(db, "agents_coaching_notes", agentId),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    (error) => {
      console.error("Error listening to coaching note:", error);
      if (onError) onError(error);
    }
  );

export const saveCoachingNote = async (agentId, note, updatedBy, updatedById) => {
  await setDoc(
    doc(db, "agents_coaching_notes", agentId),
    {
      agentId,
      note,
      updatedBy,
      updatedById,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const subscribeAgentUsers = (callback, onError) => {
  const agentsQuery = query(
    collection(db, "users"),
    where("role", "==", "agent")
  );

  return onSnapshot(
    agentsQuery,
    (snapshot) => callback(
      mapSnapshot(snapshot)
        .filter((agent) => !agent.disabled && agent.role !== "disabled")
        .sort((a, b) =>
          String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""))
        )
    ),
    (error) => {
      console.error("Error listening to agent users:", error);
      if (onError) onError(error);
    }
  );
};

