import React from 'react';
import { CheckCircle, XCircle, AlertCircle, ShoppingCart, Factory } from 'lucide-react';

interface PopupProps {
  title: string;
  message: string;
  onClose: () => void;
  type?: 'success' | 'error' | 'warning' | 'purchase' | 'production';
}

export function Popup({ title, message, onClose, type = 'success' }: PopupProps) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-16 h-16 text-green-600" />;
      case 'error':
        return <XCircle className="w-16 h-16 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-16 h-16 text-orange-600" />;
      case 'purchase':
        return <ShoppingCart className="w-16 h-16 text-blue-600" />;
      case 'production':
        return <Factory className="w-16 h-16 text-green-600" />;
      default:
        return <CheckCircle className="w-16 h-16 text-green-600" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8 animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4">{getIcon()}</div>
          <h2 className="text-gray-900 mb-3 text-2xl font-semibold">{title}</h2>
          <p className="text-gray-600 mb-6 text-lg">{message}</p>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
