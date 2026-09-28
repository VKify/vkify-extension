export interface ClockSettings {
  output: 'overlay' | 'widget';
  hour12: boolean;
  seconds: boolean;
  showDate: boolean;
  dateFormat: 'short' | 'long';
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'custom';
  margin: number;
  x: number;
  y: number;
  fontSize: number;
  opacity: number;
  color: string;
  background: string;
  backgroundOpacity: number;
  showBackground: boolean;
  radius: number;
  fontWeight: number;
  glass: boolean;
}
