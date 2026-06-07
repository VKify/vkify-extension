import React, { useEffect } from 'react';
import { useToast } from '../../context/ToastContext.js';
import type { Toast as ToastType } from '../../context/ToastContext.js';
import { CheckCircleIcon, CancelCircleIcon, WarningIcon, InfoIcon, XIcon } from '../icons/Icons.js';

const typeStyles: Record<string, string> = {
  success: 'bg-green-500 hover:bg-green-600',
  error: 'bg-red-500 hover:bg-red-600',
  warning: 'bg-yellow-500 hover:bg-yellow-600',
  info: 'bg-blue-500 hover:bg-blue-600',
};

const icons: Record<string, React.ReactElement> = {
  success: <CheckCircleIcon className="w-5 h-5" />,
  error: <CancelCircleIcon className="w-5 h-5" />,
  warning: <WarningIcon className="w-5 h-5" />,
  info: <InfoIcon className="w-5 h-5" />,
};

interface ExtendedToast extends ToastType {
  duration?: number;
}

export default function Toast() {
  const { toast, hideToast } = useToast();
  const extToast = toast as ExtendedToast | null;

  useEffect(() => {
    if (extToast) {
      const timer = setTimeout(() => {
        hideToast();
      }, extToast.duration || 3000);
      return () => clearTimeout(timer);
    }
  }, [extToast, hideToast]);

  if (!extToast) return null;

  const type = extToast.type || 'info';

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-up">
      <div
        role="alert"
        aria-live="polite"
        onClick={hideToast}
        className={`
          flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg
          cursor-pointer transition-all duration-200
          backdrop-blur-sm bg-opacity-95
          ${typeStyles[type] || typeStyles['info']}
        `}
      >
        <span className="text-white flex-shrink-0">
          {icons[type] || icons['info']}
        </span>
        <span className="text-white text-sm flex-1 leading-relaxed">
          {extToast.message}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            hideToast();
          }}
          className="text-white hover:text-gray-200 flex-shrink-0 transition-colors"
          aria-label="Закрыть уведомление"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}