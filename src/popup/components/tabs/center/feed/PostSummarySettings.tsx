import React from 'react';
import { useTranslation } from 'react-i18next';
import Checkbox from '@/popup/components/ui/Checkbox.js';
import ProviderOrderList from '@/popup/components/ui/ProviderOrderList.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { providerOrder } from '@/shared/provider-order.js';
import { POST_SUMMARY_PROVIDERS, postSummaryName, postSummaryProviders } from '@/shared/post-summary.js';
import { POST_SUMMARY_LOGOS } from '@/content/features/center/feed/post-summary-logos.js';
import '../photo/photo-search-settings.css';

export default function PostSummarySettings(): React.ReactElement | null {
  const { t, i18n } = useTranslation('center');
  const settings = useVKifyStore(s => s.settings);
  const saveMultiple = useVKifyStore(s => s.saveMultiple);
  if (!settings.post_summary) return null;
  const enabled = postSummaryProviders(settings.post_summary_providers);
  const order = providerOrder(POST_SUMMARY_PROVIDERS, settings.post_summary_order ?? enabled);
  const selected = order.filter(id => enabled.includes(id));
  return <div className="photo-search-settings">
    <h4 className="photo-search-settings__heading">{t('feed.summary_providers')}</h4>
    <ProviderOrderList items={order} name={id => postSummaryName(id, i18n.language)} onReorder={next => {
      void saveMultiple({ post_summary_order: next, post_summary_providers: next.filter(id => selected.includes(id)) });
    }}>{id => <label className="flex flex-1 items-center gap-2">
      <Checkbox checked={selected.includes(id)} onChange={event => {
        void saveMultiple({ post_summary_order: order, post_summary_providers: order.filter(value => value === id ? event.target.checked : selected.includes(value)) });
      }} />
      <img draggable={false} className="photo-search-settings__logo" data-summary-provider={id} src={POST_SUMMARY_LOGOS[id]} alt="" />
      {postSummaryName(id, i18n.language)}
    </label>}</ProviderOrderList>
    <p className="photo-search-settings__heading">{t(selected.length ? 'feed.summary_note' : 'feed.summary_empty')}</p>
  </div>;
}
