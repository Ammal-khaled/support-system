import { render, screen } from "@testing-library/react";
import { onAuthStateChanged } from "firebase/auth";
import App from "./App";

jest.mock("react-router/dom", () => ({
  HydratedRouter: ({ children }) => children,
  RouterProvider: ({ children }) => children,
}), { virtual: true });

jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  updatePassword: jest.fn(),
  updateProfile: jest.fn(),
}));

jest.mock("./services/auth", () => ({
  loginUser: jest.fn(),
  logoutUser: jest.fn(),
}));

jest.mock("./firebase", () => ({ auth: {}, db: {} }));

beforeEach(() => {
  onAuthStateChanged.mockImplementation((_auth, callback) => {
    callback(null);
    return jest.fn();
  });
});

test("renders the AquaDesk sign-in screen while logged out", async () => {
  render(<App />);

  expect(await screen.findByRole("button", { name: "Sign In" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "AquaDesk" })).not.toHaveLength(0);
});
