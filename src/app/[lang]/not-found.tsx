"use client";

import { useI18n } from "@/i18n/client";
import Link from "@/i18n/link";
import { Glyph } from "@/components/Glyph";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="flex justify-center text-indigo-400">
        <Glyph e="🧭" className="h-14 w-14" />
      </p>
      <p className="font-semibold">{t("찾을 수 없는 장소예요")}</p>
      <Link href="/" className="rounded-full bg-gray-900 px-4 py-2 text-sm text-white">
        {t("홈으로")}
      </Link>
    </main>
  );
}
