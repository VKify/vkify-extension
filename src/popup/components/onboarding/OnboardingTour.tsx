import React, { useState, useCallback } from 'react';


interface Bullet {
  color: string;   // Tailwind text-* class
  text: string;
}

interface Step {
  gradient: string;   // bg-gradient-to-br from-* to-*
  glowColor: string;  // shadow color via inline style
  icon: React.ReactElement;
  tag?: string;
  title: string;
  description: string;
  bullets?: Bullet[];
}


const STEPS: Step[] = [
  {
    gradient: 'from-[#0077ff] to-blue-500',
    glowColor: 'rgba(0,119,255,0.35)',
    icon: (
      <svg viewBox="0 0 231 148" className="w-9 h-9 text-white" fill="currentColor">
        <path d="M73.711 1.84L97.056 57.51c.864 2.06 3.596 2.487 5.047.789L151.041 1.051A2 2 0 0 1 153.322 0H221.115c2.53 0 3.924 2.939 2.323 4.898L107.853 146.382a2 2 0 0 1-1.357.602l-41.609-.462a2 2 0 0 1-1.881-1.311L.249 4.19C-.606 2.209.846 0 3.003 0H70.944a2 2 0 0 1 1.767 1.84z"/>
        <path d="M138.702 122.916l34.466-40.732c1.192-1.409 3.361-1.418 4.565-.02l51.942 60.38c1.674 1.944.292 4.956-2.274 4.956H160.202a2 2 0 0 1-1.445-.603l-19.353-19.645a2 2 0 0 1-.702-2.336z"/>
      </svg>
    ),
    title: 'Добро пожаловать в VKify!',
    description: 'Расширение, которое делает ВКонтакте удобнее, красивее и приватнее. Пройдём по основным возможностям — займёт меньше минуты.',
    bullets: [
      { color: 'text-blue-400',   text: '80+ тем и шрифтов на выбор' },
      { color: 'text-blue-300',   text: 'Блокировка рекламы и трекеров' },
      { color: 'text-blue-200',   text: 'Приватность и автоматизация' },
    ],
  },
  {
    gradient: 'from-violet-500 to-purple-600',
    glowColor: 'rgba(139,92,246,0.35)',
    icon: (
      <svg viewBox="0 0 24 24" className="w-9 h-9 text-white" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>
      </svg>
    ),
    tag: 'Вид',
    title: 'Внешний вид',
    description: 'Настройте VK под свой стиль — от минималистичного до яркого.',
    bullets: [
      { color: 'text-violet-300', text: '80+ встроенных тем оформления' },
      { color: 'text-violet-300', text: 'Шрифты Google Fonts и фоновые обои' },
      { color: 'text-violet-300', text: 'Скругления, отступы, акцентный цвет' },
    ],
  },
  {
    gradient: 'from-red-500 to-rose-600',
    glowColor: 'rgba(239,68,68,0.35)',
    icon: (
      <svg viewBox="0 0 24 24" className="w-9 h-9 text-white" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>
    ),
    tag: 'Реклама',
    title: 'Без рекламы',
    description: 'Полная защита от рекламы и слежки — включена по умолчанию.',
    bullets: [
      { color: 'text-red-300',  text: 'Баннеры в боковой панели' },
      { color: 'text-red-300',  text: 'Рекламные посты в ленте' },
      { color: 'text-red-300',  text: 'Трекеры аналитики VK' },
    ],
  },
  {
    gradient: 'from-emerald-500 to-teal-600',
    glowColor: 'rgba(16,185,129,0.35)',
    icon: (
      <svg viewBox="0 0 24 24" className="w-9 h-9 text-white" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    tag: 'Приватность',
    title: 'Приватность',
    description: 'Контролируйте, что видят другие, и защитите своё пространство.',
    bullets: [
      { color: 'text-emerald-300', text: 'Скрывайте диалоги по горячей клавише' },
      { color: 'text-emerald-300', text: 'Размытие страницы при потере фокуса' },
      { color: 'text-emerald-300', text: 'Обход редиректов away.php' },
    ],
  },
  {
    gradient: 'from-amber-500 to-orange-500',
    glowColor: 'rgba(245,158,11,0.35)',
    icon: (
      <svg viewBox="0 0 24 24" className="w-9 h-9 text-white" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
    ),
    tag: 'Слежка',
    title: 'Слежка за активностью',
    description: 'Знайте о действиях друзей в реальном времени.',
    bullets: [
      { color: 'text-amber-300', text: 'Печать, прочтение, редактирование, звонки' },
      { color: 'text-amber-300', text: 'Онлайн-мониторинг с графиками активности' },
      { color: 'text-amber-300', text: 'Браузерные уведомления об событиях' },
    ],
  },
  {
    gradient: 'from-green-500 to-emerald-500',
    glowColor: 'rgba(34,197,94,0.35)',
    icon: (
      <svg viewBox="0 0 24 24" className="w-9 h-9 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    title: 'Всё готово!',
    description: 'VKify настроен и готов к работе. Откройте VK и ощутите разницу.',
    bullets: [
      { color: 'text-green-300', text: 'Настройки сохраняются автоматически' },
      { color: 'text-green-300', text: 'Расширение активно на всех страницах VK' },
      { color: 'text-green-300', text: 'Если понравится — расскажите друзьям 🎉' },
    ],
  },
];


function BulletIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${color}`} fill="currentColor">
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm11.78-1.72a.75.75 0 0 1 0 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 1 1 1.06-1.06l1.22 1.22 3.22-3.22a.75.75 0 0 1 1.06 0z"/>
    </svg>
  );
}


interface OnboardingTourProps {
  onComplete: () => void;
}

export default function OnboardingTour({ onComplete }: OnboardingTourProps): React.ReactElement {
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
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
              Пропустить
            </button>
          </div>

          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{ boxShadow: `0 8px 24px ${current.glowColor}` }}
            >
              {current.icon}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              {current.tag && (
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">
                  Вкладка · {current.tag}
                </span>
              )}
              <h2 className="text-lg font-bold text-white leading-tight">
                {current.title}
              </h2>
            </div>
          </div>
        </div>

        <div className="px-6 pt-4 pb-2">
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
            {current.description}
          </p>

          {current.bullets && (
            <ul className="space-y-2.5">
              {current.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <BulletIcon color={b.color} />
                  <span className="text-xs text-[var(--text-primary)] leading-relaxed">{b.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between px-6 pt-3 pb-5">
          {!isFirst ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-xl transition-all"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Назад
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => i < step ? goTo(i, 'back') : i > step ? goTo(i, 'forward') : undefined}
                aria-label={`Шаг ${i + 1}`}
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
                Начать
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </>
            ) : (
              <>
                Далее
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}