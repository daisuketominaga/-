"use client";

const CATEGORIES = [
  "すべて",
  "才能・成長",
  "人間関係",
  "利他・愛",
  "キャリア・AI",
  "人間の魅力",
  "思考法",
];

interface Props {
  selected: string;
  onSelect: (category: string) => void;
}

export default function CategoryFilter({ selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`category-chip ${selected === cat ? "active" : ""}`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
