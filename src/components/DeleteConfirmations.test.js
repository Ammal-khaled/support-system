import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ActionTypesManager from "./ActionTypesManager";
import BannedPhrasesManager from "./BannedPhrasesManager";
import KnowledgeBaseForm from "./KnowledgeBaseForm";
import { deleteActionType, deleteBannedPhrase, deletePolicy } from "../services/firestore";

jest.mock("../services/firestore", () => ({
  getActionTypeName: (row) => row.name,
  subscribeActionTypes: (cb) => { cb([{ id: "a", name: "Refund" }]); return () => {}; },
  subscribeBannedPhrases: (cb) => { cb([{ id: "b", wrongPhrase: "Go away", correctPhrase: "Let me help", severity: "critical" }]); return () => {}; },
  subscribePolicies: (cb) => { cb([{ id: "c", title: "Move In", content: "Check registration" }]); return () => {}; },
  deleteActionType: jest.fn(async () => true), deleteBannedPhrase: jest.fn(async () => true),
  deletePolicy: jest.fn(async () => true),
}));

beforeEach(() => {
  deleteActionType.mockResolvedValue(true);
  deleteBannedPhrase.mockResolvedValue(true);
  deletePolicy.mockResolvedValue(true);
});

test.each([
  [ActionTypesManager, "Refund", deleteActionType, "a"],
  [BannedPhrasesManager, /Go away/, deleteBannedPhrase, "b"],
  [KnowledgeBaseForm, "Move In", deletePolicy, "c"],
])("%s requires confirmation before deleting", async (Manager, name, remove, id) => {
  remove.mockClear();
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  try {
    render(<Manager />);
    fireEvent.click(screen.getByText(name));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirm).toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(id));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument());
  } finally { confirm.mockRestore(); }
});
