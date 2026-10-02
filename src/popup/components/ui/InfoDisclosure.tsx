import type { ReactNode } from 'react';
import { ChevronDownIcon, InfoIcon } from '../icons/Icons.js';
import './InfoDisclosure.css';

export default function InfoDisclosure({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <details className={`info-disclosure ${className}`}>
    <summary><span className="info-disclosure__icon"><InfoIcon /></span><span>{title}</span><ChevronDownIcon className="info-disclosure__chevron" /></summary>
    <div className="info-disclosure__content">{children}</div>
  </details>;
}
