import React, { useState, useEffect, useRef } from 'react';
import { AppNotification, UserProfile } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';
import { Toast } from './Toast';

interface Props {
  user: UserProfile;
}

export const NotificationBell: React.FC<Props> = ({ user }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [toastNotification, setToastNotification] = useState<AppNotification | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Subscribe to notifications
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = firebaseService.subscribeToNotifications(user.uid, user.role, (data) => {
        setNotifications(prev => {
            // Check for new notifications to trigger toast
            if (prev.length > 0 && data.length > 0) {
                const latestOld = prev[0];
                const latestNew = data[0];
                
                // If ID is different and it was created very recently (< 10 seconds ago)
                if (latestNew.id !== latestOld.id && (Date.now() - latestNew.createdAt) < 10000) {
                    setToastNotification(latestNew);
                }
            } else if (data.length > 0) {
                 // Initial load (or empty to having items), check if newest is recent
                 const latest = data[0];
                 if ((Date.now() - latest.createdAt) < 5000) {
                     setToastNotification(latest);
                 }
            }
            return data;
        });
    });

    return () => unsubscribe();
  }, [user]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = async (n: AppNotification) => {
      if (!n.read) {
          await firebaseService.markNotificationRead(n.id);
          // Local update will happen via subscription, but we can do optimistic update
      }
      
      // Handle Navigation via Event
      if (n.metadata && n.metadata.type === 'CHAT') {
          const event = new CustomEvent('open-chat-view', { 
              detail: { 
                  bookingId: n.metadata.bookingId, 
                  itemId: n.metadata.itemId 
              } 
          });
          window.dispatchEvent(event);
      } else if (n.link) {
          // window.location.href = n.link; 
      }
      setIsOpen(false);
  };

  const formatTime = (timestamp: number) => {
      const diff = Date.now() - timestamp;
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors relative"
      >
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 bg-red-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
            </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in-up">
            <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-800 text-sm">Notifications</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">
                        No notifications.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {notifications.map(n => (
                            <div 
                                key={n.id} 
                                onClick={() => handleNotificationClick(n)}
                                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${!n.read ? 'bg-red-50/10' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-sm font-semibold ${!n.read ? 'text-red-700' : 'text-gray-800'}`}>
                                        {n.title}
                                    </span>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                        {formatTime(n.createdAt)}
                                    </span>
                                </div>
                                <p className={`text-xs ${!n.read ? 'text-gray-700' : 'text-gray-500'}`}>
                                    {n.message}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Real-time Toast */}
      {toastNotification && (
          <Toast 
              message={toastNotification.message}
              type={toastNotification.type === 'SUCCESS' ? 'success' : toastNotification.type === 'ERROR' ? 'error' : 'info'}
              onClose={() => setToastNotification(null)}
              duration={5000}
          />
      )}
    </div>
  );
};
