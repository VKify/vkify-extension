import React from 'react';
import { useTranslation } from 'react-i18next';
import { InfoIcon } from '../icons/Icons.js';
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
      className={`inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${className}`}
    >
      <InfoIcon className="h-4 w-4" />
    </a>
  );
}
