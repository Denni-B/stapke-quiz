import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "out");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/stapke";
const segmentsToKeep = basePath.split("/").filter(Boolean).length;

const spa404 = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Stapke</title>
    <script>
      (function () {
        var segmentsToKeep = ${segmentsToKeep};
        var location = window.location;
        location.replace(
          location.protocol +
            "//" +
            location.hostname +
            (location.port ? ":" + location.port : "") +
            location.pathname
              .split("/")
              .slice(0, 1 + segmentsToKeep)
              .join("/") +
            "/?/" +
            location.pathname
              .slice(1)
              .split("/")
              .slice(segmentsToKeep)
              .join("/")
              .replace(/&/g, "~and~") +
            (location.search ? "&" + location.search.slice(1).replace(/&/g, "~and~") : "") +
            location.hash
        );
      })();
    </script>
  </head>
  <body></body>
</html>
`;

fs.writeFileSync(path.join(outDir, "404.html"), spa404, "utf8");
fs.writeFileSync(path.join(outDir, ".nojekyll"), "", "utf8");
console.log("Prepared GitHub Pages artifacts.");
