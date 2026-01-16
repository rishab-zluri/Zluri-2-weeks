import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  ClipboardCheck,
  FileText,
  Key,
  Zap,
  Send,
  LucideIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  show?: boolean;
}

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { isManager, isAdmin } = useAuth(); // Note: types for useAuth will be fixed when we migrate context

  const navItems: NavItem[] = [
    {
      to: '/dashboard',
      icon: Send,
      label: 'Submit Request',
    },
    {
      to: '/approval',
      icon: ClipboardCheck,
      label: 'Approval Dashboard',
      show: isManager || isAdmin,
    },
    {
      to: '/queries',
      icon: FileText,
      label: 'My Requests',
    },
    {
      to: '/secrets',
      icon: Key,
      label: 'Secrets Manager',
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-sidebar-dark flex flex-col z-40">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-gray-700">
        <div className="bg-gradient-to-br from-pink-500 to-purple-600 p-2 rounded-xl">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <span className="text-white font-bold text-xl">Zluri SRE</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            // Skip items that shouldn't be shown
            if (item.show === false) return null;

            const isActive = location.pathname === item.to ||
              (item.to === '/dashboard' && location.pathname === '/');

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <p className="text-gray-500 text-xs text-center">
          © 2024 Zluri Inc.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
