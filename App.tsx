
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Debt, FilterState, GasLog, SeasonalTheme, Transaction, ExpenseLog, DebtTransaction, IncomeLog, FoodLog, Holiday } from './types';
import { TaurusIcon, StarIcon, SnowflakeIcon, FilterIcon, GasPumpIcon, WifiIcon, FoodIcon, PiggyBankIcon, TargetIcon, ChartLineIcon, WarningIcon, PlusIcon, CheckIcon, CalendarIcon, TagIcon, MoneyBillIcon, BoltIcon, SaveIcon, CircleIcon, CheckCircleIcon, HistoryIcon, HourglassIcon, CloseIcon, ListIcon, TrashIcon, CreditCardIcon, RepeatIcon, EditIcon, ReceiptIcon, ShoppingBagIcon, MinusIcon, CalendarPlusIcon, PlaneIcon, WalletIcon, SunIcon, ArrowRightIcon, ExchangeIcon, GearIcon, CloudArrowUpIcon, CloudArrowDownIcon, FileCodeIcon } from './components/icons';
import { formatDate, formatDateTime, daysBetween, getWeekNumber, getWeekRange, isDateInFilter, MONTH_NAMES, getUpcomingHolidays } from './utils/date';
import Header from './components/Header';
import FilterModal from './components/FilterModal';
import { sadDogImageBase64 } from './assets/sadDogImage';

// --- Storage Key ---
const STORAGE_KEY = 'spending_app_data_v1';

// --- Helper function to load data ---
const loadData = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return null;
        
        const parsed = JSON.parse(saved);
        return parseSavedData(parsed);
    } catch (e) {
        console.error("Failed to load data", e);
        return null;
    }
};

// Separated parse logic for reuse in Import functionality
const parseSavedData = (parsed: any) => {
    // Helper to convert date strings back to Date objects
    const parseDate = (d: string | Date) => new Date(d);

    // Rehydrate Dates in Arrays
    if (parsed.gasHistory) parsed.gasHistory.forEach((x: any) => x.date = parseDate(x.date));
    if (parsed.lastWifiPayment) parsed.lastWifiPayment = parseDate(parsed.lastWifiPayment);
    
    if (parsed.incomeLogs) parsed.incomeLogs.forEach((x: any) => x.date = parseDate(x.date));
    if (parsed.foodLogs) parsed.foodLogs.forEach((x: any) => x.date = parseDate(x.date));
    if (parsed.miscLogs) parsed.miscLogs.forEach((x: any) => x.date = parseDate(x.date));
    
    if (parsed.debts) {
        parsed.debts = parsed.debts.map((d: any) => ({
            ...d,
            dueDate: parseDate(d.dueDate),
            createdAt: parseDate(d.createdAt),
            transactions: d.transactions?.map((t: any) => ({ ...t, date: parseDate(t.date) })) || []
        }));
    }

    if (parsed.holidays) {
        parsed.holidays.forEach((x: any) => x.date = parseDate(x.date));
    }
    
    return parsed;
}


// --- Helper Components ---

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
    value: number;
    onValueChange: (value: number) => void;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onValueChange, className, placeholder, ...props }) => {
    // Display value is the actual value divided by 1000 (e.g., 315000 -> 315)
    const displayValue = value === 0 ? '' : (value / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 3 });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/[^0-9.]/g, '');
        
        if (!rawValue) {
            onValueChange(0);
            return;
        }

        const numValue = parseFloat(rawValue);
        if (!isNaN(numValue)) {
            onValueChange(numValue * 1000);
        }
    };

    return (
        <div className="relative w-full">
            <input
                {...props}
                type="text"
                className={`${className} pr-12`}
                value={displayValue}
                onChange={handleChange}
                placeholder={placeholder || "0"}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none select-none font-medium">
                .000
            </span>
        </div>
    );
};

interface StatCardProps {
    icon: React.ReactNode;
    title: string;
    value: string;
    color: string;
    subtitle?: string;
    theme: SeasonalTheme;
    action?: React.ReactNode;
}
const StatCard: React.FC<StatCardProps> = ({ icon, title, value, color, subtitle, theme, action }) => (
    <div className={`${theme.cardBg} p-4 rounded-lg shadow-md flex items-center justify-between`}>
        <div className="flex items-center">
            <div className={`mr-4 text-3xl ${color}`}>{icon}</div>
            <div>
                <p className={`text-sm ${theme.secondaryTextColor}`}>{title}</p>
                <p className={`text-xl font-bold ${theme.primaryTextColor}`}>{value}</p>
                {subtitle && <p className={`text-xs ${theme.secondaryTextColor}`}>{subtitle}</p>}
            </div>
        </div>
        {action && <div>{action}</div>}
    </div>
);

interface DebtItemProps {
    debt: Debt;
    onAddPayment: (id: string, amount: number, date: Date) => void;
    onWithdrawPayment: (id: string, amount: number, reason: string) => void;
    onEdit: (debt: Debt) => void;
    theme: SeasonalTheme;
    disposableIncome: number; // For smart suggestion
}
const DebtItem: React.FC<DebtItemProps> = ({ debt, onAddPayment, onWithdrawPayment, onEdit, theme, disposableIncome }) => {
    const [inputValue, setInputValue] = useState(0);
    const [showWithdrawReason, setShowWithdrawReason] = useState(false);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    
    // Payment Confirmation State
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

    const remaining = debt.totalAmount - debt.amountPaid;
    const today = new Date();
    const isOverdue = today > debt.dueDate && remaining > 0;
    const daysLeft = Math.ceil((debt.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate Weekly Need
    const weeksRemaining = Math.max(1, Math.ceil(daysLeft / 7));
    const weeklyPaymentNeed = remaining > 0 ? remaining / weeksRemaining : 0;

    const handleInitiateAdd = () => {
        if (inputValue <= 0) return;
        setIsConfirmingPayment(true);
        setPaymentDate(new Date().toISOString().slice(0, 10));
    };

    const confirmAddPayment = () => {
        onAddPayment(debt.id, inputValue, new Date(paymentDate));
        setInputValue(0);
        setIsConfirmingPayment(false);
    };

    const cancelAddPayment = () => {
        setIsConfirmingPayment(false);
    };

    const initiateWithdraw = () => {
        if (inputValue <= 0) return;
        if (inputValue > debt.amountPaid) {
            alert("Không thể rút quá số tiền đã đóng!");
            return;
        }
        setShowWithdrawReason(true);
    };

    const confirmWithdraw = () => {
        if (!withdrawReason.trim()) {
            alert("Vui lòng nhập lý do rút tiền!");
            return;
        }
        onWithdrawPayment(debt.id, inputValue, withdrawReason);
        setShowWithdrawReason(false);
        setWithdrawReason('');
        setInputValue(0);
    };

    // Smart Suggestion Logic
    const getSmartSuggestion = () => {
        if (remaining <= 0) return null;

        if (disposableIncome <= 0) {
            return {
                text: "Thu nhập thấp, cân nhắc tạm ngưng.",
                color: "text-slate-400",
                bgColor: "bg-slate-700/50"
            };
        }

        // Basic logic: If rich, suggest covering a significant portion or accelerating
        if (disposableIncome > weeklyPaymentNeed * 2) {
             return {
                text: "Dư dả! Gợi ý tăng mức góp để trả nhanh.",
                color: "text-green-300",
                bgColor: "bg-green-900/30"
            };
        }

        return {
            text: "Tiếp tục góp theo kế hoạch.",
            color: "text-blue-300",
            bgColor: "bg-blue-900/30"
        };
    };

    const suggestion = getSmartSuggestion();
    const accentColorClass = theme.accentColor.replace('bg-', 'ring-');
    const accentBorderClass = theme.accentColor.replace('bg-', 'border-');

    let statusColor = 'text-green-400';
    let statusText = `Còn ${daysLeft} ngày`;
    if (daysLeft < 0) {
        statusColor = 'text-red-400';
        statusText = `Quá hạn ${Math.abs(daysLeft)} ngày`;
    } else if (daysLeft <= 3) {
        statusColor = 'text-orange-400';
        statusText = `Gấp! Còn ${daysLeft} ngày`;
    }

    const targetBudgetInfo = debt.targetMonth !== undefined 
        ? `Ngân sách: ${MONTH_NAMES[debt.targetMonth]} ${debt.targetYear}` 
        : null;

    return (
        <div className={`p-4 rounded-lg shadow-md mb-3 transition-all duration-300 ${isOverdue ? 'bg-red-900/20 border border-red-500/30' : `${theme.cardBg} border border-slate-700/50`}`}>
            <div className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                    <div className="flex items-center gap-2">
                        <h4 className={`font-bold text-lg ${theme.primaryTextColor}`}>{debt.name}</h4>
                        <button onClick={() => onEdit(debt)} className="text-xs text-slate-500 hover:text-white p-1 rounded hover:bg-white/10 transition">
                            <EditIcon />
                        </button>
                        <button 
                            onClick={() => setShowHistory(!showHistory)} 
                            className={`text-xs px-2 py-1 rounded transition ${showHistory ? 'bg-blue-500/30 text-blue-200' : 'text-slate-500 hover:text-blue-300'}`}
                        >
                            <HistoryIcon className="mr-1"/> Lịch sử
                        </button>
                    </div>
                    <p className={`text-sm ${theme.secondaryTextColor} flex items-center gap-2`}><TagIcon /> {debt.source}</p>
                    <p className={`text-sm ${theme.secondaryTextColor} flex items-center gap-2`}><CalendarIcon/> Hạn: {formatDate(debt.dueDate)}</p>
                    {targetBudgetInfo && (
                        <p className="text-xs text-amber-400/80 mt-1 italic border-l-2 border-amber-400/50 pl-2">
                            {targetBudgetInfo}
                        </p>
                    )}
                </div>
                <div className="text-right">
                    <p className={`font-bold text-xl ${theme.primaryTextColor}`}>{remaining.toLocaleString('vi-VN')}đ</p>
                    {remaining > 0 && (
                        <p className="text-xs font-semibold text-pink-400 mt-1 flex justify-end items-center gap-1" title="Số tiền cần góp mỗi tuần để trả hết đúng hạn">
                           <ChartLineIcon className="w-3 h-3" />
                           ~{Math.round(weeklyPaymentNeed).toLocaleString('vi-VN')}đ/tuần
                        </p>
                    )}
                    <div className={`text-sm font-bold flex items-center justify-end gap-1 mt-1 ${statusColor}`}>
                        <HourglassIcon className="text-xs"/>
                        {statusText}
                    </div>
                </div>
            </div>
            
            {showHistory && debt.transactions && debt.transactions.length > 0 && (
                <div className="mt-3 mb-3 bg-black/40 rounded p-2 text-xs max-h-32 overflow-y-auto">
                    <h5 className="font-bold text-slate-400 mb-1 sticky top-0 bg-black/40 pb-1">Lịch sử giao dịch:</h5>
                    {debt.transactions.slice().reverse().map(t => (
                        <div key={t.id} className="flex justify-between py-1 border-b border-white/5 last:border-0">
                            <span className="text-slate-400">{formatDate(new Date(t.date))}</span>
                            <div className="text-right">
                                <span className={t.type === 'payment' ? 'text-green-400' : 'text-red-400 font-bold'}>
                                    {t.type === 'payment' ? '+' : '-'}{t.amount.toLocaleString('vi-VN')}
                                </span>
                                {t.reason && <span className="block text-[10px] text-slate-500 italic">{t.reason}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-4">
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div className={`${theme.accentColor} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${Math.min((debt.amountPaid / debt.totalAmount) * 100, 100)}%` }}></div>
                </div>
                <div className={`text-xs ${theme.secondaryTextColor} mt-1 flex justify-between`}>
                    <span>Đã trả: {debt.amountPaid.toLocaleString('vi-VN')}đ</span>
                    <span>Tổng: {debt.totalAmount.toLocaleString('vi-VN')}đ</span>
                </div>
            </div>

            {/* Smart Suggestion */}
            {suggestion && (
                <div className={`mt-3 p-2 rounded text-xs flex items-center gap-2 ${suggestion.bgColor} ${suggestion.color}`}>
                    <i className="fa-solid fa-lightbulb"></i>
                    <span>{suggestion.text}</span>
                </div>
            )}

             <div className="mt-3 flex items-end gap-2">
                <div className="flex-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Cập nhật số tiền</label>
                    <CurrencyInput
                        value={inputValue}
                        onValueChange={setInputValue}
                        className={`w-full px-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-md focus:ring-2 focus:${accentColorClass} focus:${accentBorderClass} transition text-white`}
                        placeholder="Nhập số tiền..."
                    />
                </div>
                <button 
                    onClick={handleInitiateAdd} 
                    disabled={inputValue <= 0}
                    className={`px-3 py-1.5 h-[38px] rounded-md text-slate-900 font-bold ${theme.accentColor} hover:opacity-80 transition disabled:opacity-50 flex items-center`}
                    title="Góp thêm"
                >
                    <PlusIcon />
                </button>
                <button 
                    onClick={initiateWithdraw} 
                    disabled={inputValue <= 0 || inputValue > debt.amountPaid}
                    className="px-3 py-1.5 h-[38px] rounded-md text-white font-bold bg-slate-700 hover:bg-red-900/50 hover:text-red-400 transition disabled:opacity-50 flex items-center"
                    title="Rút bớt (Tiêu dùng)"
                >
                    <MinusIcon />
                </button>
            </div>
            
            {/* Confirm Payment Date Popup */}
            {isConfirmingPayment && (
                <div className="mt-2 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded animate-fade-in-up relative">
                    <p className="text-xs font-bold text-emerald-300 mb-2">Xác nhận thời gian giao dịch:</p>
                    <p className="text-[10px] text-slate-400 mb-2 italic">
                        "Chọn ngày bạn thực sự trích tiền từ thu nhập. Nếu khoản này từ thu nhập tuần trước, hãy chọn ngày của tuần trước để tránh làm sai lệch chi tiêu tuần này."
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                        <CalendarIcon className="text-slate-400"/>
                        <input 
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white px-2 py-1 rounded text-sm focus:border-emerald-400 outline-none flex-1"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button 
                            onClick={cancelAddPayment}
                            className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                        >
                            Hủy
                        </button>
                        <button 
                            onClick={confirmAddPayment}
                            className="px-2 py-1 text-xs rounded bg-emerald-600 text-white font-bold hover:bg-emerald-500"
                        >
                            Xác nhận góp {inputValue.toLocaleString('vi-VN')}đ
                        </button>
                    </div>
                </div>
            )}

            {showWithdrawReason && (
                <div className="mt-2 p-3 bg-red-900/20 border border-red-500/30 rounded animate-fade-in-up">
                    <label className="block text-xs font-bold text-red-300 mb-1">Lý do rút tiền (Bắt buộc):</label>
                    <input 
                        type="text" 
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white px-2 py-1 rounded text-sm mb-2 focus:border-red-400 outline-none"
                        placeholder="VD: Cần tiền mua thuốc..."
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
                        <button 
                            onClick={() => setShowWithdrawReason(false)}
                            className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-300"
                        >
                            Hủy
                        </button>
                        <button 
                            onClick={confirmWithdraw}
                            className="px-2 py-1 text-xs rounded bg-red-600 text-white font-bold hover:bg-red-500"
                        >
                            Xác nhận rút
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

interface BudgetRowProps {
    icon: React.ReactNode;
    label: string;
    budget: number;
    actual: number;
    onBudgetChange: (val: number) => void;
    onActualChange: (val: number) => void;
    theme: SeasonalTheme;
    colorClass: string;
    onDetailClick?: () => void;
}

const BudgetRow: React.FC<BudgetRowProps> = ({ icon, label, budget, actual, onBudgetChange, onActualChange, theme, colorClass, onDetailClick }) => {
    const [addValue, setAddValue] = useState(0);
    const percentage = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
    const isOverBudget = actual > budget && budget > 0;

    const handleConfirmAdd = () => {
        if (addValue > 0) {
            onActualChange(addValue);
            setAddValue(0);
        }
    };

    return (
        <div className="p-3 bg-black/20 rounded-md relative group">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                    <span className={`${colorClass} mr-3`}>{icon}</span>
                    <span className={`font-semibold ${theme.primaryTextColor}`}>{label}</span>
                </div>
                <div className="flex items-center gap-2">
                     {isOverBudget && <span className="text-xs text-red-400 font-bold animate-pulse">Vượt ngân sách!</span>}
                     {onDetailClick && (
                         <button 
                            onClick={onDetailClick}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition flex items-center gap-1"
                         >
                             <ListIcon /> Xem thêm
                         </button>
                     )}
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                    <label className={`block text-xs ${theme.secondaryTextColor} mb-1`}>Ngân sách (Dự kiến)</label>
                    <CurrencyInput
                        value={budget}
                        onValueChange={onBudgetChange}
                        className="input w-full text-right py-1.5 text-sm"
                    />
                </div>
                <div>
                    <label className={`block text-xs ${theme.secondaryTextColor} mb-1`}>Chi thực tế (Tổng)</label>
                    <div className={`input w-full text-right py-1.5 text-sm ${isOverBudget ? 'border-red-500/50 text-red-200' : 'bg-slate-800/50 cursor-not-allowed'}`}>
                         {actual.toLocaleString('vi-VN')}
                         <span className="text-xs text-slate-500 ml-1">.đ</span>
                    </div>
                </div>
            </div>
            
            {/* Direct Input for Quick Add with Submit Button */}
            <div className="mt-2 flex items-center justify-end gap-2">
                <label className="text-[10px] text-slate-500">Thêm (Hôm nay):</label>
                <div className="w-28">
                        <CurrencyInput
                        value={addValue}
                        onValueChange={setAddValue}
                        placeholder="0"
                        className="bg-slate-900 border-slate-700 py-1 px-2 text-xs text-right rounded w-full"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmAdd();
                        }}
                        />
                </div>
                <button 
                    onClick={handleConfirmAdd}
                    disabled={addValue <= 0}
                    className="bg-slate-700 hover:bg-emerald-600 text-white p-1 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Lưu khoản chi này"
                >
                    <PlusIcon className="w-3 h-3" />
                </button>
            </div>

            <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                <div 
                    className={`h-1.5 rounded-full transition-all duration-500 ${isOverBudget ? 'bg-red-500' : theme.accentColor}`} 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
    // --- Initialization: Load from Storage or Default ---
    const savedData = useMemo(() => loadData(), []);

    const [view, setView] = useState<'dashboard' | 'planning'>('dashboard');
    
    const [gasHistory, setGasHistory] = useState<GasLog[]>(savedData ? savedData.gasHistory : []);
    const [lastWifiPayment, setLastWifiPayment] = useState<Date | null>(savedData ? savedData.lastWifiPayment : null);
    const [debts, setDebts] = useState<Debt[]>(savedData ? savedData.debts : []);
    
    // Time-Travel Data Logs
    const [incomeLogs, setIncomeLogs] = useState<IncomeLog[]>(savedData ? savedData.incomeLogs : []);
    const [foodLogs, setFoodLogs] = useState<FoodLog[]>(savedData ? savedData.foodLogs : []);
    const [miscLogs, setMiscLogs] = useState<ExpenseLog[]>(savedData ? savedData.miscLogs : []);
    
    const [incomeInput, setIncomeInput] = useState<number>(0);
    
    // Savings Buffer State
    const [savingsBalance, setSavingsBalance] = useState<number>(savedData ? savedData.savingsBalance : 0);
    
    // Budget States (Planned)
    const [foodBudget, setFoodBudget] = useState<number>(savedData ? savedData.foodBudget : 315000);
    const [miscBudget, setMiscBudget] = useState<number>(savedData ? savedData.miscBudget : 100000);
    
    const [currentDate] = useState(new Date());
    const initialYear = currentDate.getFullYear();
    const [, initialWeek] = getWeekNumber(currentDate);

    // Global Filter
    const [filter, setFilter] = useState<FilterState>({ type: 'week', year: initialYear, week: initialWeek });
    
    // Debt Filter (Independent)
    const [debtFilterMonth, setDebtFilterMonth] = useState(currentDate.getMonth());
    const [debtFilterYear, setDebtFilterYear] = useState(currentDate.getFullYear());

    const [isFilterModalOpen, setFilterModalOpen] = useState(false);
    const [isDebtModalOpen, setDebtModalOpen] = useState(false);
    const [isSettingsOpen, setSettingsOpen] = useState(false);
    const [editingDebtId, setEditingDebtId] = useState<string | null>(null); 

    const [isDebtHistoryOpen, setDebtHistoryOpen] = useState(false);
    const [isMiscDetailOpen, setMiscDetailOpen] = useState(false); 
    const [isIncomeEditOpen, setIncomeEditOpen] = useState(false);
    const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
    const [editIncomeValue, setEditIncomeValue] = useState<number>(0);
    
    // Manual Entry Modal for Gas/Wifi
    const [manualEntryModal, setManualEntryModal] = useState<{ isOpen: boolean, type: 'gas' | 'wifi' | null }>({ isOpen: false, type: null });
    const [manualDate, setManualDate] = useState<string>(new Date().toISOString().slice(0, 10));

    // New Debt State
    const [debtType, setDebtType] = useState<'standard' | 'shopee'>('standard');
    const [newDebt, setNewDebt] = useState({ 
        name: '', 
        source: '', 
        totalAmount: 0, 
        dueDate: new Date().toISOString().slice(0, 10),
        targetMonth: currentDate.getMonth(),
        targetYear: currentDate.getFullYear()
    });
    
    // Shopee Specific State
    const [shopeeBillMonth, setShopeeBillMonth] = useState(currentDate.getMonth());
    const [shopeeBillYear, setShopeeBillYear] = useState(currentDate.getFullYear());

    // Recurring Debt State
    const [isRecurringDebt, setIsRecurringDebt] = useState(false);
    const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly'>('monthly');
    const [recurringEndDate, setRecurringEndDate] = useState('');

    // New Log State
    const [newMiscLog, setNewMiscLog] = useState({
        name: '',
        amount: 0,
        date: new Date().toISOString().slice(0, 10)
    });

    // Holidays State
    const [holidays, setHolidays] = useState<Holiday[]>([]);

    // --- Persistence Effect ---
    useEffect(() => {
        const dataToSave = {
            gasHistory,
            lastWifiPayment,
            debts,
            incomeLogs,
            foodLogs,
            miscLogs,
            savingsBalance,
            foodBudget,
            miscBudget,
            holidays
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }, [gasHistory, lastWifiPayment, debts, incomeLogs, foodLogs, miscLogs, savingsBalance, foodBudget, miscBudget, holidays]);


    useEffect(() => {
        const upcoming = getUpcomingHolidays();
        
        // Merge loaded holidays (which contain user settings) with fresh upcoming logic
        if (savedData && savedData.holidays) {
            const merged = upcoming.map(freshH => {
                // Find matching holiday in saved data by ID
                const savedH = savedData.holidays.find((s: any) => s.id === freshH.id);
                // If found, keep the user-edited fields (isTakingOff, note, dates if changed)
                // But keep the actual holiday date from the fresh logic (in case logic updated)
                if (savedH) {
                    return { ...freshH, isTakingOff: savedH.isTakingOff, note: savedH.note, startDate: savedH.startDate, endDate: savedH.endDate };
                }
                return freshH;
            });
            setHolidays(merged);
        } else {
            setHolidays(upcoming);
        }
    }, [savedData]);
    
    // Seasonal Theming
    const seasonalTheme = useMemo<SeasonalTheme>(() => {
        const month = currentDate.getMonth();
        const baseTheme = {
            greeting: "Chào mừng trở lại, Lê Quỳnh Anh!",
            background: "bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-900",
            primaryTextColor: "text-slate-100",
            secondaryTextColor: "text-slate-400",
            cardBg: "bg-black/20 backdrop-blur-lg border border-white/10",
            accentColor: "bg-amber-400",
            icon: <TaurusIcon className="text-amber-300"/>,
        };

        if (month === 11 || month === 0 || month === 1) { 
            return {
                ...baseTheme,
                greeting: "Giáng sinh an lành, Lê Quỳnh Anh!",
                decorations: (
                     <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
                        <div className="shooting-star" style={{top: '10%', left: '80%', animationDelay: '1s'}}></div>
                        <div className="shooting-star" style={{top: '50%', left: '20%', animationDelay: '5s'}}></div>
                        <StarIcon className="text-white/20 absolute top-[10%] left-[20%] text-xs animate-pulse" />
                        <StarIcon className="text-white/20 absolute top-[30%] left-[80%] text-sm animate-pulse delay-300" />
                        <StarIcon className="text-white/20 absolute top-[70%] left-[10%] text-xs animate-pulse delay-500" />
                        <StarIcon className="text-white/20 absolute top-[85%] left-[60%] text-base animate-pulse delay-700" />
                        <SnowflakeIcon className="text-white/10 absolute top-1/4 left-10 text-7xl animate-pulse" />
                        <SnowflakeIcon className="text-white/10 absolute bottom-10 right-20 text-5xl animate-pulse delay-1000" />
                    </div>
                )
            };
        }
        return baseTheme;
    }, [currentDate]);

    // Fixed Expenses
    const GAS_COST = 70000;
    const WIFI_COST = 30000;
    const FIXED_EXPENSES = GAS_COST + WIFI_COST;

    // Helper to calculate totals based on filter
    const getFilteredTotal = (logs: { date: Date; amount: number }[]) => {
        return logs
            .filter(log => isDateInFilter(new Date(log.date), filter))
            .reduce((sum, log) => sum + log.amount, 0);
    };

    // Calculate Filtered Actuals
    const filteredIncome = getFilteredTotal(incomeLogs);
    const filteredFoodSpending = getFilteredTotal(foodLogs);
    const filteredMiscSpending = getFilteredTotal(miscLogs);

    // Derived State and Calculations
    const lastGasFill = gasHistory.length > 0 ? gasHistory[gasHistory.length - 1] : null;
    
    const isGasFilledToday = useMemo(() => {
        if (!lastGasFill) return false;
        const today = new Date();
        return lastGasFill.date.getDate() === today.getDate() &&
               lastGasFill.date.getMonth() === today.getMonth() &&
               lastGasFill.date.getFullYear() === today.getFullYear();
    }, [lastGasFill]);

    const gasDurationComparison = useMemo(() => {
        if (gasHistory.length < 2) return null;
        const last = gasHistory[gasHistory.length - 1];
        const secondLast = gasHistory[gasHistory.length - 2];
        const lastDuration = daysBetween(secondLast.date, last.date);
        return {
            lastDuration,
            isShorter: lastDuration < 5, 
        };
    }, [gasHistory]);
    
    const isWifiPaidRecently = useMemo(() => {
        if (!lastWifiPayment) return false;
        const daysSince = daysBetween(lastWifiPayment, new Date());
        return daysSince < 7;
    }, [lastWifiPayment]);

    const wifiWarning = useMemo(() => {
        if (!lastWifiPayment) return false;
        const daysSincePayment = daysBetween(lastWifiPayment, new Date());
        return daysSincePayment >= 6;
    }, [lastWifiPayment]);
    
    // Calculate active vs completed debts
    const { activeDebts, completedDebts } = useMemo(() => {
        return debts.reduce((acc, debt) => {
            if (debt.amountPaid >= debt.totalAmount) {
                acc.completedDebts.push(debt);
            } else {
                acc.activeDebts.push(debt);
            }
            return acc;
        }, { activeDebts: [] as Debt[], completedDebts: [] as Debt[] });
    }, [debts]);

    // Filter active debts for display based on the Debt Card filter
    const displayDebts = useMemo(() => {
        return activeDebts.filter(debt => {
            const filterM = debt.targetMonth !== undefined ? debt.targetMonth : debt.dueDate.getMonth();
            const filterY = debt.targetYear !== undefined ? debt.targetYear : debt.dueDate.getFullYear();
            return filterM === debtFilterMonth && filterY === debtFilterYear;
        }).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    }, [activeDebts, debtFilterMonth, debtFilterYear]);

    const weeklyDebtContribution = useMemo(() => {
        return activeDebts.reduce((total, debt) => {
            const remainingAmount = debt.totalAmount - debt.amountPaid;
            if (remainingAmount <= 0) return total;

            const weeksLeft = Math.ceil(daysBetween(new Date(), debt.dueDate) / 7);
            if (weeksLeft <= 0) return total + remainingAmount; 

            return total + (remainingAmount / weeksLeft);
        }, 0);
    }, [activeDebts]);

    // Calculate Actual Debt Payment for the filtered period (Replaces estimated contribution in Actual Spending)
    const filteredActualDebtPaid = useMemo(() => {
        let total = 0;
        // Check all debts (active and completed) to sum up their transaction logs
        [...activeDebts, ...completedDebts].forEach(debt => {
            if (debt.transactions) {
                debt.transactions.forEach(t => {
                    if (t.type === 'payment' && isDateInFilter(new Date(t.date), filter)) {
                        total += t.amount;
                    }
                });
            }
        });
        return total;
    }, [activeDebts, completedDebts, filter]);

    // Calculate Totals
    const totalPlannedSpending = FIXED_EXPENSES + foodBudget + miscBudget + weeklyDebtContribution;
    const totalActualSpending = FIXED_EXPENSES + filteredFoodSpending + filteredMiscSpending + filteredActualDebtPaid;
    
    const financialStatus = filteredIncome - totalActualSpending;
    
    // Disposable Income for smart debt suggestions
    const disposableIncomeForDebts = filteredIncome - (FIXED_EXPENSES + filteredFoodSpending + filteredMiscSpending);

    const daysOffCanTake = useMemo(() => {
        const totalDebtRemaining = activeDebts.reduce((sum, d) => sum + (d.totalAmount - d.amountPaid), 0);
        if (totalDebtRemaining <= 0) return Infinity; 
        const dailySpending = totalActualSpending / 7;
        if(dailySpending <= 0) return Infinity;
        const surplus = filteredIncome > totalActualSpending ? filteredIncome - totalActualSpending : 0;
        
        if (surplus <= 0) return 0;
        return Math.floor(surplus / dailySpending);
    }, [activeDebts, filteredIncome, totalActualSpending]);

    // Handlers
    const handleToggleGas = () => {
        if (isGasFilledToday) {
             setGasHistory(prev => {
                 const today = new Date();
                 return prev.filter(log => 
                    log.date.getDate() !== today.getDate() ||
                    log.date.getMonth() !== today.getMonth() ||
                    log.date.getFullYear() !== today.getFullYear()
                 );
             });
        } else {
             setGasHistory(prev => [...prev, { id: Date.now().toString(), date: new Date() }]);
        }
    };
    
    const handleToggleWifi = () => {
        if (isWifiPaidRecently) {
             setLastWifiPayment(null);
        } else {
             setLastWifiPayment(new Date());
        }
    };

    const handleOpenManualEntry = (type: 'gas' | 'wifi') => {
        setManualEntryModal({ isOpen: true, type });
        setManualDate(new Date().toISOString().slice(0, 10));
    };

    const handleSaveManualEntry = () => {
        const date = new Date(manualDate);
        if (manualEntryModal.type === 'gas') {
            setGasHistory(prev => [...prev, { id: Date.now().toString(), date: date }].sort((a, b) => a.date.getTime() - b.date.getTime()));
        } else if (manualEntryModal.type === 'wifi') {
            setLastWifiPayment(date);
        }
        setManualEntryModal({ isOpen: false, type: null });
    };
    
    const handleUpdateIncome = () => {
        setIncomeLogs(prev => [...prev, {
            id: Date.now().toString(),
            amount: incomeInput,
            date: new Date()
        }]);
        setIncomeInput(0); 
    };

    const handleEditIncomeStart = (id: string, currentVal: number) => {
        setEditingIncomeId(id);
        setEditIncomeValue(currentVal);
        setIncomeEditOpen(true);
    };

    const handleEditIncomeSave = () => {
        if (!editingIncomeId) return;
        setIncomeLogs(prev => prev.map(log => 
            log.id === editingIncomeId ? { ...log, amount: editIncomeValue } : log
        ));
        setIncomeEditOpen(false);
        setEditingIncomeId(null);
    };

    const handleSavingsDeposit = () => {
        if (financialStatus <= 0) return;
        const amountToSave = financialStatus; 
        // Just add to savings balance. We don't remove from income logs because it was earned.
        // But conceptually, "Status" resets? No, user just moves surplus.
        setSavingsBalance(prev => prev + amountToSave);
        alert(`Đã chuyển ${amountToSave.toLocaleString('vi-VN')}đ vào quỹ dự phòng.`);
    };

    const handleSavingsWithdraw = (amount: number) => {
        if (amount <= 0 || amount > savingsBalance) return;
        
        // Add to current income logs
        setIncomeLogs(prev => [...prev, {
            id: Date.now().toString(),
            amount: amount,
            date: new Date(),
            isSavingsWithdrawal: true
        }]);
        
        setSavingsBalance(prev => prev - amount);
    };

    const handleFoodChange = (amount: number) => {
        if (amount <= 0) return;
        setFoodLogs(prev => [...prev, {
            id: Date.now().toString(),
            amount: amount,
            date: new Date()
        }]);
    };

    const handleMiscChange = (amount: number) => {
        if (amount <= 0) return;
        const log: ExpenseLog = {
            id: Date.now().toString(),
            name: 'Chi tiêu nhanh',
            amount: amount,
            date: new Date()
        };
        setMiscLogs(prev => [...prev, log]);
    };

    // Handle saving (adding or updating) a debt
    const handleSaveDebt = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingDebtId) {
            setDebts(prev => prev.map(d => {
                if (d.id === editingDebtId) {
                    return {
                        ...d,
                        name: newDebt.name,
                        source: newDebt.source,
                        totalAmount: newDebt.totalAmount,
                        dueDate: new Date(newDebt.dueDate),
                        targetMonth: newDebt.targetMonth,
                        targetYear: newDebt.targetYear
                    };
                }
                return d;
            }));
            setEditingDebtId(null);
        } else {
            const debtsToAdd: Debt[] = [];

            if (debtType === 'shopee') {
                const billMonth = shopeeBillMonth;
                const billYear = shopeeBillYear;
                let dueMonth = billMonth + 1;
                let dueYear = billYear;
                
                if (dueMonth > 11) {
                    dueMonth = 0;
                    dueYear = dueYear + 1;
                }
                
                const dueDate = new Date(dueYear, dueMonth, 10);
                
                debtsToAdd.push({
                    id: Date.now().toString(),
                    name: `SPayLater - Hóa đơn T${billMonth + 1}`,
                    source: 'Shopee SPayLater',
                    totalAmount: newDebt.totalAmount,
                    amountPaid: 0,
                    dueDate: dueDate,
                    createdAt: new Date(),
                    targetMonth: billMonth,
                    targetYear: billYear,
                    transactions: []
                });

            } else if (isRecurringDebt) {
                if (!newDebt.dueDate || !recurringEndDate) {
                    alert("Vui lòng chọn ngày bắt đầu và ngày kết thúc!");
                    return;
                }

                const startDate = new Date(newDebt.dueDate);
                const endDate = new Date(recurringEndDate);
                let currentDate = new Date(startDate);
                let count = 1;

                while (currentDate <= endDate) {
                     const dueDate = new Date(currentDate);
                     const month = dueDate.getMonth();
                     const year = dueDate.getFullYear();

                     let debtNameSuffix = '';
                     if (recurringFrequency === 'monthly') {
                         debtNameSuffix = `(Tháng ${month + 1}/${year})`;
                     } else {
                         debtNameSuffix = `(Kỳ ${count})`;
                     }

                     debtsToAdd.push({
                        id: `${Date.now()}-${count}`,
                        name: `${newDebt.name} ${debtNameSuffix}`,
                        source: newDebt.source,
                        totalAmount: newDebt.totalAmount,
                        amountPaid: 0,
                        dueDate: dueDate,
                        createdAt: new Date(),
                        targetMonth: month,
                        targetYear: year,
                        transactions: []
                    });

                    if (recurringFrequency === 'weekly') {
                        currentDate.setDate(currentDate.getDate() + 7);
                    } else {
                        currentDate.setMonth(currentDate.getMonth() + 1);
                    }
                    count++;
                }

            } else {
                debtsToAdd.push({
                    id: Date.now().toString(),
                    name: newDebt.name,
                    source: newDebt.source,
                    totalAmount: newDebt.totalAmount,
                    amountPaid: 0,
                    dueDate: new Date(newDebt.dueDate),
                    createdAt: new Date(),
                    targetMonth: newDebt.targetMonth,
                    targetYear: newDebt.targetYear,
                    transactions: []
                });
            }

            setDebts(prev => [...prev, ...debtsToAdd]);
        }
        
        setNewDebt({ 
            name: '', 
            source: '', 
            totalAmount: 0, 
            dueDate: new Date().toISOString().slice(0, 10),
            targetMonth: currentDate.getMonth(),
            targetYear: currentDate.getFullYear()
        });
        setIsRecurringDebt(false);
        setRecurringEndDate('');
        setDebtModalOpen(false);
        setEditingDebtId(null);
        setDebtType('standard');
    };
    
    const handleEditDebt = (debt: Debt) => {
        setNewDebt({
            name: debt.name.replace(/\(Tháng \d+\/\d+\)|\(Kỳ \d+\)/, '').trim(),
            source: debt.source,
            totalAmount: debt.totalAmount,
            dueDate: debt.dueDate.toISOString().slice(0, 10),
            targetMonth: debt.targetMonth ?? debt.dueDate.getMonth(),
            targetYear: debt.targetYear ?? debt.dueDate.getFullYear()
        });
        setIsRecurringDebt(false);
        setDebtType('standard'); 
        setEditingDebtId(debt.id);
        setDebtModalOpen(true);
    };

    const handleDeleteDebt = (id: string) => {
        if (window.confirm("Bạn có chắc chắn muốn xóa khoản nợ này không?")) {
            setDebts(prev => prev.filter(d => d.id !== id));
            setDebtModalOpen(false);
            setEditingDebtId(null);
        }
    };
    
    const handleAddPayment = (id: string, amount: number, date: Date) => {
        setDebts(prev => prev.map(d => {
            if (d.id === id) {
                const newTransaction: DebtTransaction = {
                    id: Date.now().toString(),
                    date: date,
                    amount: amount,
                    type: 'payment'
                };
                return {
                    ...d,
                    amountPaid: d.amountPaid + amount,
                    transactions: [...(d.transactions || []), newTransaction]
                };
            }
            return d;
        }));
    };

    const handleWithdrawPayment = (id: string, amount: number, reason: string) => {
        setDebts(prev => prev.map(d => {
            if (d.id === id) {
                const newTransaction: DebtTransaction = {
                    id: Date.now().toString(),
                    date: new Date(),
                    amount: amount, 
                    type: 'withdrawal',
                    reason: reason
                };
                return {
                    ...d,
                    amountPaid: Math.max(0, d.amountPaid - amount),
                    transactions: [...(d.transactions || []), newTransaction]
                };
            }
            return d;
        }));
    };
    
    const handleAddMiscLog = (e: React.FormEvent) => {
        e.preventDefault();
        const log: ExpenseLog = {
            id: Date.now().toString(),
            name: newMiscLog.name,
            amount: newMiscLog.amount,
            date: new Date(newMiscLog.date)
        };
        setMiscLogs(prev => [...prev, log]);
        setNewMiscLog({ name: '', amount: 0, date: new Date().toISOString().slice(0, 10) });
    };
    
    const handleDeleteMiscLog = (id: string, amount: number) => {
        setMiscLogs(prev => prev.filter(log => log.id !== id));
    };

    const handleSaveHoliday = (id: string, data: Partial<Holiday>) => {
        setHolidays(prev => prev.map(h => h.id === id ? { ...h, ...data } : h));
    };

    // --- Data Sync / Export / Import ---

    const handleExportData = () => {
        const dataToSave = {
            gasHistory,
            lastWifiPayment,
            debts,
            incomeLogs,
            foodLogs,
            miscLogs,
            savingsBalance,
            foodBudget,
            miscBudget,
            holidays
        };
        const json = JSON.stringify(dataToSave, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_chi_tieu_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = event.target?.result as string;
                const parsed = JSON.parse(json);
                const hydrated = parseSavedData(parsed);
                
                if (hydrated) {
                    if(window.confirm("Hành động này sẽ ghi đè dữ liệu hiện tại bằng dữ liệu từ file backup. Bạn có chắc chắn không?")) {
                        setGasHistory(hydrated.gasHistory || []);
                        setLastWifiPayment(hydrated.lastWifiPayment || null);
                        setDebts(hydrated.debts || []);
                        setIncomeLogs(hydrated.incomeLogs || []);
                        setFoodLogs(hydrated.foodLogs || []);
                        setMiscLogs(hydrated.miscLogs || []);
                        setSavingsBalance(hydrated.savingsBalance || 0);
                        setFoodBudget(hydrated.foodBudget || 315000);
                        setMiscBudget(hydrated.miscBudget || 100000);
                        setHolidays(hydrated.holidays || []);
                        
                        alert("Đã khôi phục dữ liệu thành công!");
                        setSettingsOpen(false);
                    }
                }
            } catch (err) {
                alert("File không hợp lệ hoặc bị lỗi!");
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    const filteredGasHistory = useMemo(() => gasHistory.filter(g => isDateInFilter(g.date, filter)), [gasHistory, filter]);
    
    const getFilterDisplay = () => {
        switch (filter.type) {
            case 'week':
                const { start, end } = getWeekRange(filter.year, filter.week!);
                return `Tuần ${filter.week} (${formatDate(start)} - ${formatDate(end)})`;
            case 'month':
                return `${MONTH_NAMES[filter.month!]}, ${filter.year}`;
            case 'year':
                return `Năm ${filter.year}`;
            case 'all':
            default:
                return 'Tất cả';
        }
    };

    const recurringDayDescription = useMemo(() => {
        if (!newDebt.dueDate) return '';
        const date = new Date(newDebt.dueDate);
        if (recurringFrequency === 'monthly') {
            return `ngày ${date.getDate()} hàng tháng`;
        } else {
            const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
            return `${days[date.getDay()]} hàng tuần`;
        }
    }, [newDebt.dueDate, recurringFrequency]);

    const shopeeDueDatePreview = useMemo(() => {
         let dueMonth = shopeeBillMonth + 1;
         let dueYear = shopeeBillYear;
         if (dueMonth > 11) {
             dueMonth = 0;
             dueYear = dueYear + 1;
         }
         return new Date(dueYear, dueMonth, 10);
    }, [shopeeBillMonth, shopeeBillYear]);

    // Holiday Planner Calculations
    const holidayPlanning = useMemo(() => {
        const activeHoliday = holidays.find(h => h.isTakingOff);
        if (!activeHoliday || !activeHoliday.startDate || !activeHoliday.endDate) return null;

        const start = new Date(activeHoliday.startDate);
        const end = new Date(activeHoliday.endDate);
        const daysOff = Math.max(0, daysBetween(start, end) + 1); // Include start date
        const daysUntil = Math.max(0, daysBetween(new Date(), start));
        const weeksUntil = Math.max(1, daysUntil / 7);

        // Estimated Daily Burn
        const dailyFixed = FIXED_EXPENSES / 7;
        const dailyFood = 315000 / 7; // Assume budget, could be actual avg
        const totalDebtRem = activeDebts.reduce((s, d) => s + (d.totalAmount - d.amountPaid), 0);
        
        // A safer assumption: During holiday, you still need to cover fixed costs proportionally + food
        const burnRatePerDay = dailyFixed + dailyFood; 
        const requiredAmount = burnRatePerDay * daysOff;
        
        // Also need to ensure debts falling due DURING the holiday are covered
        const debtDueInHoliday = activeDebts.reduce((sum, d) => {
            if (d.dueDate >= start && d.dueDate <= end) {
                return sum + (d.totalAmount - d.amountPaid);
            }
            return sum;
        }, 0);

        const totalNeeded = requiredAmount + debtDueInHoliday;
        const gap = Math.max(0, totalNeeded - savingsBalance);
        const weeklySavingGoal = gap / weeksUntil;

        return {
            daysOff,
            daysUntil,
            totalNeeded,
            gap,
            weeklySavingGoal,
            debtDueInHoliday
        };

    }, [holidays, activeDebts, savingsBalance, FIXED_EXPENSES]);


    const renderDashboard = () => (
        <>
             {/* Actual Spending Hero Card */}
                <div className="mb-6">
                    <div className={`${seasonalTheme.cardBg} p-6 rounded-xl shadow-lg border border-blue-500/30 flex items-center justify-between relative overflow-hidden`}>
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-500/20 rounded-full blur-xl"></div>
                        <div className="relative z-10">
                             <p className={`text-lg ${seasonalTheme.secondaryTextColor} mb-1`}>Tổng chi tiêu thực tế ({getFilterDisplay()})</p>
                             <p className={`text-5xl font-bold ${seasonalTheme.primaryTextColor} tracking-tight`}>
                                {Math.round(totalActualSpending).toLocaleString('vi-VN')}đ
                             </p>
                             <p className="text-sm text-blue-300 mt-2 flex items-center gap-1">
                                 <PiggyBankIcon /> Đã bao gồm các khoản cố định, ăn uống và nợ đã trả
                             </p>
                        </div>
                        <div className="hidden md:block text-6xl text-blue-500/30">
                            <PiggyBankIcon />
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                     <StatCard icon={<TargetIcon />} title="Thu nhập cần đạt" value={`${Math.round(totalPlannedSpending).toLocaleString('vi-VN')}đ`} color="text-amber-400" theme={seasonalTheme} subtitle="Dựa trên ngân sách" />
                     <StatCard icon={<CreditCardIcon />} title="Góp nợ tuần" value={`${Math.round(weeklyDebtContribution).toLocaleString('vi-VN')}đ`} color="text-pink-400" theme={seasonalTheme} subtitle="Dự kiến cần góp" />
                     <StatCard icon={<MoneyBillIcon />} title="Thu nhập thực tế" value={`${filteredIncome.toLocaleString('vi-VN')}đ`} color="text-emerald-400" theme={seasonalTheme} />
                     <StatCard icon={<ChartLineIcon />} title="Tình trạng tài chính" value={`${financialStatus.toLocaleString('vi-VN')}đ`} color={financialStatus >= 0 ? "text-green-400" : "text-red-400"} subtitle={financialStatus >= 0 ? "Dư giả" : "Thiếu hụt"} theme={seasonalTheme} />
                </div>

                {/* Savings Buffer Section */}
                <div className={`${seasonalTheme.cardBg} p-5 rounded-lg shadow-lg mb-6 border border-emerald-500/20`}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-500/20 p-3 rounded-full">
                                <WalletIcon className="text-emerald-400 text-2xl" />
                            </div>
                            <div>
                                <h3 className={`text-lg font-bold ${seasonalTheme.primaryTextColor}`}>Quỹ dự phòng / Tiền thừa</h3>
                                <p className={`text-2xl font-mono font-bold text-emerald-300`}>{savingsBalance.toLocaleString('vi-VN')}đ</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {financialStatus > 0 && (
                                <button 
                                    onClick={handleSavingsDeposit}
                                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow transition flex items-center gap-1"
                                >
                                    <ArrowRightIcon /> Cất {financialStatus.toLocaleString('vi-VN')}đ vào quỹ
                                </button>
                            )}
                            <button 
                                onClick={() => {
                                    const amount = prompt("Nhập số tiền muốn rút từ quỹ để dùng cho tuần này:");
                                    if(amount) handleSavingsWithdraw(parseInt(amount.replace(/[^0-9]/g, '')));
                                }}
                                disabled={savingsBalance <= 0}
                                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-bold rounded-lg shadow transition disabled:opacity-50"
                            >
                                <ExchangeIcon className="mr-1" /> Dùng quỹ
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-6">
                         <div className={`${seasonalTheme.cardBg} p-5 rounded-lg shadow-lg`}>
                            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                                <h3 className={`text-xl font-bold ${seasonalTheme.primaryTextColor}`}>Chi tiêu & Ngân sách</h3>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-black/20 rounded-md">
                                    <div className="flex items-center">
                                        <GasPumpIcon className="text-red-400 mr-3" />
                                        <div>
                                            <p className={`font-semibold ${seasonalTheme.primaryTextColor}`}>Xăng</p>
                                            <p className={`text-xs ${seasonalTheme.secondaryTextColor}`}>{lastGasFill ? `Đổ gần nhất: ${formatDate(lastGasFill.date)}` : 'Chưa có dữ liệu'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-2">
                                        <p className={`font-bold ${seasonalTheme.primaryTextColor}`}>{GAS_COST.toLocaleString('vi-VN')}đ</p>
                                        <button onClick={() => handleOpenManualEntry('gas')} className="text-slate-500 hover:text-white p-1" title="Thêm lịch sử cũ">
                                            <CalendarPlusIcon />
                                        </button>
                                        <button onClick={handleToggleGas} className={`text-2xl transition-all transform active:scale-90 focus:outline-none ${isGasFilledToday ? 'text-green-400' : 'text-gray-600 hover:text-gray-400'}`} title={isGasFilledToday ? "Bỏ đánh dấu" : "Đánh dấu đã đổ"}>
                                            {isGasFilledToday ? <CheckCircleIcon /> : <CircleIcon />}
                                        </button>
                                    </div>
                                </div>
                                {gasDurationComparison && (
                                     <div className={`p-2 rounded-md text-sm ${gasDurationComparison.isShorter ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                                        <WarningIcon className="inline mr-1" />
                                        Đợt gần nhất kéo dài {gasDurationComparison.lastDuration} ngày. {gasDurationComparison.isShorter ? 'Ngắn hơn bình thường!' : 'Tốt!'}
                                     </div>
                                )}

                                <div className="flex items-center justify-between p-3 bg-black/20 rounded-md">
                                    <div className="flex items-center">
                                        <WifiIcon className="text-blue-400 mr-3" />
                                        <div>
                                            <p className={`font-semibold ${seasonalTheme.primaryTextColor}`}>Wifi</p>
                                             <p className={`text-xs ${seasonalTheme.secondaryTextColor}`}>{lastWifiPayment ? `Hết hạn: ${formatDate(new Date(lastWifiPayment.getTime() + 7 * 24 * 60 * 60 * 1000))}` : 'Chưa nạp'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-2">
                                        <p className={`font-bold ${seasonalTheme.primaryTextColor}`}>{WIFI_COST.toLocaleString('vi-VN')}đ</p>
                                        <button onClick={() => handleOpenManualEntry('wifi')} className="text-slate-500 hover:text-white p-1" title="Cập nhật ngày nạp cũ">
                                            <CalendarPlusIcon />
                                        </button>
                                        <button onClick={handleToggleWifi} className={`text-2xl transition-all transform active:scale-90 focus:outline-none ${isWifiPaidRecently ? 'text-green-400' : 'text-gray-600 hover:text-gray-400'}`} title={isWifiPaidRecently ? "Bỏ đánh dấu" : "Đánh dấu đã nạp"}>
                                            {isWifiPaidRecently ? <CheckCircleIcon /> : <CircleIcon />}
                                        </button>
                                    </div>
                                </div>
                                {wifiWarning && (
                                    <div className="p-2 rounded-md text-sm bg-yellow-500/20 text-yellow-300">
                                        <WarningIcon className="inline mr-1" />
                                        Sắp hết hạn Wifi, hãy nạp thêm!
                                    </div>
                                )}

                                <BudgetRow 
                                    icon={<FoodIcon />}
                                    label="Ăn uống"
                                    budget={foodBudget}
                                    actual={filteredFoodSpending}
                                    onBudgetChange={setFoodBudget}
                                    onActualChange={handleFoodChange}
                                    theme={seasonalTheme}
                                    colorClass="text-orange-400"
                                />

                                <BudgetRow 
                                    icon={<BoltIcon />}
                                    label="Phát sinh"
                                    budget={miscBudget}
                                    actual={filteredMiscSpending}
                                    onBudgetChange={setMiscBudget}
                                    onActualChange={handleMiscChange}
                                    theme={seasonalTheme}
                                    colorClass="text-purple-400"
                                    onDetailClick={() => setMiscDetailOpen(true)}
                                />
                            </div>
                        </div>

                         <div className={`${seasonalTheme.cardBg} p-5 rounded-lg shadow-lg`}>
                             <h3 className={`text-xl font-bold mb-4 ${seasonalTheme.primaryTextColor}`}>Cập nhật thu nhập (Hôm nay)</h3>
                             <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <CurrencyInput 
                                        value={incomeInput}
                                        onValueChange={setIncomeInput}
                                        className="w-full input"
                                        placeholder="0"
                                    />
                                </div>
                                <button 
                                    onClick={handleUpdateIncome}
                                    className={`px-4 py-2.5 rounded-md font-semibold ${seasonalTheme.accentColor} hover:opacity-90 transition text-slate-900 flex items-center gap-2`}
                                >
                                    <SaveIcon /> Cập nhật
                                </button>
                             </div>

                             {/* Income Logs with Edit */}
                             <div className="mt-4 max-h-40 overflow-y-auto pr-1 space-y-2">
                                {incomeLogs
                                    .filter(l => isDateInFilter(new Date(l.date), filter))
                                    .slice().reverse().map(log => (
                                        <div key={log.id} className="flex justify-between items-center p-2 bg-slate-800/50 rounded border border-slate-700 text-sm">
                                            <span className="text-slate-400">{formatDateTime(new Date(log.date))}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={log.isSavingsWithdrawal ? 'text-emerald-400 italic' : 'text-white font-bold'}>
                                                    {log.isSavingsWithdrawal ? '(Từ quỹ) ' : ''}
                                                    {log.amount.toLocaleString('vi-VN')}đ
                                                </span>
                                                {!log.isSavingsWithdrawal && (
                                                    <button onClick={() => handleEditIncomeStart(log.id, log.amount)} className="text-slate-500 hover:text-amber-400">
                                                        <EditIcon className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                ))}
                             </div>

                             {financialStatus < 0 && (
                                <div className="mt-4 p-4 rounded-lg bg-red-900/40 border border-red-500/30 flex items-center gap-4">
                                    <img src={sadDogImageBase64} alt="Chó buồn" className="w-24 h-24 object-contain rounded-lg flex-shrink-0" />
                                    <div className="text-red-200">
                                        <p className="font-semibold text-base">"Sao... ngân sách của em lại âm?"</p>
                                        <p className="mt-2 text-sm">Bạn đang thiếu hụt <strong>{Math.abs(financialStatus).toLocaleString('vi-VN')}đ</strong>.</p>
                                        <p className="mt-1 text-xs">Để "dỗ" lại ví tiền, bạn cần làm thêm khoảng <strong>{Math.ceil(Math.abs(financialStatus) / 100000)} ca</strong> (5h/ca).</p>
                                    </div>
                                </div>
                             )}
                              {financialStatus >= 0 && filteredIncome > 0 && (
                                <div className="mt-3 p-3 rounded-md text-sm bg-green-500/20 text-green-300">
                                    <p><CheckIcon className="inline mr-1" />Bạn đang làm rất tốt!</p>
                                    <p className="mt-1">Với thu nhập hiện tại, bạn có thể nghỉ ngơi tối đa <strong>{daysOffCanTake === Infinity ? 'vô hạn' : daysOffCanTake} ngày</strong> mà vẫn đảm bảo tài chính.</p>
                                </div>
                             )}
                         </div>

                         <div className={`${seasonalTheme.cardBg} p-5 rounded-lg shadow-lg`}>
                            <h3 className={`text-xl font-bold mb-4 ${seasonalTheme.primaryTextColor}`}>Lịch sử đổ xăng</h3>
                            <div className="max-h-60 overflow-y-auto pr-2">
                               {filteredGasHistory.length > 0 ? (
                                    [...filteredGasHistory].reverse().map(log => (
                                        <div key={log.id} className={`text-sm ${seasonalTheme.secondaryTextColor} p-2 bg-black/20 rounded mb-2`}>
                                            {formatDateTime(log.date)}
                                        </div>
                                    ))
                                ) : (
                                    <p className={`text-sm ${seasonalTheme.secondaryTextColor}`}>Không có dữ liệu nào khớp với bộ lọc của bạn.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                         <div className={`${seasonalTheme.cardBg} p-5 rounded-lg shadow-lg`}>
                            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-4">
                               <div className="flex items-center gap-2">
                                   <h3 className={`text-xl font-bold ${seasonalTheme.primaryTextColor}`}>Nợ cần trả</h3>
                                   <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1 border border-slate-700">
                                       <select 
                                            value={debtFilterMonth} 
                                            onChange={(e) => setDebtFilterMonth(parseInt(e.target.value))}
                                            className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
                                       >
                                           {MONTH_NAMES.map((m, idx) => <option key={idx} value={idx} className="bg-slate-900">{m}</option>)}
                                       </select>
                                       <input 
                                            type="number" 
                                            value={debtFilterYear}
                                            onChange={(e) => setDebtFilterYear(parseInt(e.target.value))}
                                            className="bg-transparent text-sm font-semibold text-white w-16 focus:outline-none"
                                       />
                                   </div>
                               </div>
                               <div className="flex gap-2">
                                   <button onClick={() => setDebtHistoryOpen(true)} className="px-3 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg shadow-md transition flex items-center gap-1">
                                       <HistoryIcon /> Lịch sử đã trả
                                   </button>
                                   <button onClick={() => {
                                       setNewDebt({ 
                                            name: '', 
                                            source: '', 
                                            totalAmount: 0, 
                                            dueDate: new Date().toISOString().slice(0, 10),
                                            targetMonth: debtFilterMonth,
                                            targetYear: debtFilterYear
                                        });
                                        setEditingDebtId(null);
                                        setIsRecurringDebt(false);
                                        setDebtModalOpen(true);
                                   }} className={`px-4 py-2 text-sm font-semibold text-slate-900 rounded-lg shadow-md hover:opacity-80 transition ${seasonalTheme.accentColor}`}>
                                       <PlusIcon className="inline mr-1"/> Thêm khoản nợ
                                   </button>
                               </div>
                            </div>
                            <div className="max-h-[70vh] overflow-y-auto pr-2">
                                {displayDebts.length > 0 ? (
                                    displayDebts.map(debt => (
                                        <DebtItem 
                                            key={debt.id} 
                                            debt={debt} 
                                            onAddPayment={handleAddPayment}
                                            onWithdrawPayment={handleWithdrawPayment}
                                            onEdit={handleEditDebt} 
                                            theme={seasonalTheme} 
                                            disposableIncome={disposableIncomeForDebts}
                                        />
                                    ))
                                ) : (
                                    <div className={`text-center ${seasonalTheme.secondaryTextColor} py-8 border-2 border-dashed border-slate-700 rounded-xl`}>
                                        <p>Không có khoản nợ nào được tính vào tháng này.</p>
                                        <p className="text-xs mt-1">Hãy kiểm tra "Lịch sử đã trả" hoặc thêm khoản nợ mới cho tháng này.</p>
                                    </div>
                                )}
                            </div>
                         </div>
                    </div>
                </div>
    </>
    );

    const renderPlanning = () => {
        const totalDebt = debts.reduce((sum, d) => sum + d.totalAmount, 0);
        const totalPaid = debts.reduce((sum, d) => sum + d.amountPaid, 0);
        const totalRemaining = totalDebt - totalPaid;

        return (
            <div className="space-y-6 animate-fade-in-up">
                {/* Debt Overview Section */}
                <div className={`${seasonalTheme.cardBg} p-6 rounded-xl shadow-lg`}>
                    <h3 className={`text-2xl font-bold ${seasonalTheme.primaryTextColor} mb-6 flex items-center gap-2`}>
                        <ChartLineIcon className="text-purple-400" /> Tổng quan Nợ
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                            <p className="text-slate-400 text-sm">Tổng nợ đã vay</p>
                            <p className="text-2xl font-bold text-white">{totalDebt.toLocaleString('vi-VN')}đ</p>
                         </div>
                         <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                            <p className="text-slate-400 text-sm">Đã thanh toán</p>
                            <p className="text-2xl font-bold text-green-400">{totalPaid.toLocaleString('vi-VN')}đ</p>
                         </div>
                         <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                            <p className="text-slate-400 text-sm">Còn lại phải trả</p>
                            <p className="text-2xl font-bold text-red-400">{totalRemaining.toLocaleString('vi-VN')}đ</p>
                         </div>
                    </div>
                    <div className="mt-6">
                         <h4 className="font-bold text-slate-300 mb-3">Danh sách tất cả khoản nợ</h4>
                         <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
                             {debts.map(d => (
                                 <div key={d.id} className="flex justify-between p-3 bg-black/20 rounded border border-white/5 items-center">
                                     <div>
                                         <p className="font-semibold text-white">{d.name}</p>
                                         <p className="text-xs text-slate-500">Hạn: {formatDate(d.dueDate)}</p>
                                     </div>
                                     <div className="text-right">
                                         <p className="font-bold text-slate-200">{(d.totalAmount - d.amountPaid).toLocaleString('vi-VN')}đ</p>
                                         <div className="w-24 bg-slate-700 h-1.5 rounded-full mt-1 ml-auto">
                                             <div className="bg-green-500 h-1.5 rounded-full" style={{width: `${(d.amountPaid/d.totalAmount)*100}%`}}></div>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                    </div>
                </div>

                {/* Holiday Planner Section */}
                <div className={`${seasonalTheme.cardBg} p-6 rounded-xl shadow-lg border-t-4 border-amber-500`}>
                    <h3 className={`text-2xl font-bold ${seasonalTheme.primaryTextColor} mb-6 flex items-center gap-2`}>
                        <PlaneIcon className="text-amber-400" /> Kế hoạch Nghỉ Lễ & Tài chính
                    </h3>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-bold text-slate-300 mb-4">Sắp tới:</h4>
                            <div className="space-y-4">
                                {holidays.map(holiday => (
                                    <div key={holiday.id} className="bg-slate-800/60 p-4 rounded-lg border border-slate-600">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h5 className="text-lg font-bold text-white">{holiday.name}</h5>
                                                <p className="text-amber-400 font-medium"><SunIcon className="mr-1"/>{formatDate(holiday.date)}</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={holiday.isTakingOff} 
                                                    onChange={(e) => handleSaveHoliday(holiday.id, { isTakingOff: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                                <span className="ml-2 text-sm font-medium text-slate-300">Sẽ nghỉ</span>
                                            </label>
                                        </div>

                                        {holiday.isTakingOff && (
                                            <div className="space-y-3 animate-fade-in-up bg-black/20 p-3 rounded">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-1">Bắt đầu nghỉ từ</label>
                                                        <input 
                                                            type="date" 
                                                            className="input w-full text-sm py-1"
                                                            value={holiday.startDate}
                                                            onChange={(e) => handleSaveHoliday(holiday.id, { startDate: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-1">Đến hết ngày</label>
                                                        <input 
                                                            type="date" 
                                                            className="input w-full text-sm py-1"
                                                            value={holiday.endDate}
                                                            onChange={(e) => handleSaveHoliday(holiday.id, { endDate: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                                <textarea 
                                                    placeholder="Ghi chú kế hoạch (đi đâu, làm gì...)" 
                                                    className="input w-full text-sm h-16"
                                                    value={holiday.note}
                                                    onChange={(e) => handleSaveHoliday(holiday.id, { note: e.target.value })}
                                                ></textarea>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Analysis Column */}
                        <div>
                             <h4 className="font-bold text-slate-300 mb-4">Phân tích tài chính</h4>
                             {holidayPlanning ? (
                                 <div className="bg-indigo-900/30 border border-indigo-500/30 p-5 rounded-lg">
                                     <div className="flex justify-between mb-4">
                                         <span className="text-slate-300">Số ngày nghỉ dự kiến:</span>
                                         <span className="text-white font-bold">{holidayPlanning.daysOff} ngày</span>
                                     </div>
                                     <div className="flex justify-between mb-4">
                                         <span className="text-slate-300">Còn bao lâu nữa:</span>
                                         <span className="text-white font-bold">{holidayPlanning.daysUntil} ngày</span>
                                     </div>
                                     
                                     <div className="h-px bg-white/10 my-4"></div>
                                     
                                     <div className="space-y-2 text-sm mb-4">
                                         <div className="flex justify-between">
                                             <span className="text-slate-400">Chi phí sinh hoạt (Ăn + Cố định):</span>
                                             <span className="text-slate-200">~{(holidayPlanning.totalNeeded - holidayPlanning.debtDueInHoliday).toLocaleString('vi-VN')}đ</span>
                                         </div>
                                         <div className="flex justify-between">
                                             <span className="text-slate-400">Nợ đến hạn trong kỳ nghỉ:</span>
                                             <span className="text-red-300 font-bold">{holidayPlanning.debtDueInHoliday.toLocaleString('vi-VN')}đ</span>
                                         </div>
                                         <div className="flex justify-between pt-2 border-t border-dashed border-white/10">
                                             <span className="font-bold text-white">Tổng cần chuẩn bị:</span>
                                             <span className="font-bold text-amber-400 text-lg">{holidayPlanning.totalNeeded.toLocaleString('vi-VN')}đ</span>
                                         </div>
                                         <div className="flex justify-between">
                                             <span className="text-slate-400">Đã có trong quỹ dự phòng:</span>
                                             <span className="text-emerald-400 font-bold">-{savingsBalance.toLocaleString('vi-VN')}đ</span>
                                         </div>
                                     </div>

                                     <div className={`p-4 rounded-lg mt-4 ${holidayPlanning.gap > 0 ? 'bg-red-500/20 border border-red-500/40' : 'bg-green-500/20 border border-green-500/40'}`}>
                                         {holidayPlanning.gap > 0 ? (
                                             <>
                                                <p className="font-bold text-red-200 mb-1"><WarningIcon/> Cần tích lũy thêm!</p>
                                                <p className="text-sm text-red-100">Bạn cần kiếm thêm tối thiểu <strong className="text-white text-lg">{Math.round(holidayPlanning.weeklySavingGoal).toLocaleString('vi-VN')}đ/tuần</strong> từ giờ đến lúc nghỉ để đảm bảo an toàn.</p>
                                             </>
                                         ) : (
                                             <>
                                                 <p className="font-bold text-green-200 mb-1"><CheckCircleIcon/> An tâm nghỉ lễ!</p>
                                                 <p className="text-sm text-green-100">Quỹ dự phòng hiện tại đủ để bạn chi tiêu và trả nợ trong thời gian nghỉ.</p>
                                             </>
                                         )}
                                     </div>
                                     
                                     {holidayPlanning.daysUntil < 14 && holidayPlanning.gap > 0 && (
                                         <div className="mt-3 p-2 bg-yellow-600/30 text-yellow-200 text-xs rounded flex items-start gap-2">
                                             <WarningIcon className="mt-0.5"/>
                                             <span>Sắp đến ngày nghỉ! Hãy chốt lịch trình và hạn chế chi tiêu ngay từ bây giờ.</span>
                                         </div>
                                     )}
                                 </div>
                             ) : (
                                 <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-black/20 rounded-lg border border-white/5 p-8 text-center">
                                     <PlaneIcon className="text-4xl mb-2 opacity-50"/>
                                     <p>Hãy chọn "Sẽ nghỉ" và nhập ngày bắt đầu/kết thúc để xem phân tích tài chính.</p>
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`min-h-screen ${seasonalTheme.background} ${seasonalTheme.primaryTextColor} font-sans p-4 sm:p-6 lg:p-8 relative z-0`}>
            {seasonalTheme.decorations}
            <div className="max-w-5xl mx-auto relative z-10">
                <Header theme={seasonalTheme} onOpenSettings={() => setSettingsOpen(true)} />
                
                {/* View Switcher */}
                <div className="flex gap-4 mb-6 justify-center">
                    <button 
                        onClick={() => setView('dashboard')}
                        className={`px-6 py-2 rounded-full font-bold transition-all ${view === 'dashboard' ? 'bg-amber-400 text-slate-900 shadow-lg scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                        Tổng quan
                    </button>
                    <button 
                        onClick={() => setView('planning')}
                        className={`px-6 py-2 rounded-full font-bold transition-all ${view === 'planning' ? 'bg-purple-500 text-white shadow-lg scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                        Kế hoạch & Nợ
                    </button>
                </div>

                 {view === 'dashboard' ? (
                    <>
                        <div className="mb-6">
                            <button onClick={() => setFilterModalOpen(true)} className={`${seasonalTheme.cardBg} w-full text-left px-4 py-3 rounded-lg shadow-md flex items-center justify-between hover:bg-black/40 transition-colors`}>
                                <span className={`flex items-center gap-2 font-semibold ${seasonalTheme.primaryTextColor}`}>
                                    <FilterIcon />
                                    Bộ lọc Tổng quan:
                                </span>
                                <span className={`font-medium ${seasonalTheme.primaryTextColor}`}>{getFilterDisplay()}</span>
                            </button>
                        </div>
                        {renderDashboard()}
                    </>
                 ) : (
                     renderPlanning()
                 )}

                <FilterModal 
                    isOpen={isFilterModalOpen} 
                    onClose={() => setFilterModalOpen(false)} 
                    onApply={setFilter}
                    currentFilter={filter}
                />

                {/* Edit Income Modal */}
                {isIncomeEditOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-sm relative animate-fade-in-up">
                            <h3 className="text-lg font-bold text-white mb-4">Chỉnh sửa thu nhập</h3>
                            <div className="mb-4">
                                <CurrencyInput 
                                    value={editIncomeValue}
                                    onValueChange={setEditIncomeValue}
                                    className="input w-full"
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button 
                                    onClick={() => setIncomeEditOpen(false)}
                                    className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                                >
                                    Hủy
                                </button>
                                <button 
                                    onClick={handleEditIncomeSave}
                                    className={`px-3 py-1.5 rounded bg-amber-500 text-slate-900 font-bold hover:bg-amber-400`}
                                >
                                    Lưu
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Manual Entry Modal (Gas/Wifi) */}
                {manualEntryModal.isOpen && (
                     <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-sm relative animate-fade-in-up">
                            <h3 className="text-lg font-bold text-white mb-4">
                                Cập nhật lịch sử {manualEntryModal.type === 'gas' ? 'Đổ xăng' : 'Nạp Wifi'}
                            </h3>
                            <div className="mb-4">
                                <label className="block text-sm text-slate-400 mb-1">Chọn ngày:</label>
                                <input 
                                    type="date" 
                                    value={manualDate} 
                                    onChange={(e) => setManualDate(e.target.value)}
                                    className="input w-full"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button 
                                    onClick={() => setManualEntryModal({isOpen: false, type: null})}
                                    className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                                >
                                    Hủy
                                </button>
                                <button 
                                    onClick={handleSaveManualEntry}
                                    className={`px-3 py-1.5 rounded bg-amber-500 text-slate-900 font-bold hover:bg-amber-400`}
                                >
                                    Lưu
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Settings / Data Modal */}
                {isSettingsOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-600 rounded-2xl shadow-2xl p-8 w-full max-w-md relative animate-fade-in-up">
                             <h3 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                                <GearIcon className="text-slate-400" /> Cài đặt & Dữ liệu
                            </h3>
                            
                            <div className="space-y-6">
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="bg-blue-500/20 p-2 rounded-full text-blue-400"><CloudArrowDownIcon className="text-xl" /></div>
                                        <div>
                                            <h4 className="font-bold text-white">Xuất dữ liệu (Sao lưu)</h4>
                                            <p className="text-xs text-slate-400">Tải xuống file dữ liệu để lưu trữ hoặc chuyển sang máy khác.</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleExportData}
                                        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition"
                                    >
                                        Tải file Backup
                                    </button>
                                </div>

                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="bg-amber-500/20 p-2 rounded-full text-amber-400"><CloudArrowUpIcon className="text-xl" /></div>
                                        <div>
                                            <h4 className="font-bold text-white">Nhập dữ liệu (Khôi phục)</h4>
                                            <p className="text-xs text-slate-400">Đồng bộ dữ liệu từ file backup. <span className="text-red-400 font-bold">Lưu ý: Dữ liệu hiện tại sẽ bị ghi đè.</span></p>
                                        </div>
                                    </div>
                                    <label className="block w-full">
                                        <span className="sr-only">Chọn file</span>
                                        <input 
                                            type="file" 
                                            accept=".json"
                                            onChange={handleImportData}
                                            className="block w-full text-sm text-slate-400
                                            file:mr-4 file:py-2 file:px-4
                                            file:rounded-lg file:border-0
                                            file:text-sm file:font-semibold
                                            file:bg-amber-500 file:text-slate-900
                                            hover:file:bg-amber-400
                                            cursor-pointer"
                                        />
                                    </label>
                                </div>

                                <div className="bg-black/20 p-3 rounded border border-slate-700/50 text-xs text-slate-500 flex gap-2">
                                    <FileCodeIcon className="mt-0.5" />
                                    <p>Ứng dụng hoạt động offline. Để đồng bộ giữa các thiết bị (Điện thoại/Laptop), hãy "Tải file Backup" từ thiết bị cũ và "Nhập dữ liệu" trên thiết bị mới.</p>
                                </div>
                            </div>

                            <button onClick={() => setSettingsOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                                <CloseIcon />
                            </button>
                        </div>
                    </div>
                )}

                {/* Debt Modal (Add & Edit) */}
                {isDebtModalOpen && (
                     <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-md relative animate-fade-in-up">
                           <form onSubmit={handleSaveDebt}>
                               <h3 className={`text-2xl font-bold mb-4 ${seasonalTheme.primaryTextColor}`}>
                                   {editingDebtId ? "Chỉnh sửa khoản nợ" : "Thêm khoản nợ mới"}
                               </h3>
                               
                               {!editingDebtId && (
                                   <div className="flex border-b border-slate-700 mb-4">
                                       <button 
                                            type="button"
                                            onClick={() => setDebtType('standard')}
                                            className={`flex-1 py-2 text-sm font-semibold transition-colors border-b-2 ${debtType === 'standard' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                                       >
                                           Nợ thông thường
                                       </button>
                                       <button 
                                            type="button"
                                            onClick={() => setDebtType('shopee')}
                                            className={`flex-1 py-2 text-sm font-semibold transition-colors border-b-2 ${debtType === 'shopee' ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                                       >
                                           Shopee SPayLater
                                       </button>
                                   </div>
                               )}

                               {debtType === 'standard' ? (
                                   // STANDARD DEBT FORM
                                   <div className="space-y-4">
                                       <div>
                                           <label className="block text-sm font-medium text-slate-300 mb-1">Tên khoản nợ</label>
                                           <input type="text" value={newDebt.name} onChange={e => setNewDebt({...newDebt, name: e.target.value})} className="w-full input" required />
                                       </div>
                                        <div>
                                           <label className="block text-sm font-medium text-slate-300 mb-1">Nguồn nợ</label>
                                           <input type="text" value={newDebt.source} onChange={e => setNewDebt({...newDebt, source: e.target.value})} className="w-full input" required />
                                       </div>
                                       
                                       {/* Recurring Toggle - Only show when adding new */}
                                       {!editingDebtId && (
                                           <div className="flex items-center gap-2 p-3 rounded bg-slate-800/50 border border-slate-600">
                                                <input 
                                                    type="checkbox" 
                                                    id="recurringDebt" 
                                                    checked={isRecurringDebt} 
                                                    onChange={e => setIsRecurringDebt(e.target.checked)}
                                                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-700 border-slate-500"
                                                />
                                                <label htmlFor="recurringDebt" className="text-sm font-medium text-slate-200 flex items-center gap-2 cursor-pointer select-none">
                                                    <RepeatIcon className="text-amber-400" />
                                                    Khoản nợ lặp lại (Trả góp)
                                                </label>
                                           </div>
                                       )}
                                       
                                       {/* Due Date */}
                                       <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                                {isRecurringDebt ? 'Ngày bắt đầu (Hạn trả kỳ đầu tiên)' : 'Ngày đến hạn trả'}
                                            </label>
                                            <input type="date" value={newDebt.dueDate} onChange={e => setNewDebt({...newDebt, dueDate: e.target.value})} className="w-full input" required />
                                       </div>
    
                                        {isRecurringDebt && (
                                            <div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg space-y-3 animate-fade-in-up">
                                                <div>
                                                    <label className="block text-xs font-bold text-amber-400 uppercase mb-1">Tần suất lặp lại</label>
                                                    <select 
                                                        value={recurringFrequency}
                                                        onChange={(e) => setRecurringFrequency(e.target.value as 'weekly' | 'monthly')}
                                                        className="w-full input"
                                                    >
                                                        <option value="monthly">Mỗi tháng</option>
                                                        <option value="weekly">Mỗi tuần</option>
                                                    </select>
                                                </div>
                                                
                                                <div>
                                                    <label className="block text-xs font-bold text-amber-400 uppercase mb-1">Lặp lại đến ngày</label>
                                                    <input 
                                                        type="date" 
                                                        value={recurringEndDate} 
                                                        onChange={e => setRecurringEndDate(e.target.value)} 
                                                        className="w-full input" 
                                                        required 
                                                    />
                                                </div>
                                                
                                                {newDebt.dueDate && recurringEndDate && (
                                                    <div className="text-xs text-amber-200/70 italic border-t border-amber-500/20 pt-2">
                                                        Sẽ lặp lại vào <strong>{recurringDayDescription}</strong> kể từ ngày bắt đầu đến khi kết thúc vào {formatDate(new Date(recurringEndDate))}.
                                                    </div>
                                                )}
                                            </div>
                                        )}
    
                                        <div>
                                           <label className="block text-sm font-medium text-slate-300 mb-1">
                                               {isRecurringDebt ? 'Số tiền phải trả mỗi kỳ' : 'Tổng số tiền'}
                                           </label>
                                           <CurrencyInput value={newDebt.totalAmount} onValueChange={val => setNewDebt({...newDebt, totalAmount: val})} className="w-full input" required />
                                       </div>
                                       
                                       {!isRecurringDebt && (
                                           <div className="pt-2 border-t border-slate-700 mt-2">
                                                <label className="block text-sm font-medium text-amber-400 mb-2">
                                                    Tính vào ngân sách chi tiêu tháng:
                                                </label>
                                                <div className="flex gap-2">
                                                    <select 
                                                        value={newDebt.targetMonth} 
                                                        onChange={e => setNewDebt({...newDebt, targetMonth: parseInt(e.target.value)})}
                                                        className="flex-1 input py-2 cursor-pointer"
                                                    >
                                                        {MONTH_NAMES.map((m, idx) => <option key={idx} value={idx} className="text-slate-900">{m}</option>)}
                                                    </select>
                                                    <input 
                                                        type="number" 
                                                        value={newDebt.targetYear} 
                                                        onChange={e => setNewDebt({...newDebt, targetYear: parseInt(e.target.value)})}
                                                        className="w-24 input py-2"
                                                        placeholder="Năm"
                                                    />
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1 italic">Nợ sẽ hiển thị khi bạn chọn bộ lọc nợ của tháng này.</p>
                                           </div>
                                       )}
                                   </div>
                               ) : (
                                   // SHOPEE SPAYLATER FORM
                                   <div className="space-y-5 animate-fade-in-up">
                                        <div className="flex items-center gap-3 bg-orange-500/10 p-3 rounded-lg border border-orange-500/30 text-orange-300">
                                            <ShoppingBagIcon className="text-2xl" />
                                            <div>
                                                <p className="font-bold text-sm">Shopee SPayLater</p>
                                                <p className="text-xs opacity-80">Tự động tạo hạn thanh toán ngày 10 tháng sau.</p>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-sm font-medium text-slate-300">Hóa đơn của tháng</label>
                                                <input 
                                                    type="number" 
                                                    value={shopeeBillYear} 
                                                    onChange={e => setShopeeBillYear(parseInt(e.target.value))}
                                                    className="input py-1 px-2 w-20 text-center text-sm"
                                                />
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                {MONTH_NAMES.map((m, idx) => (
                                                    <button
                                                        type="button"
                                                        key={idx}
                                                        onClick={() => setShopeeBillMonth(idx)}
                                                        className={`p-2 rounded text-xs font-semibold transition-all ${shopeeBillMonth === idx ? 'bg-orange-500 text-white ring-2 ring-orange-300' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                                    >
                                                        {m.replace('Tháng ', 'T')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                           <label className="block text-sm font-medium text-slate-300 mb-1">Số tiền cần thanh toán</label>
                                           <CurrencyInput value={newDebt.totalAmount} onValueChange={val => setNewDebt({...newDebt, totalAmount: val})} className="w-full input" required />
                                       </div>

                                       <div className="p-3 bg-slate-800 rounded text-sm text-slate-300">
                                           <p>Hạn thanh toán dự kiến: <span className="text-orange-400 font-bold">{formatDate(shopeeDueDatePreview)}</span></p>
                                           <p className="text-xs mt-1 text-slate-500">Khoản nợ này sẽ được tính vào chi tiêu tháng {shopeeBillMonth + 1}/{shopeeBillYear} (theo yêu cầu).</p>
                                       </div>
                                   </div>
                               )}

                               <div className="mt-6 flex justify-end gap-3">
                                   {editingDebtId && (
                                       <button 
                                            type="button"
                                            onClick={() => handleDeleteDebt(editingDebtId)}
                                            className="px-4 py-2 rounded bg-red-900/50 text-red-400 hover:bg-red-900/80 mr-auto"
                                       >
                                           <TrashIcon /> Xóa
                                       </button>
                                   )}
                                   <button type="button" onClick={() => setDebtModalOpen(false)} className="px-4 py-2 rounded bg-slate-700 text-slate-300 hover:bg-slate-600">Hủy</button>
                                   <button type="submit" className={`px-6 py-2 rounded font-bold text-slate-900 shadow-lg hover:opacity-90 ${seasonalTheme.accentColor}`}>
                                       {editingDebtId ? 'Cập nhật' : 'Thêm'}
                                   </button>
                               </div>
                           </form>
                           <button onClick={() => setDebtModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                               <CloseIcon />
                           </button>
                        </div>
                     </div>
                )}

                {/* Debt History Modal */}
                {isDebtHistoryOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-lg relative animate-fade-in-up">
                             <h3 className="text-2xl font-bold mb-4 text-white flex items-center gap-2">
                                <HistoryIcon className="text-slate-400" /> Lịch sử nợ đã trả
                            </h3>
                             <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3">
                                {completedDebts.length > 0 ? (
                                    completedDebts.map(debt => (
                                        <div key={debt.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 opacity-70 hover:opacity-100 transition">
                                            <div className="flex justify-between">
                                                <h4 className="font-bold text-slate-300 line-through">{debt.name}</h4>
                                                <span className="text-green-400 font-bold text-sm">Đã trả xong</span>
                                            </div>
                                            <p className="text-sm text-slate-500">Nguồn: {debt.source}</p>
                                            <div className="mt-2 flex justify-between text-xs text-slate-400">
                                                <span>Tổng: {debt.totalAmount.toLocaleString('vi-VN')}đ</span>
                                                <span>Hạn: {formatDate(debt.dueDate)}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-slate-500 py-8">Chưa có khoản nợ nào được trả hết.</p>
                                )}
                             </div>
                             <button onClick={() => setDebtHistoryOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                                <CloseIcon />
                            </button>
                        </div>
                    </div>
                )}

                {/* Misc Expenses Detail Modal */}
                {isMiscDetailOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                         <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-lg relative animate-fade-in-up h-[80vh] flex flex-col">
                            <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2 flex-shrink-0">
                                <ListIcon className="text-purple-400" /> Chi tiết khoản chi phát sinh
                            </h3>
                            
                            <div className="flex-1 overflow-y-auto pr-2 mb-4 space-y-2 border-b border-slate-700 pb-4">
                                {miscLogs.length > 0 ? (
                                    miscLogs.slice().reverse().map(log => (
                                        <div key={log.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg group hover:bg-slate-750">
                                            <div>
                                                <p className="font-semibold text-slate-200">{log.name}</p>
                                                <p className="text-xs text-slate-500">{formatDate(log.date)}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-purple-400">{log.amount.toLocaleString('vi-VN')}đ</span>
                                                <button 
                                                    onClick={() => handleDeleteMiscLog(log.id, log.amount)}
                                                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                                                >
                                                    <TrashIcon />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-slate-500 py-8">Chưa có mục chi tiết nào.</p>
                                )}
                            </div>

                            <div className="flex-shrink-0 pt-2">
                                <h4 className="text-sm font-bold text-slate-400 mb-3">Thêm mục mới</h4>
                                <form onSubmit={handleAddMiscLog} className="space-y-3">
                                    <div>
                                        <input 
                                            type="text" 
                                            placeholder="Tên khoản chi (VD: Trà sữa)" 
                                            className="input w-full text-sm"
                                            value={newMiscLog.name}
                                            onChange={e => setNewMiscLog({...newMiscLog, name: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                             <CurrencyInput 
                                                value={newMiscLog.amount} 
                                                onValueChange={val => setNewMiscLog({...newMiscLog, amount: val})}
                                                className="input w-full text-sm"
                                                placeholder="Số tiền"
                                                required
                                            />
                                        </div>
                                        <div className="w-1/3">
                                            <input 
                                                type="date" 
                                                className="input w-full text-sm"
                                                value={newMiscLog.date}
                                                onChange={e => setNewMiscLog({...newMiscLog, date: e.target.value})}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full py-2 rounded bg-purple-600 text-white font-bold hover:bg-purple-500 transition">
                                        <PlusIcon className="mr-1" /> Thêm
                                    </button>
                                </form>
                            </div>

                            <button onClick={() => setMiscDetailOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                                <CloseIcon />
                            </button>
                         </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default App;
