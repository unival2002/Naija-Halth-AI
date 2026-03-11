import React from 'react';
import { LockIcon } from './icons/LockIcon';

const PremiumFeatureCard: React.FC<{ title: string; description: string }> = ({ title, description }) => {
  return (
    <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg text-center transform transition-transform hover:scale-105 hover:shadow-lg cursor-pointer">
        <div className="flex justify-center items-center mb-3">
            <div className="bg-yellow-100 p-3 rounded-full">
                <LockIcon />
            </div>
        </div>
      <h4 className="font-bold text-gray-800">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
};

export default PremiumFeatureCard;
