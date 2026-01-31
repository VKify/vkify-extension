import React from 'react';
import { VKifyLogo } from './icons/Icons';

export default function Header() {
  return (
    <header className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-600" />
      
      {/* Pattern overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative px-5 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg shadow-black/10">
              <VKifyLogo className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">VKify</h1>
              <span className="text-xs text-white/70">Сделай VK удобнее</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 text-xs font-semibold text-white/90 bg-white/15 rounded-lg backdrop-blur">
              v1.1.0
            </span>
            <div className="relative w-3 h-3" title="Расширение активно">
              <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
              <span className="absolute inset-0 rounded-full bg-green-400" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}