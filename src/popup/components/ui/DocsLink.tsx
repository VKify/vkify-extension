import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpOutlineIcon } from '../icons/Icons.js';
import { getDocsUrl } from '@/shared/constants/docs.js';

interface DocsLinkProps {
  featureId: string;
  className?: string;
}

export default function DocsLink({ featureId, className = '' }: DocsLinkProps): React.ReactElement | null {
  const { t } = useTranslation('common');
  const href = getDocsUrl(featureId);

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={t('docs.open')}
      aria-label={t('docs.open')}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] opacity-45 transition-[color,background-color,opacity] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${className}`}
    >
      <HelpOutlineIcon className="h-3.5 w-3.5" />
    </a>
  );
}
