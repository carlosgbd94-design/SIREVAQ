// Empaqueta extension-censia/ para la Chrome Web Store (sin hosts de desarrollo).
// Uso: node build-extension.js  ->  dist-extension/sirevaq-censia-<version>.zip
const fs = require("fs"), path = require("path"), JSZip = require("jszip");
const dir = path.join(__dirname, "extension-censia");
const man = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
man.content_scripts.forEach(cs => { cs.matches = cs.matches.filter(m => !/localhost|127\.0\.0\.1/.test(m)); });
const zip = new JSZip();
zip.file("manifest.json", JSON.stringify(man, null, 2));
["content_sirevaq.js", "content_censia.js"].forEach(f => zip.file(f, fs.readFileSync(path.join(dir, f))));
fs.readdirSync(path.join(dir, "icons")).forEach(f => zip.file("icons/" + f, fs.readFileSync(path.join(dir, "icons", f))));
zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }).then(buf => {
  const out = path.join(__dirname, "dist-extension");
  fs.mkdirSync(out, { recursive: true });
  const f = path.join(out, `sirevaq-censia-${man.version}.zip`);
  fs.writeFileSync(f, buf);
  console.log("OK", f, buf.length, "bytes");
});
