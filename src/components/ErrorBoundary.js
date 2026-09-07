import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("AquaDesk screen failed:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page-bg flex min-h-screen items-center justify-center p-5">
        <section role="alert" className="glass-card w-full max-w-lg p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold text-slate-950">Something went wrong</h1>
          <p className="mt-3 text-sm leading-6 text-semantic-neutral">
            This page could not be displayed. Reload to try again, or return to sign-in.
            Any unsaved edits may need to be entered again.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>Reload Page</button>
            <a href="/login" className="btn-secondary">Return to Sign In</a>
          </div>
        </section>
      </main>
    );
  }
}
