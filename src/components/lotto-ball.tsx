type LottoBallProps = {
  className?: string;
  value: number;
};

const ballClassName = (value: number) => {
  if (value <= 10) {
    return "bg-amber-200 text-amber-950 ring-amber-300";
  }

  if (value <= 20) {
    return "bg-sky-200 text-sky-950 ring-sky-300";
  }

  if (value <= 30) {
    return "bg-rose-200 text-rose-950 ring-rose-300";
  }

  if (value <= 40) {
    return "bg-emerald-200 text-emerald-950 ring-emerald-300";
  }

  return "bg-violet-200 text-violet-950 ring-violet-300";
};

export const LottoBall = ({ className = "", value }: LottoBallProps) => {
  return (
    <span
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ring-1 ring-inset transition sm:h-11 sm:w-11 sm:text-base ${ballClassName(value)} ${className}`}
    >
      {value}
    </span>
  );
};
