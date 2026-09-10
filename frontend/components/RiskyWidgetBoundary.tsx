"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  label: string;
};

type State = { failed: boolean };

export default class RiskyWidgetBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      tags: { widget: this.props.label },
      contexts: { react: { componentStack: info.componentStack } },
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <section
        role="alert"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "16px",
          border: "1px solid rgba(239, 68, 68, 0.28)",
          borderRadius: "12px",
          background: "rgba(239, 68, 68, 0.08)",
          color: "inherit",
          textAlign: "center",
        }}
      >
        <p style={{ margin: "0 0 10px", fontSize: "14px" }}>
          This {this.props.label} could not be displayed.
        </p>
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          style={{ minHeight: "44px", padding: "8px 16px", borderRadius: "10px", cursor: "pointer" }}
        >
          Try again
        </button>
      </section>
    );
  }
}
