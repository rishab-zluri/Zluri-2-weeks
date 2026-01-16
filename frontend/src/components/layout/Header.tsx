import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onMenuToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-gray-200 z-30">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left side - Menu button (mobile) */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>

        {/* Zluri Logo */}
        <div className="flex items-center gap-2">
          <div className="bg-gray-900 text-white px-2 py-1 rounded text-sm font-bold">
            zluri
          </div>
        </div>

        {/* Right side - User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-pink-500 to-purple-600 
                     text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all"
          >
            <span className="font-medium">{user?.email || 'User'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 
                          py-1 animate-fadeIn">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 
                               text-xs rounded-full capitalize">
                  {user?.role || 'developer'}
                </span>
              </div>

              <button
                onClick={() => {/* Navigate to profile */ }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 
                         hover:bg-gray-50 transition-colors"
              >
                <User className="w-4 h-4" />
                Profile Settings
              </button>

              <hr className="my-1" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 
                         hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
