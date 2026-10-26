import { SOLAR, type SolarName } from "./solar";

/** Solar 채운 아이콘 한 개. 크기는 className으로 (기본 1em). 색은 currentColor */
export function SolarIcon({ name, className = "h-[1em] w-[1em]", label }: { name: SolarName; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 align-[-0.125em] ${className}`}
      aria-hidden={!label}
      aria-label={label}
      role={label ? "img" : undefined}
      dangerouslySetInnerHTML={{ __html: SOLAR[name] }}
    />
  );
}
