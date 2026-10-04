import React, { forwardRef } from 'react';
import { ChevronDownIcon } from '@/popup/components/icons/Icons.js';
import './form-controls.css';

// A 40px field fits the popup's 36–40px actions while retaining readable text and icons.
const FIELD_CLASS = 'form-control min-w-0 min-h-10 px-3 py-2 text-sm leading-5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed aria-[invalid=true]:border-red-500';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode };
type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { icon?: React.ReactNode };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className = '', icon, ...props }, ref) {
  if (icon) return <span className={`form-control-shell ${className}`}>
    <input {...props} ref={ref} className={`${FIELD_CLASS} form-control--icon w-full`} />
    <span aria-hidden="true" className="form-control-icon form-control-icon--leading">{icon}</span>
  </span>;
  return <input {...props} ref={ref} className={`${FIELD_CLASS} ${className}`} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className = '', icon, multiple, size, ...props }, ref) {
  // Listboxes retain their native multi-row presentation.
  if (multiple || (size !== undefined && size > 1)) return <select {...props} multiple={multiple} size={size} ref={ref} className={`${FIELD_CLASS} ${className}`} />;
  return <span className={`form-control-shell ${className}`}>
    <select {...props} multiple={multiple} size={size} ref={ref} className={`${FIELD_CLASS} form-control-select w-full cursor-pointer ${icon ? 'form-control--icon' : ''}`} />
    {icon && <span aria-hidden="true" className="form-control-icon form-control-icon--leading">{icon}</span>}
    <span aria-hidden="true" className="form-control-icon form-control-icon--trailing"><ChevronDownIcon /></span>
  </span>;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = '', ...props }, ref) {
  return <textarea {...props} ref={ref} className={`${FIELD_CLASS} ${className}`} />;
});
