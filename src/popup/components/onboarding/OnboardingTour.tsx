import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.js';
import {
  VKifyLogo, PaletteIcon, ShieldIcon, LockIcon, ActivityIcon, CheckIcon,
  CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon,
} from '../icons/Icons.js';


interface Step {
  key: string;         // onboarding.steps.<key> catalog key
  gradient: string;    // bg-gradient-to-br from-* to-*
  glowColor: string;   // shadow color via inline style
  icon: React.ReactElement;
  hasTag?: boolean;
  bulletColors: string[]; // Tailwind text-* class per bullet
}


const STEPS: Step[] = [
  {
    key: 'welcome',
    gradient: 'from-[#0077ff] to-blue-500',
    glowColor: 'rgba(0,119,255,0.35)',
    icon: <VKifyLogo className="w-9 h-9 text-white" />,
    bulletColors: ['text-blue-400', 'text-blue-300', 'text-blue-200'],
  },
  {
    key: 'appearance',
    gradient: 'from-violet-500 to-purple-600',
    glowColor: 'rgba(139,92,246,0.35)',
    icon: <PaletteIcon className="w-9 h-9 text-white" />,
    hasTag: true,
    bulletColors: ['text-violet-300', 'text-violet-300', 'text-violet-300'],
  },
  {
    key: 'ads',
    gradient: 'from-red-500 to-rose-600',
    glowColor: 'rgba(239,68,68,0.35)',
    icon: <ShieldIcon className="w-9 h-9 text-white" />,
    hasTag: true,
    bulletColors: ['text-red-300', 'text-red-300', 'text-red-300'],
  },
  {
    key: 'privacy',
    gradient: 'from-emerald-500 to-teal-600',
    glowColor: 'rgba(16,185,129,0.35)',
    icon: <LockIcon className="w-9 h-9 text-white" />,
    hasTag: true,
    bulletColors: ['text-emerald-300', 'text-emerald-300', 'text-emerald-300'],
  },
  {
    key: 'spy',
    gradient: 'from-amber-500 to-orange-500',
    glowColor: 'rgba(245,158,11,0.35)',
    icon: <ActivityIcon className="w-9 h-9 text-white" />,
    hasTag: true,
    bulletColors: ['text-amber-300', 'text-amber-300', 'text-amber-300'],
  },
  {
    key: 'done',
    gradient: 'from-green-500 to-emerald-500',
    glowColor: 'rgba(34,197,94,0.35)',
    icon: <CheckIcon className="w-9 h-9 text-white" />,
    bulletColors: ['text-green-300', 'text-green-300', 'text-green-300'],
  },
];


function BulletIcon({ color }: { color: string }) {
  return <CheckCircleIcon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${color}`} />;
}


interface OnboardingTourProps {
  onComplete: () => void;
}

export default function OnboardingTour({ onComplete }: OnboardingTourProps): React.ReactElement {
  const { t } = useTranslation('onboarding');
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback((next: number, dir: 'forward' | 'back' = 'forward') => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 200);
  }, [animating]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) goTo(step + 1, 'forward');
    else onComplete();
  }, [step, goTo, onComplete]);

  const handleBack = useCallback(() => {
    if (step > 0) goTo(step - 1, 'back');
  }, [step, goTo]);

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  const translateOut = direction === 'forward' ? '-6px' : '6px';

  return (
    <Modal bare ariaLabel={t('aria')} onClose={onComplete}>
      <div
        className="relative w-full max-w-xs rounded-3xl bg-[var(--bg-primary)] shadow-2xl overflow-hidden"
        style={{
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          opacity: animating ? 0 : 1,
          transform: animating ? `translateY(${translateOut})` : 'translateY(0)',
        }}
      >
        <div className={`relative bg-gradient-to-br ${current.gradient} px-6 pt-5 pb-8`}>

          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
            <div
              className="h-full bg-white/50 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-semibold text-white/50 tabular-nums">
              {step + 1} / {STEPS.length}
            </span>
            <button
              onClick={onComplete}
              className="text-xs font-medium text-white/60 hover:text-white/90 transition-colors"
            >
              {t('skip')}
            </button>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              {current.icon}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              {current.hasTag && (
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">
                  {t('tab_prefix')} · {t(`steps.${current.key}.tag`)}
                </span>
              )}
              <h2 className="text-lg font-bold text-white leading-tight">
                {t(`steps.${current.key}.title`)}
              </h2>
            </div>
          </div>
        </div>

        <div className="px-6 pt-4 pb-2">
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
            {t(`steps.${current.key}.desc`)}
          </p>

          <ul className="space-y-2.5">
            {current.bulletColors.map((color, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <BulletIcon color={color} />
                <span className="text-xs text-[var(--text-primary)] leading-relaxed">{t(`steps.${current.key}.b${i + 1}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between px-6 pt-3 pb-5">
          {!isFirst ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-xl transition-all"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
              {t('back')}
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => i < step ? goTo(i, 'back') : i > step ? goTo(i, 'forward') : undefined}
                aria-label={t('step_aria', { n: i + 1 })}
                className={[
                  'rounded-full transition-all duration-300',
                  i === step
                    ? `w-5 h-1.5 bg-gradient-to-r ${current.gradient}`
                    : i < step
                      ? 'w-1.5 h-1.5 bg-[var(--text-tertiary)] hover:bg-[var(--text-secondary)] cursor-pointer'
                      : 'w-1.5 h-1.5 bg-[var(--border-color)] cursor-default',
                ].join(' ')}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 bg-gradient-to-br ${current.gradient} shadow-md`}
            style={{ boxShadow: `0 4px 14px ${current.glowColor}` }}
          >
            {isLast ? (
              <>
                {t('start')}
                <CheckIcon className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                {t('next')}
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}