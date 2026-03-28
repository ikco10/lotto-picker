const items = [
  "데이터 소스: smok95.github.io/lotto/results/all.json",
  "생성 수: 버튼 클릭마다 5세트",
  "1등 모드: main frequency + 1",
  "2등 모드: main frequency * 0.8 + bonus frequency * 0.2 + 1",
  "제외 규칙: 연속 4개 이상, 홀짝 6:0",
  "저장 위치: localStorage",
];

export default function AboutPage() {
  return (
    <section className="rounded-[28px] bg-white/90 p-5 shadow-sm ring-1 ring-slate-200">
      <ul className="space-y-3 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
