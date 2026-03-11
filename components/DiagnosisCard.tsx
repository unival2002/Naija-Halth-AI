import React from 'react';
import { Diagnosis } from '../types';
import { LinkIcon } from './icons/LinkIcon';

const DiagnosisCard: React.FC<{ diagnosis: Diagnosis }> = ({ diagnosis }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 flex flex-col h-full transform transition-transform hover:-translate-y-1 hover:shadow-xl">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-lg font-bold text-teal-800 pr-2">{diagnosis.name}</h4>
        <span className="flex-shrink-0 bg-teal-100 text-teal-800 text-sm font-semibold px-3 py-1 rounded-full">
          {diagnosis.probability}%
        </span>
      </div>
      <p className="text-gray-600 text-sm mb-4 flex-grow">{diagnosis.description}</p>

      <div className="space-y-4 text-sm mt-auto">
        <div>
          <h5 className="font-semibold text-gray-700 mb-1">Suggested Investigations</h5>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            {diagnosis.investigations.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
        <div>
          <h5 className="font-semibold text-gray-700 mb-1">Treatment Suggestions</h5>
          <p className="text-gray-600">{diagnosis.treatment}</p>
        </div>
      </div>
    </div>
  );
};

export default DiagnosisCard;
