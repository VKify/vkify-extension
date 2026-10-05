import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ChevronRightIcon } from '@/popup/components/icons/Icons.js';

export function CatalogSelection({ keys, pageKeys, selected, disabled, onChange }: {
  keys: string[]; pageKeys: string[]; selected: string[]; disabled: boolean; onChange: (keys: string[]) => void;
}) {
  const { t } = useTranslation('center');
  const allSelected = keys.length > 0 && keys.every(key => selected.includes(key));
  const pageSelected = pageKeys.every(key => selected.includes(key));
  const add = (values: string[]) => onChange([...new Set([...selected, ...values])]);
  return <div className="ct-catalog-selection">
    <div className="ct-toolbar">
      <button type="button" className="ct-button" disabled={disabled || !keys.length || allSelected} onClick={() => add(keys)}>{t('catalog_controls.select_all')} · {keys.length}</button>
      {keys.length > pageKeys.length && <button type="button" className="ct-button" disabled={disabled || !pageKeys.length || pageSelected} onClick={() => add(pageKeys)}>{t('catalog_controls.select_page')}</button>}
      <button type="button" className="ct-button" disabled={disabled || !selected.length} onClick={() => onChange([])}>{t('catalog_controls.clear_all')}</button>
      <span className="ct-selection-count" role="status">{t('bulk.selected', { count: selected.length })}</span>
    </div>
    <p className="ct-note">{t('catalog_controls.selection_scope')}</p>
  </div>;
}

export function CatalogPagination({ page, total, pageSize = 24, disabled, onChange }: {
  page: number; total: number; pageSize?: number; disabled: boolean; onChange: (page: number) => void;
}) {
  const { t } = useTranslation('center');
  const pages = Math.ceil(total / pageSize);
  if (pages < 2) return null;
  return <nav className="ct-catalog-pagination" aria-label={t('catalog_controls.pagination')}>
    <span className="ct-note">{t('catalog_controls.range', { from: page * pageSize + 1, to: Math.min((page + 1) * pageSize, total), total })}</span>
    <div className="ct-page-buttons">
      <button type="button" className="ct-button" disabled={disabled || page === 0} onClick={() => onChange(page - 1)}><ChevronLeftIcon />{t('tools.previous')}</button>
      <span className="ct-page-number" aria-live="polite">{t('catalog_controls.page', { page: page + 1, pages })}</span>
      <button type="button" className="ct-button" disabled={disabled || page + 1 >= pages} onClick={() => onChange(page + 1)}>{t('tools.next')}<ChevronRightIcon /></button>
    </div>
  </nav>;
}
