
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white mt-auto py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Dr. Imafidon Agbonile. All rights reserved. <span className="text-teal-600 font-mono ml-2">v1.1.0</span></p>
        <p>Contact: unival2002@yahoo.com</p>
        <p className="mt-2 text-xs text-gray-400">
            Disclaimer: This AI tool is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
