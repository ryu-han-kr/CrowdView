// 찜 목록 공유 (lib/list-share): 이용자가 보낸 목록에서 없는 장소·사이트 밖 주소를 거른다
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanList } from "@/lib/list-share";

test("우리 장소 id만, 중복 없이", () => {
  const r = cleanList({ favorites: ["lotteworld", "lotteworld", "nope", 3], picks: [] });
  assert.deepEqual(r?.favorites, ["lotteworld"]);
});

test("담은 곳은 사이트 안 주소만", () => {
  const r = cleanList({
    picks: [
      { id: "a", label: " 명동 ", href: "/seoul/POI014" },
      { id: "b", label: "밖", href: "https://evil.example" },
      { id: "c", label: "밖2", href: "//evil.example" },
      { id: "d", label: "", href: "/x" },
      { id: "e", label: "스크립트", href: '/x"><script>' },
    ],
  });
  assert.deepEqual(r?.picks, [{ id: "a", label: "명동", href: "/seoul/POI014" }]);
});

test("비어 있으면 null", () => {
  assert.equal(cleanList({ favorites: [], picks: [] }), null);
  assert.equal(cleanList(null), null);
});
