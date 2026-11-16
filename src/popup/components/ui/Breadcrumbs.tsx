import React from 'react';
import { useTranslation } from 'react-i18next';
import './breadcrumbs.css';

export interface BreadcrumbItem {
  title: string;
  onClick?: () => void;
}

export default function Breadcrumbs({ items, heading = false }: { items: readonly BreadcrumbItem[]; heading?: boolean }): React.ReactElement {
  const { t } = useTranslation('common');
  const Current = heading ? 'h2' : 'span';
  return <nav className="breadcrumbs" aria-label={t('ui.breadcrumbs')}>
    <ol className="breadcrumbs__list">
      {items.map((item, index) => <li className="breadcrumbs__item" key={index}>
        {index > 0 && <svg className="breadcrumbs__separator" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>}
        {index < items.length - 1 && item.onClick
          ? <button type="button" className="breadcrumbs__link" onClick={item.onClick}>{item.title}</button>
          : <Current className="breadcrumbs__current" aria-current="page">{item.title}</Current>}
      </li>)}
    </ol>
  </nav>;
}
