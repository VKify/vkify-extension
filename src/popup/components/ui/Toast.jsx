import React from 'react';
import { useToast } from '../../context/ToastContext';

export default function Toast() {
  const { toast, hideToast } = useToast();

  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
      <div 
        onClick={hideToast}
        className={`
          flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg cursor-pointer
          ${isSuccess ? 'bg-success' : 'bg-error'}
        `}
      >
        <span className="text-white text-sm font-medium">
          {isSuccess ? '✓' : '✕'}
        </span>
        <span className="text-white text-sm">{toast.message}</span>
      </div>
    </div>
  );
}