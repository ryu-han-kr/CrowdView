// Tailwind 클래스 합치기 (shadcn/ui 방식): 조건부 클래스(clsx) + 겹치는 Tailwind 클래스는 뒤의 것으로 (tailwind-merge)
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
