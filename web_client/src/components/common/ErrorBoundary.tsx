'use client';

import { Component, ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="出错了"
          subTitle="抱歉，页面遇到了一些问题"
          extra={
            <Button
              type="primary"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
            >
              刷新页面
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}

