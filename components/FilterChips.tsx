'use client';

interface FilterChipsProps {
  selectedAllergens: string[];
  onAllergenToggle: (allergen: string) => void;
  selectedMaxTime: number | null;
  onTimeSelect: (minutes: number | null) => void;
}

const allergenOptions = ['小麦', '卵', '乳'];
const timeOptions = [
  { label: '15分以内', value: 15 },
  { label: '30分以内', value: 30 },
  { label: '60分以内', value: 60 },
];

export default function FilterChips({
  selectedAllergens,
  onAllergenToggle,
  selectedMaxTime,
  onTimeSelect,
}: FilterChipsProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">アレルギー除外</p>
        <div className="flex flex-wrap gap-2">
          {allergenOptions.map((allergen) => {
            const isSelected = selectedAllergens.includes(allergen);
            return (
              <button
                key={allergen}
                onClick={() => onAllergenToggle(allergen)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {allergen}
              </button>
            );
          })}
        </div>
      </div>
      
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">調理時間</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onTimeSelect(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedMaxTime === null
                ? 'bg-primary-green text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            すべて
          </button>
          {timeOptions.map((option) => {
            const isSelected = selectedMaxTime === option.value;
            return (
              <button
                key={option.value}
                onClick={() => onTimeSelect(option.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-primary-green text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

