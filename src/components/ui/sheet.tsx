"use client";

// shadcn/ui 방식의 창(Dialog) 부품: Radix Dialog 위에 우리 디자인을 입힌 것. 프로젝트 안에 복사해 두고 고쳐 쓴다.
// - 휴대폰: 아래에서 올라오는 시트 / 넓은 화면: 가운데 창
// - Radix가 키보드 포커스 가두기, Esc로 닫기, 바깥 누르면 닫기, 스크린리더용 제목·설명 연결, 뒤 화면 스크롤 잠금을 맡는다
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 w-full rounded-t-3xl bg-white p-5 pb-[max(2rem,env(safe-area-inset-bottom))] text-left text-gray-900 shadow-2xl outline-none",
          "data-[state=open]:animate-[sheet-up_200ms_ease-out]",
          "md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:pb-5 md:data-[state=open]:animate-[fade-in_150ms_ease-out]",
          className,
        )}
        {...props}
      >
        {/* 휴대폰 시트 손잡이 */}
        <div aria-hidden className="mx-auto -mt-1 mb-3 h-1 w-10 rounded-full bg-gray-200 md:hidden" />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-lg font-bold tracking-tight", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("mt-3 text-sm text-gray-600", className)} {...props} />;
}
