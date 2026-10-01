import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RangeSlider from '@/popup/components/ui/RangeSlider.js';
import { DashboardPanel, DashboardSettingCard } from '@/popup/components/ui/DashboardPrimitives.js';
import { useStorageReload } from '@/popup/hooks/core/useStorageReload.js';
import { getStorage } from '@/popup/utils/storageClient.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { PlayIcon, StopIcon, UserPlusIcon, UsersIcon, WarningIcon, ZapIcon } from '@/popup/components/icons/Icons.js';
import { sendMessage } from '@/shared/messaging.js';
import { AUTO_ADD_STATE, AUTO_ADD_DEFAULTS, AUTO_ADD_CAPS, type AutoAddState, type AutoAddOptions } from '@/shared/auto-add-friends.js';
const AUTO_ADD_KEYS = [AUTO_ADD_STATE];

export default function AutoAddFriendsPage(): React.ReactElement {
  const { t } = useTranslation('automation');
  const [options, setOptions] = useState<AutoAddOptions>(AUTO_ADD_DEFAULTS);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const optionsLoaded = useRef(false);
  const setOption = (key: keyof AutoAddOptions, value: number): void => {
    setOptions(current => ({ ...current, [key]: value }));
  };
  const { showToast } = useToast();
  const [stats, setStats] = useState<AutoAddState>({ added: 0, attempted: 0, isRunning: false });

  const reloadStats = useCallback(async (): Promise<void> => {
    try {
      const result = await getStorage([AUTO_ADD_STATE]);
      const state = result[AUTO_ADD_STATE] as AutoAddState | undefined;
      if (state) {
        setStats({ ...state, attempted: state.attempted ?? 0 });
        if (!optionsLoaded.current && state.options) setOptions(state.options);
      }
      optionsLoaded.current = true;
    } catch { /* storage can be unavailable in the preview */ }
    finally { setLoading(false); }
  }, []);
  useStorageReload(AUTO_ADD_KEYS, reloadStats);

  const enabled = stats.isRunning;
  const toggle = async (): Promise<void> => {
    setPending(true);
    try {
      const response = await sendMessage(enabled ? { type: 'STOP_AUTO_ADD_FRIENDS' }
        : { type: 'START_AUTO_ADD_FRIENDS', options, acknowledged });
      if (!response?.success) throw new Error(response?.error ?? t('autoadd.command_failed'));
      await reloadStats();
      showToast(t(enabled ? 'autoadd.toast_off' : 'autoadd.toast_on'), 'success');
      if (!enabled) setAcknowledged(false);
    } catch (error) {
      showToast((error as Error).message, 'error');
      await reloadStats();
    } finally { setPending(false); }
  };

  return <div className="space-y-4 pb-4">
    <DashboardPanel title={t('autoadd.status_title')} description={t('autoadd.intro')}
      icon={<UsersIcon className="h-5 w-5" />} tone="success" className="pb-4">
      <div className="px-4 pt-1" data-vkify-anchor="auto_add_friends">
        <DashboardSettingCard icon={enabled ? <StopIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
          title={enabled ? t('autoadd.script_on') : t('autoadd.script_off')}
          description={t('autoadd.added_session', { count: stats.added })}
          tone={enabled ? 'warning' : 'success'}
          control={<button type="button" onClick={() => { void toggle(); }} disabled={loading || pending || (!enabled && (!acknowledged || options.delayMax < options.delayMin))}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${enabled ? 'bg-error/10 text-error hover:bg-error/15' : 'bg-success/10 text-success hover:bg-success/15'}`}>
            {enabled ? t('autoadd.stop') : t('autoadd.start')}
          </button>} />
        <p className="mt-3 text-xs text-[var(--text-secondary)]" role="status">
          {t('autoadd.usage', { attempts: stats.attempted, hour: stats.hourUsed ?? 0, day: stats.dayUsed ?? 0 })}
          {enabled && stats.nextAt ? ' · ' + t('autoadd.next_at', { time: new Date(stats.nextAt).toLocaleTimeString() }) : ''}
        </p>
        {stats.reason && <p role={stats.reason === 'error' || stats.reason === 'interrupted' ? 'alert' : 'status'} className="mt-2 text-sm text-warning">
          {t('autoadd.reasons.' + stats.reason)}
          {stats.code ? ' · ' + t('autoadd.errors.' + stats.code, { defaultValue: t('autoadd.error_code', { code: stats.code }) }) : ''}
          {stats.error ? ': ' + stats.error : ''}
        </p>}
      </div>
    </DashboardPanel>

    <fieldset disabled={enabled || pending} className="space-y-4 disabled:opacity-55">
      <DashboardPanel title={t('autoadd.params')} description={t('autoadd.params_desc')}
        icon={<ZapIcon className="h-5 w-5" />} tone="warning" className="pb-4">
        <div className="grid grid-cols-2 gap-3 px-4 pt-1 max-[650px]:grid-cols-1">
          <DashboardSettingCard icon={<UserPlusIcon className="h-5 w-5" />} tone="success" className="items-start">
            <RangeSlider id="auto_add_limit" label={t('autoadd.limit')}
              value={options.hour} min={1} max={AUTO_ADD_CAPS.hour} step={1}
              unit={t('autoadd.unit_requests')} onChange={value => setOption('hour', value)} />
          </DashboardSettingCard>
          <DashboardSettingCard icon={<PlayIcon className="h-5 w-5" />} tone="primary" className="items-start">
            <RangeSlider id="auto_add_delay_min" label={t('autoadd.delay_min')}
              value={options.delayMin} min={AUTO_ADD_CAPS.delayMin} max={AUTO_ADD_CAPS.delayMax} step={5}
              unit={t('autoadd.unit_sec')} onChange={value => setOption('delayMin', value)} />
          </DashboardSettingCard>
          <DashboardSettingCard icon={<StopIcon className="h-5 w-5" />} tone="violet" className="items-start">
            <RangeSlider id="auto_add_delay_max" label={t('autoadd.delay_max')}
              value={options.delayMax} min={AUTO_ADD_CAPS.delayMin} max={AUTO_ADD_CAPS.delayMax} step={5}
              unit={t('autoadd.unit_sec')} onChange={value => setOption('delayMax', value)} />
          </DashboardSettingCard>
          {(['day', 'session'] as const).map(key => <DashboardSettingCard key={key} icon={<UserPlusIcon className="h-5 w-5" />} tone="success" className="items-start">
            <RangeSlider id={'auto_add_' + key} label={t('autoadd.limit_' + key)} value={options[key]}
              min={1} max={AUTO_ADD_CAPS[key]} step={1} unit={t('autoadd.unit_requests')}
              onChange={value => setOption(key, value)} />
          </DashboardSettingCard>)}
        </div>
        {options.delayMax < options.delayMin && <p className="px-4 pt-2 text-sm text-error" role="alert">{t('autoadd.invalid_delay')}</p>}
      </DashboardPanel>
    </fieldset>

    <DashboardSettingCard icon={<WarningIcon className="h-5 w-5" />} title={t('autoadd.warn_title')}
      description={t('autoadd.warn_body')} tone="warning" />
    <p className="text-xs text-[var(--text-secondary)]">{t('autoadd.local_limits')}</p>
    {!enabled && <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={acknowledged} disabled={pending} onChange={event => setAcknowledged(event.target.checked)} />
      {t('autoadd.acknowledge')}
    </label>}
  </div>;
}
