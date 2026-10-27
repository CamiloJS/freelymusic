import React from 'react';
import Home from 'lucide-react/dist/esm/icons/house.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import Library from 'lucide-react/dist/esm/icons/library.mjs';

interface MobileNavProps {
  currentTab: string;
  onSelectTab: (tab: 'home' | 'cloud' | 'library') => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, onSelectTab }) => {
  const items = [
    { id: 'home' as const, label: 'Inicio', icon: Home },
    { id: 'cloud' as const, label: 'Buscar', icon: Search },
    { id: 'library' as const, label: 'Tu biblioteca', icon: Library },
  ];

  return (
    <nav
      className="md:hidden flex items-stretch bg-[#121212]/95 backdrop-blur-2xl border-t border-[#282828]/60 flex-shrink-0 z-40 select-none shadow-[0_-8px_20px_rgba(0,0,0,0.5)]"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          currentTab === item.id ||
          (item.id === 'library' && currentTab === 'library');

        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 text-[10px] tracking-tight transition-transform active:scale-95 ${
              isActive ? 'text-white font-bold' : 'text-[#B3B3B3] hover:text-white font-medium'
            }`}
            aria-label={item.label}
          >
            <Icon
              className={`w-5 h-5 transition-all ${
                isActive ? 'text-white fill-white scale-105' : 'text-[#B3B3B3]'
              }`}
            />
            <span className="leading-none">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
