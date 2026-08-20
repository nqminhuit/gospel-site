'use client'

import { useEffect } from 'react';

export default function GospelModal({
  citation,
  open,
  onClose,
  content,
  loading,
  error
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center
                  bg-black/70 backdrop-blur-sm
                  transition-opacity duration-700
                  ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl mx-4
                   bg-white rounded-2xl shadow-2xl
                   max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent line */}
        <div className="h-2 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-serif text-xl font-semibold text-gray-900">
            {citation || 'Lời Chúa'}
          </h3>

          <button
            aria-label="Close"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center
                       rounded-full hover:bg-gray-100
                       text-gray-400 hover:text-gray-900
                       transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 overflow-y-auto max-h-[70vh]">
          {loading && (
            <div className="text-center py-10 text-gray-500">
              Đang tải Lời Chúa…
            </div>
          )}

          {error && (
            <div className="text-red-600 bg-red-50 p-4 rounded-lg">
              {error}
            </div>
          )}

          {!loading && !error && content && (
            <div className="prose prose-gray max-w-none whitespace-pre-line
                            text-gray-800 leading-8 text-justify">
              {content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
