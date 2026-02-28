"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function Step4Letter({ value, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-sm text-brand-gold font-medium mb-2">Step 4 / 5</p>
        <h2 className="text-2xl font-bold text-brand-navy mb-2">
          家族への手紙
        </h2>
        <p className="text-text-secondary">このステップは任意です</p>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="bg-background-cream rounded-xl p-5 mb-5">
          <p className="text-text-primary leading-relaxed">
            5年後、新しい家で暮らしている家族に一通の手紙を書くとしたら、
            何を伝えたいですか？
          </p>
          <p className="text-text-muted text-sm mt-2">
            どんな暮らしをしていてほしいか、どんな気持ちで過ごしていてほしいか...
            自由にお書きください。
          </p>
        </div>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="5年後の家族へ..."
          rows={10}
          className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 focus:border-brand-navy focus:outline-none resize-none text-base leading-relaxed"
        />

        <p className="text-xs text-text-muted mt-3 text-right">
          {value.length > 0 ? `${value.length}文字` : ""}
        </p>
      </div>
    </div>
  );
}
