import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, action, style }) => {
  return (
    <div 
      className={`bg-white rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden ${className}`}
      style={style}
    >
        {(title || action) && (
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                {title && <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>}
                {action && <div>{action}</div>}
            </div>
        )}
      <div className="px-6 py-6">{children}</div>
    </div>
  );
};