import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
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

export const addPolicy = async (title, content, category) => {
  try {
    await addDoc(collection(db, "knowledge_base"), {
      title,
      content,
      category,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("Error adding policy:", error);
    return false;
  }
};

export const updatePolicy = async (id, title, content, category) => {
  try {
    await updateDoc(doc(db, "knowledge_base", id), {
      title,
      content,
      category,
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

export const subscribeFlags = (callback, onError) => {
  const flagsQuery = query(collection(db, "flags"), orderBy("timestamp", "desc"), limit(50));

  return onSnapshot(
    flagsQuery,
    (snapshot) => callback(mapSnapshot(snapshot)),
    (error) => {
      console.error("Error listening to flags:", error);
      if (onError) onError(error);
    }
  );
};

export const markFlagReviewed = async (id) => {
  await updateDoc(doc(db, "flags", id), {
    reviewed: true,
    reviewedAt: serverTimestamp(),
  });
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

export const subscribeAgentActions = (callback, onError) => {
  const actionsQuery = query(collection(db, "agent_actions"), orderBy("timestamp", "desc"), limit(50));

  return onSnapshot(
    actionsQuery,
    (snapshot) => callback(mapSnapshot(snapshot)),
    (error) => {
      console.error("Error listening to agent actions:", error);
      if (onError) onError(error);
    }
  );
};

export const logAgentAction = async ({ agentId, agentName, actionType }) => {
  await addDoc(collection(db, "agent_actions"), {
    agentId,
    agentName,
    actionType,
    timestamp: serverTimestamp(),
  });
};
