import React, { forwardRef } from 'react';
import CustomSelect from './CustomSelect.js';
import { FIELD_CLASS } from './form-control-style.js';
import './form-controls.css';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode };
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { icon?: React.ReactNode };

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
  return <CustomSelect {...props} className={className} icon={icon} ref={ref} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = '', ...props }, ref) {
  return <textarea {...props} ref={ref} className={`${FIELD_CLASS} ${className}`} />;
});
