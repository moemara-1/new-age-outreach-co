export type SiteCopy = {
  businessName: string;
  headline: string;
  about: string;
  services: string[];
  cta: string;
  phone?: string;
  address?: string;
  accentColor?: string;
};

export function buildHTML(copy: SiteCopy, template: "restaurant" | "plumber" | "generic"): string {
  const accent = copy.accentColor ?? TEMPLATE_ACCENTS[template];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(copy.businessName)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;line-height:1.6}
.hero{background:${accent};color:#fff;padding:80px 24px;text-align:center}
.hero h1{font-size:2.5rem;font-weight:800;margin-bottom:12px}
.hero p{font-size:1.15rem;opacity:.9;max-width:600px;margin:0 auto 32px}
.btn{display:inline-block;background:#fff;color:${accent};padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem;transition:transform .15s}
.btn:hover{transform:scale(1.04)}
section{max-width:720px;margin:0 auto;padding:64px 24px}
h2{font-size:1.5rem;font-weight:700;margin-bottom:20px}
.about p{color:#444;font-size:1.05rem}
.services ul{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.services li{background:#f5f5f5;border-radius:8px;padding:16px;font-weight:500}
.services li::before{content:"${TEMPLATE_ICONS[template]}";margin-right:8px}
.contact{background:#fafafa;text-align:center;padding:48px 24px}
.contact p{color:#666;margin-bottom:8px}
.contact a{color:${accent};font-weight:600;text-decoration:none}
footer{text-align:center;padding:24px;color:#999;font-size:.85rem}
@media(max-width:600px){.hero h1{font-size:1.8rem}.hero{padding:56px 20px}section{padding:40px 20px}}
</style>
</head>
<body>
<div class="hero">
<h1>${esc(copy.headline)}</h1>
<p>${esc(copy.about.split(".").slice(0, 2).join(".") + ".")}</p>
<a href="#contact" class="btn">${esc(copy.cta)}</a>
</div>
<section class="about">
<h2>About Us</h2>
<p>${esc(copy.about)}</p>
</section>
<section class="services">
<h2>What We Offer</h2>
<ul>
${copy.services.map((s) => `<li>${esc(s)}</li>`).join("\n")}
</ul>
</section>
<div class="contact" id="contact">
<h2>Get In Touch</h2>
${copy.phone ? `<p>Call us: <a href="tel:${esc(copy.phone)}">${esc(copy.phone)}</a></p>` : ""}
${copy.address ? `<p>${esc(copy.address)}</p>` : ""}
<p style="margin-top:20px"><a href="#" class="btn" style="background:${accent};color:#fff">${esc(copy.cta)}</a></p>
</div>
<footer>&copy; ${new Date().getFullYear()} ${esc(copy.businessName)}</footer>
</body>
</html>`;
}

const TEMPLATE_ACCENTS: Record<string, string> = {
  restaurant: "#c0392b",
  plumber: "#2980b9",
  generic: "#2d3436",
};

const TEMPLATE_ICONS: Record<string, string> = {
  restaurant: "🍽️",
  plumber: "🔧",
  generic: "✓",
};

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
