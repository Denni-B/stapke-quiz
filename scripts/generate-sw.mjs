import fs from "node:fs";
import path from "node:path";

const apiOrigin =
  process.env.NEXT_PUBLIC_API_ORIGIN ?? "https://stapke-quiz.onrender.com";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/stapke-quiz";

const sw = `const API_ORIGIN = "${apiOrigin}";
const BASE_PATH = "${basePath}";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (!url.pathname.startsWith(\`\${BASE_PATH}/api/\`)) {
    return;
  }

  const apiPath = url.pathname.slice(BASE_PATH.length);
  const target = \`\${API_ORIGIN}\${apiPath}\${url.search}\`;

  event.respondWith(
    fetch(target, {
      method: event.request.method,
      headers: event.request.headers,
      body: event.request.method === "GET" || event.request.method === "HEAD"
        ? undefined
        : event.request.body,
      redirect: "follow",
    }),
  );
});
`;

const outputPath = path.join(process.cwd(), "public", "sw.js");
fs.writeFileSync(outputPath, sw, "utf8");
console.log(`Generated ${outputPath} -> ${apiOrigin}`);
