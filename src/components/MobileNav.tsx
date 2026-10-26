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
      className="md:hidden flex items-stretch bg-black border-t border-neutral-900 flex-shrink-0"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
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
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-white' : 'text-neutral-500'
            }`}
            aria-label={item.label}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
