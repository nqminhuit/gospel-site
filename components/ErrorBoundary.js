'use client';

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Có lỗi xảy ra</h2>
          <p className="text-gray-700 mb-4">Chúng tôi xin lỗi về sự bất tiện này. Vui lòng thử lại hoặc liên hệ với chúng tôi.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Thử lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
