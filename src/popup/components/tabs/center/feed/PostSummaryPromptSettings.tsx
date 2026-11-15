import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '@/popup/store/index.js';
import { Textarea } from '@/popup/components/ui/FormControls.js';
import ResetButton from '@/popup/components/ui/ResetButton.js';
import { POST_SUMMARY_INSTRUCTIONS, POST_SUMMARY_PROMPT_MAX, postSummaryInstruction, type PostSummaryLanguage } from '@/shared/post-summary.js';

export default function PostSummaryPromptSettings(): React.ReactElement {
  const { t, i18n } = useTranslation('center');
  const settings = useVKifyStore(s => s.settings);
  const saveSetting = useVKifyStore(s => s.saveSetting);
  const language: PostSummaryLanguage = i18n.language.startsWith('ru') ? 'ru' : 'en';
  const savedRu = postSummaryInstruction('ru', settings.post_summary_prompt_ru);
  const savedEn = postSummaryInstruction('en', settings.post_summary_prompt_en);
  const [drafts, setDrafts] = useState({ ru: savedRu, en: savedEn });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState<PostSummaryLanguage | null>(null);
  useEffect(() => { setSaved(null); setError(false); }, [language]);
  useEffect(() => { setDrafts(previous => ({ ...previous, ru: savedRu })); }, [savedRu]);
  useEffect(() => { setDrafts(previous => ({ ...previous, en: savedEn })); }, [savedEn]);
  const value = drafts[language];
  const canSave = !!value.trim() && value.trim() !== (language === 'ru' ? savedRu : savedEn) && !saving;
  const persist = async (reset = false): Promise<void> => {
    if (saving || (!reset && !canSave)) return;
    setSaving(true); setError(false); setSaved(null);
    const target = language;
    try {
      const ok = await saveSetting(`post_summary_prompt_${target}`, reset ? '' : drafts[target].trim());
      if (ok) { setDrafts(previous => ({ ...previous, [target]: reset ? POST_SUMMARY_INSTRUCTIONS[target] : previous[target].trim() })); setSaved(target); }
      else setError(true);
    } catch { setError(true); }
    finally { setSaving(false); }
  };
  return <fieldset disabled={saving} className="min-w-0 space-y-3 px-4 pb-4">
    <label className="block text-xs text-[var(--text-secondary)]" htmlFor="post-summary-instruction">{t('feed.prompt_label')}</label>
    <Textarea id="post-summary-instruction" data-vkify-anchor={`post_summary_prompt_${language}`} rows={7}
      value={value} maxLength={POST_SUMMARY_PROMPT_MAX} disabled={saving} className="w-full resize-y text-sm"
      aria-describedby="post-summary-prompt-help" onChange={event => {
        setDrafts(previous => ({ ...previous, [language]: event.target.value })); setSaved(null); setError(false);
      }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void persist(); } }} />
    <div className="flex items-start justify-between gap-3 text-xs text-[var(--text-secondary)]">
      <p id="post-summary-prompt-help">{t('feed.prompt_help')}</p><span className="shrink-0 tabular-nums">{value.length}/{POST_SUMMARY_PROMPT_MAX}</span>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <ResetButton label={t('feed.prompt_reset')} onClick={() => { void persist(true); }} />
      <button type="button" disabled={!canSave} onClick={() => { void persist(); }}
        className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:cursor-default disabled:opacity-40">{t('feed.prompt_save')}</button>
    </div>
    {error && <p role="alert" className="text-xs text-error">{t('feed.prompt_error')}</p>}
    {saved === language && <p role="status" className="text-xs text-[var(--text-secondary)]">{t('feed.prompt_saved')}</p>}
  </fieldset>;
}
