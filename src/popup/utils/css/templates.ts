export interface CSSTemplate {
  name: string;
  code: string;
}

export const CSS_TEMPLATES: CSSTemplate[] = [
  { name: 'Скрыть элемент', code: `.element-class {\n  display: none !important;\n}` },
  { name: 'Изменить цвет', code: `.element-class {\n  color: #ff0000 !important;\n  background-color: #000000 !important;\n}` },
  { name: 'Скруглить углы', code: `.element-class {\n  border-radius: 16px !important;\n}` },
  { name: 'Тень блока', code: `.element-class {\n  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;\n}` },
  { name: 'Hover эффект', code: `.element-class {\n  transition: all 0.3s ease !important;\n}\n\n.element-class:hover {\n  transform: scale(1.02) !important;\n  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2) !important;\n}` },
  { name: 'Центрирование (Flex)', code: `.element-class {\n  display: flex !important;\n  justify-content: center !important;\n  align-items: center !important;\n}` },
  { name: 'Обрезать текст', code: `.element-class {\n  white-space: nowrap !important;\n  overflow: hidden !important;\n  text-overflow: ellipsis !important;\n  max-width: 100% !important;\n}` },
  { name: 'Плавная прокрутка', code: `html {\n  scroll-behavior: smooth !important;\n}` },
  { name: 'Убрать скроллбар', code: `/* Для Chrome/Safari */\n.element-class::-webkit-scrollbar {\n  display: none !important;\n}\n\n/* Для Firefox */\n.element-class {\n  scrollbar-width: none !important;\n}\n\n/* Универсально */\n.element-class {\n  -ms-overflow-style: none !important;\n}` },
  { name: 'Фиксированная шапка', code: `.header-class {\n  position: fixed !important;\n  top: 0 !important;\n  left: 0 !important;\n  width: 100% !important;\n  z-index: 9999 !important;\n  box-shadow: 0 2px 10px rgba(0,0,0,0.1) !important;\n}` },
  { name: 'Градиентный фон', code: `.element-class {\n  background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%) !important;\n  color: white !important;\n}` },
  { name: 'Затемнение фона', code: `.overlay-class {\n  position: fixed !important;\n  top: 0 !important;\n  left: 0 !important;\n  width: 100% !important;\n  height: 100% !important;\n  background: rgba(0, 0, 0, 0.7) !important;\n  z-index: 10000 !important;\n}` },
  { name: 'Сброс отступов', code: `.element-class {\n  margin: 0 !important;\n  padding: 0 !important;\n  border: none !important;\n}` },
  { name: 'Повернуть элемент', code: `.element-class {\n  transform: rotate(45deg) !important;\n  transform-origin: center !important;\n}` },
];