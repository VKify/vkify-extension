import React from 'react';
import {
  Icon24DragReorderOutline,
  Icon24Palette,
  Icon28GridLayoutOutline,
  Icon28WidgetsOutline,
  Icon28ShieldKeyholeOutline,
  Icon24Block,
  Icon24BracketsSlashOutline,
  Icon24Settings,
  Icon24Refresh,
  Icon24Done,
  Icon24ChevronRight,
  Icon24ChevronLeft,
  Icon24ChevronDown,
  Icon24Download,
  Icon24Upload,
  Icon24ReplayOutline,
  Icon24Cancel,
  Icon24Picture,
  Icon24Like,
  Icon24LogoVk,
  Icon24SunOutline,
  Icon24Moon,
  Icon24Search,
  Icon20LayoutLeftColumnOutline,
  Icon24Sparkle,
  Icon24Smile,
  Icon24Hide,
  Icon24View,
  Icon24Message,
  Icon24MessagesOutline,
  Icon24MessageOutline,
  Icon24Users,
  Icon24UsersOutline,
  Icon24Users3Outline,
  Icon24NewsfeedOutline,
  Icon24UserCircleOutline,
  Icon24CommentOutline,
  Icon24RecentOutline,
  Icon24AdvertisingOutline,
  Icon24HashtagOutline,
  Icon24ListNumberOutline,
  Icon24ArrowUp,
  Icon24ArrowUpRightOutline,
  Icon24ArrowUturnLeftOutline,
  Icon24ArrowUturnRightOutline,
  Icon24Attach,
  Icon24Lock,
  Icon24Filter,
  Icon24MusicNote,
  Icon24SlidersVerticalOutline,
  Icon24PenOutline,
  Icon20Arrows2LeftRightOutward,
  Icon24Play,
  Icon24PlayOutline,
  Icon24Stop,
  Icon24KeyboardOutline,
  Icon24Voice,
  Icon24Delete,
  Icon20CircleSmallFilled,
  Icon24Notification,
  Icon24UserAdd,
  Icon24DocumentTextOutline,
  Icon24Add,
  Icon24Clock,
  Icon24Copy,
  Icon24Bookmark,
  Icon24Favorite,
  Icon24FavoriteOutline,
  Icon24MenuOutline,
  Icon24ListBulletOutline,
  Icon24BlurOutline,
  Icon24Globe,
  Icon24Phone,
  Icon24StatisticsOutline,
  Icon24GraphOutline,
  Icon24CalendarOutline,
  Icon24Info,
  Icon24ExternalLinkOutline,
  Icon24TextBoldOutline,
  Icon24TextItalicOutline,
  Icon24TextUnderlineOutline,
  Icon24TextTtOutline,
  Icon24Flash,
  Icon24Share,
  Icon24Fullscreen,
  Icon16CornerBottomLeftInsetOutline,
  Icon24DropsOutline,
  Icon24ContrastOutline,
  Icon24ImageFilterOutline,
  Icon24Square4,
  Icon24MagicWandOutline,
  Icon24ClapperboardOutline,
  Icon24Camera,
  Icon24SkipBack,
  Icon24SkipForward,
  Icon24SquareStackUpOutline,
  Icon24CheckCircleOutline,
  Icon24CancelCircleOutline,
  Icon24WarningTriangleOutline,
  Icon24Spinner,
  Icon24ColorPickerOutline,
  Icon24DoneOutline,
  Icon24Replay10,
  Icon24Forward10,
  Icon28SpeedometerMaxOutline,
  Icon28SpeedometerStartOutline,
  Icon24SpeedometerMiddleOutline,
  Icon24LogoVkVideoOutline,
  Icon24StoryOutline,
  Icon24LogoClipsOutline,
  Icon24PictureOutline,
  Icon24LogoVkMusicOutline,
  Icon24Arrow2SquarepathOutline,
  Icon24Link,
  Icon24ScissorsOutline,
  Icon24TargetOutline,
  Icon24ChecksOutline,
  // Пункты левого меню ВК — 20px-сетка, как в самом меню.
  Icon20UserCircleOutline,
  Icon20NewsfeedOutline,
  Icon20MessageOutline,
  Icon20PhoneOutline,
  Icon20UsersOutline,
  Icon20Users3Outline,
  Icon20PictureOutline,
  Icon20MusicOutline,
  Icon20LogoVkVideoOutline,
  Icon20LogoClipsOutline,
  Icon20GameOutline,
  Icon20StickerSmileOutline,
  Icon20MarketOutline,
  Icon20ServicesOutline,
  Icon20CoinsOutline,
  Icon20BookmarkOutline,
  Icon20DocumentOutline,
  Icon20MegaphoneOutline,
  Icon20HelpOutline,
} from '@vkontakte/icons';

interface IconProps {
  className?: string;
  [key: string]: unknown;
}

/**
 * VK-иконки (@vkontakte/icons) задают инлайновые `width`/`height` через `style`,
 * которые перебивают размерные Tailwind-классы (`w-5 h-5`) на call-site.
 * Обнуляем их, чтобы размер по-прежнему управлялся `className`, как раньше.
 * Атрибуты width/height иконки (24px) остаются запасным значением, если класс не задан.
 */
const wrap = (VKIconComp: React.ElementType) => {
  const Wrapped = ({ className, ...rest }: IconProps) =>
    React.createElement(VKIconComp, {
      className,
      style: { width: undefined, height: undefined },
      ...rest,
    });
  return Wrapped;
};

// Логотип расширения VKify — собственный бренд, не иконка ВКонтакте.
export const VKifyLogo = ({ className = 'w-8 h-8' }: IconProps) => (
  <svg className={className} viewBox="0 0 231 148" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M73.711 1.83982L97.0564 57.5097C97.9202 59.5696 100.652 59.9968 102.103 58.2988L151.041 1.05066C151.611 0.383902 152.444 0 153.322 0H221.115C223.645 0 225.039 2.93882 223.438 4.898L107.853 146.382C107.275 147.089 106.408 147.494 105.496 147.484L63.8875 147.022C62.7028 147.008 61.6367 146.299 61.1668 145.211L0.249245 4.18967C-0.606304 2.2091 0.845833 0 3.00328 0H70.9444C72.153 0 73.2436 0.725252 73.711 1.83982Z" fill="currentColor"/>
    <path d="M138.702 122.916L173.168 82.1842C174.36 80.7756 176.529 80.7667 177.733 82.1655L229.675 142.544C231.349 144.488 229.967 147.5 227.401 147.5H160.202C159.395 147.5 158.621 147.175 158.057 146.597L138.848 126.952C137.766 125.845 137.703 124.098 138.702 122.916Z" fill="currentColor"/>
  </svg>
);

// Semantic VK icons for external links; their labels identify the destination.
export const GitHubIcon = /*#__PURE__*/ wrap(Icon24BracketsSlashOutline);
export const TelegramIcon = /*#__PURE__*/ wrap(Icon24Share);
export const GripIcon = /*#__PURE__*/ wrap(Icon24DragReorderOutline);

// — Оформление —
export const PaletteIcon = /*#__PURE__*/ wrap(Icon24Palette);
export const ContrastIcon = /*#__PURE__*/ wrap(Icon24ContrastOutline);
export const ImageFilterIcon = /*#__PURE__*/ wrap(Icon24ImageFilterOutline);
export const Square4Icon = /*#__PURE__*/ wrap(Icon24Square4);
export const MagicWandIcon = /*#__PURE__*/ wrap(Icon24MagicWandOutline);
export const ClapperboardIcon = /*#__PURE__*/ wrap(Icon24ClapperboardOutline);
export const CameraIcon = /*#__PURE__*/ wrap(Icon24Camera);
export const LayoutIcon = /*#__PURE__*/ wrap(Icon28GridLayoutOutline);
export const WidgetsIcon = /*#__PURE__*/ wrap(Icon28WidgetsOutline);
export const SidebarIcon = /*#__PURE__*/ wrap(Icon20LayoutLeftColumnOutline);
export const WidthIcon = /*#__PURE__*/ wrap(Icon24Fullscreen);
export const RadiusIcon = /*#__PURE__*/ wrap(Icon16CornerBottomLeftInsetOutline);
export const MoveHorizontalIcon = /*#__PURE__*/ wrap(Icon20Arrows2LeftRightOutward);
export const DropletIcon = /*#__PURE__*/ wrap(Icon24DropsOutline);
export const BlurIcon = /*#__PURE__*/ wrap(Icon24BlurOutline);
export const FilterIcon = /*#__PURE__*/ wrap(Icon24Filter);
export const SunIcon = /*#__PURE__*/ wrap(Icon24SunOutline);
export const MoonIcon = /*#__PURE__*/ wrap(Icon24Moon);
export const ImageIcon = /*#__PURE__*/ wrap(Icon24Picture);

// — Приватность / безопасность —
export const ShieldIcon = /*#__PURE__*/ wrap(Icon28ShieldKeyholeOutline);
export const BanIcon = /*#__PURE__*/ wrap(Icon24Block);
export const LockIcon = /*#__PURE__*/ wrap(Icon24Lock);
export const EyeIcon = /*#__PURE__*/ wrap(Icon24View);
export const EyeOffIcon = /*#__PURE__*/ wrap(Icon24Hide);

// — Код / CSS-редактор —
export const CodeIcon = /*#__PURE__*/ wrap(Icon24BracketsSlashOutline);
export const FormatIcon = /*#__PURE__*/ wrap(Icon24MenuOutline);
// Контурная «галочка-done» — отличается от обычной CheckIcon (заливка),
// чтобы «Сохранить» и «подтверждение» не делили один и тот же глиф.
export const SaveIcon = /*#__PURE__*/ wrap(Icon24DoneOutline);
export const UndoIcon = /*#__PURE__*/ wrap(Icon24ArrowUturnLeftOutline);
export const RedoIcon = /*#__PURE__*/ wrap(Icon24ArrowUturnRightOutline);
export const BoldIcon = /*#__PURE__*/ wrap(Icon24TextBoldOutline);
export const ItalicIcon = /*#__PURE__*/ wrap(Icon24TextItalicOutline);
export const UnderlineIcon = /*#__PURE__*/ wrap(Icon24TextUnderlineOutline);
export const TypeIcon = /*#__PURE__*/ wrap(Icon24TextTtOutline);

// — Настройки / общее —
export const SettingsIcon = /*#__PURE__*/ wrap(Icon24Settings);
export const RefreshIcon = /*#__PURE__*/ wrap(Icon24Refresh);
export const ResetIcon = /*#__PURE__*/ wrap(Icon24ReplayOutline);
export const CheckIcon = /*#__PURE__*/ wrap(Icon24Done);
export const CheckCircleIcon = /*#__PURE__*/ wrap(Icon24CheckCircleOutline);
export const CancelCircleIcon = /*#__PURE__*/ wrap(Icon24CancelCircleOutline);
export const WarningIcon = /*#__PURE__*/ wrap(Icon24WarningTriangleOutline);
export const SpinnerIcon = /*#__PURE__*/ wrap(Icon24Spinner);
export const ColorPickerIcon = /*#__PURE__*/ wrap(Icon24ColorPickerOutline);
export const XIcon = /*#__PURE__*/ wrap(Icon24Cancel);
export const PlusIcon = /*#__PURE__*/ wrap(Icon24Add);
export const TrashIcon = /*#__PURE__*/ wrap(Icon24Delete);
export const CopyIcon = /*#__PURE__*/ wrap(Icon24Copy);
export const SearchIcon = /*#__PURE__*/ wrap(Icon24Search);
export const InfoIcon = /*#__PURE__*/ wrap(Icon24Info);
export const ClockIcon = /*#__PURE__*/ wrap(Icon24Clock);
export const CalendarIcon = /*#__PURE__*/ wrap(Icon24CalendarOutline);
export const SparklesIcon = /*#__PURE__*/ wrap(Icon24Sparkle);
export const ZapIcon = /*#__PURE__*/ wrap(Icon24Flash);
export const KeyboardIcon = /*#__PURE__*/ wrap(Icon24KeyboardOutline);
export const DatabaseIcon = /*#__PURE__*/ wrap(Icon24SquareStackUpOutline);

// — Производительность (Performance Dashboard) —
export const SpeedometerIcon = /*#__PURE__*/ wrap(Icon28SpeedometerMaxOutline);
export const StatisticsIcon = /*#__PURE__*/ wrap(Icon24StatisticsOutline);
export const GraphIcon = /*#__PURE__*/ wrap(Icon24GraphOutline);

// — Навигация (шевроны / стрелки) —
export const ChevronRightIcon = /*#__PURE__*/ wrap(Icon24ChevronRight);
export const ChevronLeftIcon = /*#__PURE__*/ wrap(Icon24ChevronLeft);
export const ChevronDownIcon = /*#__PURE__*/ wrap(Icon24ChevronDown);
export const ArrowUpIcon = /*#__PURE__*/ wrap(Icon24ArrowUp);
export const ExternalLinkIcon = /*#__PURE__*/ wrap(Icon24ExternalLinkOutline);

// — Загрузка / выгрузка —
export const DownloadIcon = /*#__PURE__*/ wrap(Icon24Download);
export const UploadIcon = /*#__PURE__*/ wrap(Icon24Upload);
export const ShareIcon = /*#__PURE__*/ wrap(Icon24Share);

// — Медиа / плеер —
export const MusicIcon = /*#__PURE__*/ wrap(Icon24MusicNote);
export const PlayIcon = /*#__PURE__*/ wrap(Icon24PlayOutline);
export const PlayIconFilled = /*#__PURE__*/ wrap(Icon24Play);
export const StopIcon = /*#__PURE__*/ wrap(Icon24Stop);
export const SkipBackIcon = /*#__PURE__*/ wrap(Icon24SkipBack);       // предыдущий трек
export const SkipForwardIcon = /*#__PURE__*/ wrap(Icon24SkipForward); // следующий трек
export const SeekBackIcon = /*#__PURE__*/ wrap(Icon24Replay10);       // перемотка назад (−10с)
export const SeekForwardIcon = /*#__PURE__*/ wrap(Icon24Forward10);   // перемотка вперёд (+10с)
export const SpeedUpIcon = /*#__PURE__*/ wrap(Icon28SpeedometerMaxOutline);     // ускорить
export const SpeedDownIcon = /*#__PURE__*/ wrap(Icon28SpeedometerStartOutline); // замедлить
export const SpeedResetIcon = /*#__PURE__*/ wrap(Icon24SpeedometerMiddleOutline); // сброс до 1×
export const MicIcon = /*#__PURE__*/ wrap(Icon24Voice);
// Реальные иконки разделов из левого меню ВКонтакте (бренд-логотипы Видео/Клипы),
// чтобы пункты скачивания совпадали с тем, что видит пользователь в навигации.
export const VideoIcon = /*#__PURE__*/ wrap(Icon24LogoVkVideoOutline);
export const StoryIcon = /*#__PURE__*/ wrap(Icon24StoryOutline);
export const ClipIcon = /*#__PURE__*/ wrap(Icon24LogoClipsOutline);
export const PhotoAlbumIcon = /*#__PURE__*/ wrap(Icon24PictureOutline);
// Логотип «VK Музыка» для строки скачивания — отдельно от MusicIcon (нота),
// который шарится с аудиоплеером.
export const MusicSectionIcon = /*#__PURE__*/ wrap(Icon24LogoVkMusicOutline);
export const EqualizerIcon = /*#__PURE__*/ wrap(Icon24SlidersVerticalOutline);

// — Иконки разделов из левого меню ВКонтакте —
// Для хабов «Центр»/«Скрытие»: подписи совпадают с пунктами навигации ВК.
// Отдельно от общих MessageIcon/UsersIcon, которые шарятся по всему попапу.
export const MessengerIcon = /*#__PURE__*/ wrap(Icon24MessageOutline); // «Мессенджер»
export const FeedIcon = /*#__PURE__*/ wrap(Icon24NewsfeedOutline);     // «Лента»
export const FriendsIcon = /*#__PURE__*/ wrap(Icon24UsersOutline);     // «Друзья»
export const ProfileIcon = /*#__PURE__*/ wrap(Icon24UserCircleOutline); // «Профиль»
export const MenuSectionIcon = /*#__PURE__*/ wrap(Icon24MenuOutline);  // «Меню» (левое меню ВК)
export const CommunitiesIcon = /*#__PURE__*/ wrap(Icon24Users3Outline); // «Сообщества»

// Элементы внутри страниц хаба «Скрытие»
export const CommentIcon = /*#__PURE__*/ wrap(Icon24CommentOutline);   // комментарии под постами
export const RecentIcon = /*#__PURE__*/ wrap(Icon24RecentOutline);     // недавнее (группы)
export const AdIcon = /*#__PURE__*/ wrap(Icon24AdvertisingOutline);    // рекламные блоки
export const HashtagIcon = /*#__PURE__*/ wrap(Icon24HashtagOutline);   // каналы
export const CounterIcon = /*#__PURE__*/ wrap(Icon24ListNumberOutline); // счётчики в меню

// — Соцактивность / люди / сообщения —
export const HeartIcon = /*#__PURE__*/ wrap(Icon24Like);
export const SmileIcon = /*#__PURE__*/ wrap(Icon24Smile);
export const UsersIcon = /*#__PURE__*/ wrap(Icon24Users);
export const UserPlusIcon = /*#__PURE__*/ wrap(Icon24UserAdd);
export const MessageCircleIcon = /*#__PURE__*/ wrap(Icon24Message);
export const MessageIcon = /*#__PURE__*/ wrap(Icon24MessagesOutline);
export const BellIcon = /*#__PURE__*/ wrap(Icon24Notification);
export const BookmarkIcon = /*#__PURE__*/ wrap(Icon24Bookmark);
export const EditIcon = /*#__PURE__*/ wrap(Icon24PenOutline);
export const FileTextIcon = /*#__PURE__*/ wrap(Icon24DocumentTextOutline);
export const AttachIcon = /*#__PURE__*/ wrap(Icon24Attach); // скрепка — вложения файлов

// — Статистика / онлайн —
export const ActivityIcon = /*#__PURE__*/ wrap(Icon24StatisticsOutline);
export const ChartIcon = /*#__PURE__*/ wrap(Icon24GraphOutline);
export const TrendingUpIcon = /*#__PURE__*/ wrap(Icon24ArrowUpRightOutline);
export const OnlinePulseIcon = /*#__PURE__*/ wrap(Icon20CircleSmallFilled);
export const GlobeIcon = /*#__PURE__*/ wrap(Icon24Globe);
export const PhoneIcon = /*#__PURE__*/ wrap(Icon24Phone);
export const LayoutRowsIcon = /*#__PURE__*/ wrap(Icon24ListBulletOutline);

// — Реклама / скрипты (точечные по смыслу) —
export const ScissorsIcon = /*#__PURE__*/ wrap(Icon24ScissorsOutline);      // «резать» рекламу в DOM
export const TargetIcon = /*#__PURE__*/ wrap(Icon24TargetOutline);          // трекеры/слежка
export const ReadCheckIcon = /*#__PURE__*/ wrap(Icon24ChecksOutline);       // прочитано (двойная галочка)
export const ConvertIcon = /*#__PURE__*/ wrap(Icon24Arrow2SquarepathOutline); // смена раскладки ru↔en
export const LinkIcon = /*#__PURE__*/ wrap(Icon24Link);                    // прямая ссылка (обход away.php)

// — Иконки пунктов левого меню ВК (20px, совпадают с самим меню) —
export const MenuProfileIcon   = wrap(Icon20UserCircleOutline);
export const MenuFeedIcon      = wrap(Icon20NewsfeedOutline);
export const MenuMessagesIcon  = wrap(Icon20MessageOutline);
export const MenuCallsIcon     = wrap(Icon20PhoneOutline);
export const MenuFriendsIcon   = wrap(Icon20UsersOutline);
export const MenuGroupsIcon    = wrap(Icon20Users3Outline);
export const MenuPhotosIcon    = wrap(Icon20PictureOutline);
export const MenuMusicIcon     = wrap(Icon20MusicOutline);
export const MenuVideoIcon     = wrap(Icon20LogoVkVideoOutline);
export const MenuClipsIcon     = wrap(Icon20LogoClipsOutline);
export const MenuGamesIcon     = wrap(Icon20GameOutline);
export const MenuStickersIcon  = wrap(Icon20StickerSmileOutline);
export const MenuMarketIcon    = wrap(Icon20MarketOutline);
export const MenuServicesIcon  = wrap(Icon20ServicesOutline);
export const MenuVotesIcon     = wrap(Icon20CoinsOutline);
export const MenuBookmarksIcon = /*#__PURE__*/ wrap(Icon20BookmarkOutline);
export const MenuDocsIcon      = wrap(Icon20DocumentOutline);
export const MenuAdsIcon       = wrap(Icon20MegaphoneOutline);
export const MenuHelpIcon      = wrap(Icon20HelpOutline);
// Нейтральный знак контекстной справки. В отличие от залитого InfoIcon не
// перетягивает внимание с самой настройки.
export const HelpOutlineIcon   = /*#__PURE__*/ wrap(Icon20HelpOutline);

// — Бренды —
export const VKIcon = /*#__PURE__*/ wrap(Icon24LogoVk);

/**
 * Звезда с двумя визуальными состояниями.
 * `filled` — залитая (Icon24Favorite) либо контурная (Icon24FavoriteOutline).
 */
export const StarIcon = ({ className, filled = false }: IconProps & { filled?: boolean }) =>
  React.createElement(filled ? Icon24Favorite : Icon24FavoriteOutline, {
    className,
    style: { width: undefined, height: undefined },
  });
