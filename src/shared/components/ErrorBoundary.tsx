import { Component, type ReactNode } from "react";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../constants/theme";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: `${SPACING.xxl}px`,
            textAlign: "center",
            background: COLORS.white,
            borderRadius: `${RADIUS.lg}px`,
            margin: `${SPACING.xl}px`,
          }}
        >
          <h2
            style={{
              color: COLORS.error,
              fontSize: `${FONT_SIZES.xxl}px`,
              marginBottom: `${SPACING.md}px`,
            }}
          >
            Something went wrong
          </h2>
          <p style={{ color: COLORS.gray600, fontSize: `${FONT_SIZES.lg}px` }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: `${SPACING.lg}px`,
              padding: "8px 16px",
              background: COLORS.primary600,
              color: COLORS.white,
              border: "none",
              borderRadius: `${RADIUS.md}px`,
              cursor: "pointer",
              fontSize: `${FONT_SIZES.lg}px`,
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
