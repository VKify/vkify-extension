import React, { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { CHECKBOX_CLASS } from '@/shared/ui/checkbox.js';
import '@/shared/ui/checkbox.css';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean;
}
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ className = '', indeterminate = false, ...props }, ref) {
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => input.current!, []);
  useLayoutEffect(() => { if (input.current) input.current.indeterminate = indeterminate; }, [indeterminate]);
  return <input {...props} ref={input} type="checkbox" className={`${CHECKBOX_CLASS} ${className}`} />;
});
export default Checkbox;
