import React from 'react';
import Checkbox from '@/popup/components/ui/Checkbox.js';
import { ArrowUpIcon, PinIcon, StarIcon } from '@/popup/components/icons/Icons.js';
import { GOOGLE_LOGO, YANDEX_LOGO, EXTRA_SEARCH_LOGOS } from '@/content/features/center/photo/search-logos.js';
import './photo-search-settings.css';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '@/popup/store/index.js';
import { PHOTO_SEARCH_PROVIDERS, PHOTO_SEARCH_NAMES, photoSearchButtons, photoSearchProviders } from '@/shared/photo-search.js';

export default function PhotoSearchSettings(): React.ReactElement | null {
  const { t, i18n } = useTranslation('center');
  const settings = useVKifyStore(s => s.settings);
  const save = useVKifyStore(s => s.saveSetting);
  const saveMultiple = useVKifyStore(s => s.saveMultiple);
  if (settings.photo_search === false) return null;
  const selected = photoSearchProviders(settings.photo_search_providers, i18n.language);
  // Keep display order separate from enabled providers so toggles never move rows.
  const savedOrder = photoSearchProviders(settings.photo_search_order ?? settings.photo_search_providers, i18n.language);
  const order = [...savedOrder, ...PHOTO_SEARCH_PROVIDERS.filter(id => !savedOrder.includes(id))];
  const preferred = selected.find(id => id === settings.photo_search_default) || selected[0] || '';
  const buttons = photoSearchButtons(settings.photo_search_buttons, selected, preferred);
  return <div className="photo-search-settings">
    <h4 className="photo-search-settings__heading">{t('photo.search_providers')}</h4>
    {order.map(id => {
      const index = selected.indexOf(id);
      const move = (offset: number) => {
        const next = [...order];
        const from = next.indexOf(id);
        const to = next.indexOf(selected[index + offset]);
        [next[from], next[to]] = [next[to], next[from]];
        void saveMultiple({ photo_search_order: next, photo_search_providers: next.filter(value => selected.includes(value)) });
      };
      return <div key={id} className="photo-search-settings__provider">
        <label className="flex flex-1 items-center gap-2"><Checkbox checked={index >= 0} onChange={event => { void saveMultiple({ photo_search_order: order, photo_search_providers: order.filter(value => value === id ? event.target.checked : selected.includes(value)) }); }} /><img className="photo-search-settings__logo" src={id === 'google' ? GOOGLE_LOGO : id === 'yandex' ? YANDEX_LOGO : EXTRA_SEARCH_LOGOS[id]} alt="" />{PHOTO_SEARCH_NAMES[id]}</label>
        <button type="button" className="photo-search-settings__move photo-search-settings__choice" disabled={index < 0}
          aria-label={t('photo.search_button_for', { name: PHOTO_SEARCH_NAMES[id] })} title={t('photo.search_buttons')}
          aria-pressed={buttons.includes(id)} onClick={() => { void save('photo_search_buttons', buttons.includes(id) ? buttons.filter(value => value !== id) : [...buttons, id]); }}>
          <PinIcon className="w-4 h-4" />
        </button>
        <button type="button" className="photo-search-settings__move photo-search-settings__choice" disabled={index < 0}
          aria-label={t('photo.search_default_for', { name: PHOTO_SEARCH_NAMES[id] })} title={t('photo.search_default')}
          aria-pressed={preferred === id} onClick={() => { void save('photo_search_default', id); }}>
          <StarIcon filled={preferred === id} className="w-4 h-4" />
        </button>
        <button className="photo-search-settings__move" type="button" disabled={index <= 0} aria-label={t('photo.search_up') + ': ' + PHOTO_SEARCH_NAMES[id]} onClick={() => move(-1)}><ArrowUpIcon className="w-4 h-4" /></button>
        <button className="photo-search-settings__move" type="button" disabled={index < 0 || index === selected.length - 1} aria-label={t('photo.search_down') + ': ' + PHOTO_SEARCH_NAMES[id]} onClick={() => move(1)}><ArrowUpIcon className="w-4 h-4 rotate-180" /></button>
      </div>;
    })}
  </div>;
}
