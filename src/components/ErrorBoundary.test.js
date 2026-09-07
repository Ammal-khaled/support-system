import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

test("renders the recovery screen when a child crashes", () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  function BrokenPage() { throw new Error("Test crash"); }
  try {
    render(<ErrorBoundary><BrokenPage /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Reload Page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Sign In" })).toHaveAttribute("href", "/login");
  } finally { log.mockRestore(); }
});

test("renders healthy children", () => {
  render(<ErrorBoundary><p>Knowledge Base</p></ErrorBoundary>);
  expect(screen.getByText("Knowledge Base")).toBeInTheDocument();
});
