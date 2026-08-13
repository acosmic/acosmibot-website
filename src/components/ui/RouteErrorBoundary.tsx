import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { CenteredMessage } from './CenteredMessage';
import { isChunkLoadError } from '../../lib/versionSkew';

interface Props {
  children?: ReactNode;
}

interface State {
  error?: Error;
}

/** Catches route-chunk failures that survived the automatic reload in
 * versionSkew, so a stale tab shows a reload prompt instead of a blank page. */
export class RouteErrorBoundary extends Component<Props, State> {
  public state: State = {};

  public static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route failed to render:', error, errorInfo);
  }

  public render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stale = isChunkLoadError(error);
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <CenteredMessage
          icon={stale ? <RefreshCw aria-hidden="true" size={32} /> : <TriangleAlert aria-hidden="true" size={32} />}
          title={stale ? 'Acosmibot has been updated' : 'Something went wrong'}
          subtitle={stale
            ? 'This tab is running an older version of the site. Reload to pick up the latest.'
            : error.message}
        />
        <div style={{ textAlign: 'center' }}>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
