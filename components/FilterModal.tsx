
import React, { useState } from 'react';
import { FilterState } from '../types';
import { getWeeksInYear, formatDate, MONTH_NAMES } from '../utils/date';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './icons';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filter: FilterState) => void;
  currentFilter: FilterState;
}

const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose, onApply, currentFilter }) => {
  const [year, setYear] = useState(currentFilter.year);
  const [view, setView] = useState<'main' | 'week' | 'month'>('main');

  if (!isOpen) return null;

  const handleApply = (filter: FilterState) => {
    onApply(filter);
    onClose();
  };
  
  const renderMainView = () => (
    <>
      <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-4">
          <h2 className="text-2xl font-bold text-white">Bộ lọc dữ liệu</h2>
          <div className="flex items-center gap-4 bg-slate-800 rounded-full px-2 py-1 border border-slate-600">
              <button onClick={() => setYear(y => y - 1)} className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><ChevronLeftIcon /></button>
              <span className="text-xl font-bold w-16 text-center text-amber-400">{year}</span>
              <button onClick={() => setYear(y => y + 1)} className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><ChevronRightIcon /></button>
          </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <button onClick={() => setView('month')} className="w-full text-left p-4 bg-slate-800 border border-slate-700 hover:border-amber-500 hover:bg-slate-750 rounded-xl transition-all flex justify-between items-center group">
            <span className="font-semibold text-slate-200 group-hover:text-white">Lọc theo Tháng</span>
            <ChevronRightIcon className="text-slate-500 group-hover:text-amber-400"/>
        </button>
        <button onClick={() => setView('week')} className="w-full text-left p-4 bg-slate-800 border border-slate-700 hover:border-amber-500 hover:bg-slate-750 rounded-xl transition-all flex justify-between items-center group">
            <span className="font-semibold text-slate-200 group-hover:text-white">Lọc theo Tuần</span>
            <ChevronRightIcon className="text-slate-500 group-hover:text-amber-400"/>
        </button>
        <button onClick={() => handleApply({ type: 'year', year })} className="w-full text-left p-4 bg-slate-800 border border-slate-700 hover:border-amber-500 hover:bg-slate-750 rounded-xl transition-all text-slate-200 hover:text-white">
            Lọc theo cả Năm {year}
        </button>
        <button onClick={() => handleApply({ type: 'all', year: new Date().getFullYear() })} className="w-full text-left p-4 bg-slate-800 border border-slate-700 hover:border-red-500 hover:bg-red-900/20 rounded-xl transition-all text-slate-200 hover:text-red-300 mt-2">
            Hiển thị tất cả dữ liệu
        </button>
      </div>
    </>
  );

  const renderMonthView = () => (
    <>
      <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-4">
        <button onClick={() => setView('main')} className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-sm font-bold">
            <ChevronLeftIcon /> Quay lại
        </button>
        <h3 className="text-lg font-bold text-white">Chọn tháng - {year}</h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {MONTH_NAMES.map((name, index) => (
          <button
            key={name}
            onClick={() => handleApply({ type: 'month', year, month: index })}
            className="p-3 text-center bg-slate-800 border border-slate-700 hover:bg-amber-600 hover:border-amber-500 hover:text-white rounded-lg transition-all text-slate-300 text-sm font-medium"
          >
            {name.replace('Tháng ', 'T')}
          </button>
        ))}
      </div>
    </>
  );

  const renderWeekView = () => {
    const weeks = getWeeksInYear(year);
    return (
      <>
        <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-4">
          <button onClick={() => setView('main')} className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-sm font-bold">
             <ChevronLeftIcon /> Quay lại
          </button>
          <h3 className="text-lg font-bold text-white">Chọn tuần - {year}</h3>
        </div>
        <div className="max-h-96 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
          {weeks.map(({ week, start, end }) => (
            <button
              key={week}
              onClick={() => handleApply({ type: 'week', year, week })}
              className="w-full text-left p-3 bg-slate-800 border border-slate-700 hover:bg-blue-900/30 hover:border-blue-500 rounded-lg transition-all group"
            >
              <div className="flex justify-between items-center">
                  <p className="font-bold text-slate-200 group-hover:text-white">Tuần {week}</p>
                  <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300 group-hover:text-white">{formatDate(start)} - {formatDate(end)}</span>
              </div>
            </button>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-600 rounded-2xl shadow-2xl p-6 w-full max-w-md relative animate-fade-in-up text-slate-100">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
          <CloseIcon className="w-6 h-6" />
        </button>
        {view === 'main' && renderMainView()}
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
      </div>
    </div>
  );
};

export default FilterModal;
