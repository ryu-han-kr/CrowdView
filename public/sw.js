// CrowdView 서비스 워커: Plus 혼잡 알림(웹 푸시) 받기
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "CrowdView", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "CrowdView", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icon-192.png",
      // 알림 막대 작은 아이콘은 안드로이드가 모양(투명도)만 쓴다 → 흰 단색판
      badge: "/badge-96.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url === url && "focus" in c) return c.focus();
      return self.clients.openWindow(url);
    }),
  );
});
