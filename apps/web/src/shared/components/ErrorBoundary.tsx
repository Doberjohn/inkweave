import {Component, type ReactNode} from 'react';
import {COLORS, FONT_SIZES, SPACING, RADIUS} from '../constants';
import {loadSentry} from '../lib/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * lazyWithRetry's PageLoadError, known by its name. Importing the class here made the production
 * build split shared code out of the entry chunk: about 3 kB more JS and four more requests on
 * every page load.
 */
function isPageLoadError(error: Error | null) {
  return error?.name === 'PageLoadError';
}

/** The error screen's heading, the line under it and its button. */
function errorCopy(error: Error | null) {
  // Rendering again can't fetch a page's missing code (React keeps the failed import), so this
  // screen's button reloads the page instead of retrying the render.
  if (isPageLoadError(error)) {
    return {
      title: "This page couldn't load",
      message: 'Check your connection, then reload the page.',
      action: 'Reload',
    };
  }
  return {
    title: 'Something went wrong',
    message: error?.message || 'An unexpected error occurred',
    action: 'Try Again',
  };
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {hasError: false, error: null};
  }

  static getDerivedStateFromError(error: Error): State {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Loads and initializes Sentry at once if it hasn't yet (#640), so an error caught before
    // `load` is still reported. A no-op where Sentry is off (dev, no DSN, the prerender crawl).
    void loadSentry().then((sentry) => {
      sentry?.captureException(error, {
        contexts: {react: {componentStack: errorInfo.componentStack ?? ''}},
      });
    });
  }

  handleAction = () => {
    if (isPageLoadError(this.state.error)) window.location.reload();
    else this.setState({hasError: false, error: null});
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const {title, message, action} = errorCopy(this.state.error);
      return (
        <div
          style={{
            padding: `${SPACING.xxl}px`,
            textAlign: 'center',
            background: COLORS.surface,
            borderRadius: `${RADIUS.lg}px`,
            margin: `${SPACING.xl}px`,
          }}>
          <h2
            style={{
              color: COLORS.error,
              fontSize: `${FONT_SIZES.xxl}px`,
              marginBottom: `${SPACING.md}px`,
            }}>
            {title}
          </h2>
          <p style={{color: COLORS.gray600, fontSize: `${FONT_SIZES.lg}px`}}>{message}</p>
          <button
            onClick={this.handleAction}
            style={{
              marginTop: `${SPACING.lg}px`,
              padding: '8px 16px',
              background: COLORS.primary600,
              color: COLORS.white,
              border: 'none',
              borderRadius: `${RADIUS.md}px`,
              cursor: 'pointer',
              fontSize: `${FONT_SIZES.lg}px`,
            }}>
            {action}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
