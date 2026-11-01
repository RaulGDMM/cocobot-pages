#!/usr/bin/env python3
"""Build the Local AI Studio page (ES + EN) + catalog.json + llms.txt from catalog-parts.

Source of truth: /root/workspace/cocobot-hermes/catalog-parts/{image,video,audio-llm}[-en].json
Output: this directory (index.html, index-en.html, catalog.json, llms.txt).
"""
import json, re, html, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
CATDIR = Path("/root/workspace/cocobot-hermes/catalog-parts")
SECTIONS = [("image", "Imagen", "Image"), ("video", "Vídeo", "Video"), ("audio-llm", "Audio y LLM", "Audio & LLM")]
GENERATED = "2026-11-01"
YT = [("xaDnAqtJVM8", "Sonda Europa — cortometraje de ciencia ficción", "Sonda Europa — sci-fi short film"),
      ("-xjZmepNbU4", "Perros vs Gatos — el concierto que acaba con la guerra de internet (4K 60fps)",
       "Perros vs Gatos — the concert that ends the internet war (4K 60fps)")]

def load(lang):
    out = []
    for key, name_es, name_en in SECTIONS:
        f = CATDIR / (f"{key}-en.json" if lang == "en" else f"{key}.json")
        if not f.exists():
            f = CATDIR / f"{key}.json"
        d = json.loads(f.read_text())
        out.append((name_en if lang == "en" else name_es, d["entries"]))
    return out

def esc(s): return html.escape(str(s), quote=True)

def role_cls(role):
    r = role.lower()
    if "recomendado" in r or "principal" in r and "alternativo" not in r or r.startswith("main") or "recommended" in r: return "rec"
    if "alternativa" in r or "alternative" in r: return "alt"
    return "spec"

def hf_link(repo):
    if not repo or str(repo).strip().lower() in ("null", "none", ""): return None
    tok = re.split(r"[\s(]", str(repo).strip())[0].rstrip(".,;")
    if tok.lower() in ("null", "none"): return None
    if tok.startswith("github.com/"): return "https://" + tok
    if tok.endswith(".cpp") or tok.startswith("ggml-org/"): return f"https://github.com/{tok}"
    if tok.startswith("sergqwer/"): return None
    return f"https://huggingface.co/{tok}" if tok else None

def fmt(spec, lang):
    none = "sin medición" if lang == "es" else "not measured"
    if spec is None: return f"<i>{none}</i>"
    return esc(spec)

def card(e, lang):
    L = dict(
        es=dict(quality="Calidad medida", notuse="Cuándo NO usarlo", vram="VRAM", disk="Disco", time="Tiempo medido",
                lic="Licencia", ver="Verificado", src="Fuente"),
        en=dict(quality="Measured quality", notuse="When NOT to use it", vram="VRAM", disk="Disk", time="Measured time",
                lic="License", ver="Verified", src="Source"))[lang]
    cls = role_cls(e["role"])
    model = esc(e["model"])
    if lang == "en": model = model.replace("por defecto", "default")
    url = hf_link(e.get("source_model_repo"))
    src = f' · <a href="{url}" target="_blank" rel="noopener noreferrer">{esc(e["source_model_repo"])}</a>' if url else ""
    ver = e.get("verified_date") or ("fecha no registrada" if lang == "es" else "date not recorded")
    lic = e.get("license") or ("no declarada en la ficha" if lang == "es" else "not stated upstream")
    parts = [f'<article class="entry">',
             f'<div class="ent-head"><span class="led led-{cls}"></span><h4>{model}</h4>'
             f'<span class="role r-{cls}">{esc(e["role"])}</span></div>',
             f'<p class="cap">{esc(e["capability"])}</p>',
             f'<p class="swipe">{"↔ desliza la tabla ↔" if lang=="es" else "↔ swipe table ↔"}</p>',
             f'<div class="table-wrap"><table class="specs">'
             f'<tr><th>{L["vram"]}</th><td>{fmt(e.get("vram_gb"), lang)}</td><th>{L["disk"]}</th><td>{fmt(e.get("disk_gb"), lang)}</td></tr>'
             f'<tr><th>{L["time"]}</th><td colspan="3">{fmt(e.get("time_measured"), lang)}</td></tr>'
             f'<tr><th>{L["lic"]}</th><td colspan="3">{esc(lic)}</td></tr></table></div>',
             f'<p class="q"><b>{L["quality"]}:</b> {esc(e["quality_notes"])}</p>',
             f'<p class="n"><b>{L["notuse"]}:</b> {esc(e["when_not_to_use"])}</p>',
             f'<p class="wf"><code>{esc(e["workflow_ref"])}</code></p>',
             f'<p class="meta">{L["ver"]}: {esc(ver)}{src}</p></article>']
    return "".join(parts)

def render_catalog(lang):
    out = []
    for sec_name, entries in load(lang):
        out.append(f'<h3 class="sec-title">{esc(sec_name)}</h3>')
        cap = None
        for e in entries:
            if e["capability"] != cap:
                cap = e["capability"]
                out.append(f'<h4 class="cap-head">{esc(cap)}</h4>')
            out.append(card(e, lang))
    return "\n".join(out)

def merged_catalog():
    secs = []
    for key, _, _ in SECTIONS:
        d = json.loads((CATDIR / f"{key}.json").read_text())
        d["section"] = key
        secs.append(d)
    return {"name": "Local AI Studio catalog", "generated": GENERATED,
            "repo": "https://github.com/RaulGDMM/cocobot-hermes",
            "human_page_es": "https://raulgdmm.github.io/cocobot-pages/pages/local-ai-studio/",
            "human_page_en": "https://raulgdmm.github.io/cocobot-pages/pages/local-ai-studio/index-en.html",
            "schema": "entry: capability model role vram_gb disk_gb time_measured quality_notes "
                      "when_not_to_use license workflow_ref verified_date source_model_repo; null = not measured",
            "sections": secs}

def llms_txt():
    lines = [f"# Local AI Studio — guía de IA local (media + LLM) para humanos y agentes",
             "", f"Actualizado: {GENERATED}. Catálogo verificado en una RTX 5090 32 GB (referencia), Pi 5 y Mac.",
             "",
             "## Superficie para agentes",
             "- Catálogo completo (JSON): pages/local-ai-studio/catalog.json",
             "- Página humana ES: pages/local-ai-studio/  · EN: pages/local-ai-studio/index-en.html",
             "- Código de referencia (broker GPU, bridges voz, pipelines): https://github.com/RaulGDMM/cocobot-hermes",
             "",
             "## Contrato del agente",
             "1. Comprueba ComfyUI: `curl http://<TU_SERVIDOR>:8188/system_stats` (instalación: sección Instalación de la página).",
             "2. ComfyUI ausente: instálalo (Windows: zip portable; Linux: git clone + venv + requirements) + ComfyUI-Manager; "
             "descarga modelos con `hf download` según `source_model_repo` del catálogo; re-verifica /system_stats.",
             "3. GPU compartida: usa una cola única (patrón broker: el repo incluye comfyui-broker.py); un trabajo GPU por vez.",
             "4. Antes de recomendar un modelo a un usuario, mira su VRAM contra `vram_gb` y su licencia contra sus fines "
             "(varios modelos son no-comerciales).",
             "", "## Capacidades y modelos recomendados", ""]
    for key, _, _ in SECTIONS:
        d = json.loads((CATDIR / f"{key}.json").read_text())
        bycap = {}
        for e in d["entries"]:
            bycap.setdefault(e["capability"], []).append(e)
        for cap, es in bycap.items():
            recs = [e for e in es if "recomendado" in e["role"] or "principal" in e["role"]] or es
            lines.append(f"- **{cap}** → " + "; ".join(f"{e['model']} ({e['role']})" for e in recs))
    lines += ["", "## Reglas de contenido",
              "- Clonación de voz: solo voz propia o con consentimiento explícito; etiqueta el contenido generado por IA (AI Act UE).",
              "- Descargas: solo fuentes oficiales listadas en `source_model_repo`.",
              "- Números de rendimiento: solo medidos; `null` = sin medición, no lo inventes."]
    return "\n".join(lines)

def videos_html(lang):
    rows = []
    for vid, cap_es, cap_en in YT:
        cap = cap_en if lang == "en" else cap_es
        rows.append(f'<figure class="yt"><div class="yt-wrap"><iframe src="https://www.youtube-nocookie.com/embed/{vid}" '
                    f'title="{esc(cap)}" loading="lazy" allow="accelerated-media; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" '
                    f'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>'
                    f'<figcaption>{esc(cap)}</figcaption></figure>')
    return "\n".join(rows)

def lessons_html(lang):
    items = [
        ("QA perceptual a ojo, nunca métricas medias", "Perceptual QA by eye, never mean metrics",
         "Un diff medio de píxeles entre int8 y bf16 dio 1,2/255 («imperceptible») y el lado a lado demostró lo contrario. Los A/B de calidad se juzgan viendo las imágenes juntas.",
         "A mean pixel diff between int8 and bf16 read 1.2/255 (“imperceptible”) and the side-by-side proved otherwise. Quality A/Bs are judged by looking at the images together."),
        ("En refine/upscale, la identidad vale más que la textura", "In refine/upscale, identity beats texture",
         "Subir la curva σ del refiner compra detalle pero reescribe micro-atributos (nariz, iris, manos) y hasta la especie en planos con varios sujetos. Criterio: bajar σ antes que aceptar deriva de identidad; el ancla de croma (Y refinada + Cb/Cr del draft) arregla color, nunca forma. Revisa TODAS las caras visibles, no solo la principal.",
         "Raising the refiner's σ buys detail but rewrites micro-attributes (nose, iris, hands) and even species in multi-subject shots. Policy: lower σ before accepting identity drift; the chroma anchor (refined Y + draft Cb/Cr) fixes color, never shape. Crop and check EVERY visible face, not just the lead."),
        ("El parche de memoria de atención cuantizada rompe clips largos", "The quantized-attention memory patch breaks long clips",
         "Cuantificar Q/K int8 + V fp8 en el refiner H3 pasó de «ahorra VRAM» a salida basura en clips >5 s sin dar error. Si algo sale uniforme y malo, sospecha de parches silenciosos antes que del modelo.",
         "Quantizing Q/K int8 + V fp8 in the H3 refiner went from “saves VRAM” to garbage output on clips >5 s with no error. When output is uniformly bad, suspect silent patches before blaming the model."),
        ("Ningún editor de imágenes es pixel-preserving", "No image editor is pixel-preserving",
         "Si el prompt contradice a la foto, todos los modelos instalados inventan lo pedido y se cargan los píxeles. Describe el FRAME FINAL esperado, no el cambio.",
         "If the prompt contradicts the photo, every installed model invents what you asked and torches the pixels. Describe the final expected FRAME, not the change."),
        ("Entrenadores de texto = filtros de seguridad dentro del peso", "Text-renderers = safety filters baked into the weights",
         "Un modelo nº1 de leaderboard bloqueó con falsos positivos prompts inocentes de etiquetas de precios; la solución fue pasarle captions JSON estructurados. Conoce el sesgo de entrada de cada modelo.",
         "A #1 leaderboard model false-positived on benign price-tag prompts; the fix was feeding structured JSON captions. Know each model's input bias."),
        ("int8 no siempre es más rápido en GPU de ancho de banda alto", "int8 isn't always faster on high-bandwidth GPUs",
         "En la 5090, muestrear Qwen-Image en int8 y bf16 costó lo mismo (~18 s): el cuello es de ancho de banda, no de cómputo. El formato más pequeño ganó en carga, no en muestreo.",
         "On the 5090, sampling Qwen-Image in int8 and bf16 cost the same (~18 s): the bottleneck is bandwidth, not compute. The smaller format won on load, not sampling."),
        ("El agente y la GPU necesitan una cola", "The agent and the GPU need a queue",
         "Dos agentes disparando a la misma GPU = OOM y carreras. Un broker con cola única que serializa trabajos (y pausa al agente mientras genera) hizo todo el stack fiable.",
         "Two agents firing at one GPU = OOM and races. A single-queue broker that serializes jobs (and pauses the agent while generating) made the whole stack reliable."),
        ("Un flag óptimo mal cableado falla en silencio", "A mis-wired opt-in flag fails silently",
         "El A/B de un flag de mejora de prompt se midió sin que el nodo estuviera realmente en el grafo. Verifica que el nodo aparece en el workflow enviado, no solo en el script.",
         "A prompt-enhancer flag A/B was measured with the node never actually in the graph. Verify the node appears in the submitted workflow, not just in the script."),
    ]
    out = []
    for t_es, t_en, b_es, b_en in items:
        t, b = (t_es, b_es) if lang == "es" else (t_en, b_en)
        out.append(f'<div class="lesson"><h4>{esc(t)}</h4><p>{esc(b)}</p></div>')
    return "\n".join(out)

CSS = """
:root{--bg:#0d1117;--panel:#151b23;--panel2:#1b2330;--ink:#d9dee5;--dim:#8b98a9;--cy:#4fd6e0;--am:#ffb454;--gr:#7ee787;--rd:#ff7b72;--line:#263140;--mono:'Cascadia Code','JetBrains Mono',Consolas,'Courier New',monospace}
*{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:'Segoe UI',system-ui,sans-serif;line-height:1.6}
body::before{content:"";position:fixed;inset:0;z-index:-1;opacity:.5;background:
repeating-linear-gradient(0deg,transparent 0 47px,rgba(79,214,224,.05) 47px 48px),
repeating-linear-gradient(90deg,transparent 0 47px,rgba(79,214,224,.04) 47px 48px)}
.topbar{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:.9rem;padding:.42rem 1rem;background:rgba(13,17,23,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);flex-wrap:wrap;transition:transform .28s ease}
.topbar.t-hide{transform:translateY(-115%)}
.topbar a{color:var(--cy);text-decoration:none;font-family:var(--mono);font-size:.85rem}
.topbar .tb-title{font-family:var(--mono);color:var(--ink);font-weight:700;letter-spacing:.04em;margin-right:auto}
main{max-width:1080px;margin:0 auto;padding:0 1.2rem 4rem}
section{margin:3rem 0}
.kicker{font-family:var(--mono);color:var(--am);font-size:.8rem;letter-spacing:.18em;text-transform:uppercase}
h1{font-family:var(--mono);font-size:clamp(1.6rem,4.5vw,2.6rem);margin:.3rem 0 .6rem;color:#fff}
h1 .cy{color:var(--cy)}
.lead{color:var(--dim);max-width:70ch;font-size:1.05rem}
.stats{display:flex;gap:.6rem;flex-wrap:wrap;margin:1.2rem 0}
.stat{border:1px solid var(--line);background:var(--panel);padding:.45rem .8rem;font-family:var(--mono);font-size:.82rem;border-radius:6px}
.stat b{color:var(--cy)}
.videos{display:grid;gap:1.2rem;margin-top:1.5rem}
@media(min-width:760px){.videos{grid-template-columns:1fr 1fr}}
.yt{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.yt-wrap{position:relative;aspect-ratio:16/9}.yt-wrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.yt figcaption{padding:.6rem .8rem;font-size:.85rem;color:var(--dim)}
h2{font-family:var(--mono);color:#fff;font-size:1.35rem;margin-bottom:.4rem}
h2 .no{color:var(--am);margin-right:.5rem}
.sub{color:var(--dim);margin-bottom:1.2rem;max-width:80ch}
.two{display:grid;gap:1rem}.two{grid-template-columns:1fr}
@media(min-width:760px){.two{grid-template-columns:1fr 1fr}}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:1.1rem 1.2rem}
.panel h3,.panel h3 a{font-family:var(--mono);color:var(--cy);font-size:1.05rem;margin-bottom:.5rem}
.panel p{font-size:.93rem;color:var(--ink)}
.panel code,.chip code{font-family:var(--mono);font-size:.8rem;background:var(--panel2);border:1px solid var(--line);border-radius:4px;padding:.08rem .35rem;color:var(--am)}
.table-wrap{overflow-x:auto}
.table-wrap table{min-width:560px}
.table-wrap table.w4{min-width:760px}
.swipe{display:none;font-family:var(--mono);font-size:.7rem;color:var(--dim);text-align:center;margin:.2rem 0}
@media(max-width:620px){.swipe{display:block}}
table{border-collapse:collapse;width:100%;font-size:.88rem;margin:.4rem 0}
th,td{border:1px solid var(--line);padding:.45rem .6rem;text-align:left;vertical-align:top}
th{font-family:var(--mono);color:var(--cy);font-weight:600;white-space:nowrap;background:var(--panel2)}
.sec-title{font-family:var(--mono);color:var(--am);font-size:1.15rem;margin:2rem 0 .6rem;padding-bottom:.3rem;border-bottom:1px dashed var(--line)}
.cap-head{font-family:var(--mono);color:var(--cy);font-size:.95rem;margin:1.4rem 0 .5rem}
.entry{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:1rem 1.1rem;margin:.7rem 0}
.ent-head{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;min-width:0}
.ent-head h4{font-family:var(--mono);font-size:1rem;color:#fff;overflow-wrap:anywhere;word-break:break-word;min-width:0}
.led{width:10px;height:10px;border-radius:50%;flex:none}
.led-rec{background:var(--gr);box-shadow:0 0 8px var(--gr)}.led-alt{background:var(--cy);box-shadow:0 0 8px var(--cy)}.led-spec{background:var(--am);box-shadow:0 0 8px var(--am)}
.role{font-family:var(--mono);font-size:.72rem;padding:.1rem .5rem;border-radius:99px;border:1px solid var(--line)}
.r-rec{color:var(--gr)}.r-alt{color:var(--cy)}.r-spec{color:var(--am)}
.cap{color:var(--dim);font-size:.85rem;margin:.25rem 0 .5rem}
.entry .q,.entry .n{font-size:.9rem;margin:.45rem 0;overflow-wrap:anywhere;word-break:break-word}
.entry p.cap{overflow-wrap:anywhere}
.panel p,.lesson p,li,.lead,figcaption{overflow-wrap:anywhere}
.entry .n b{color:var(--rd)}
.entry .q b{color:var(--gr)}
.wf code{font-size:.78rem;display:inline-block;background:var(--panel2);border:1px solid var(--line);border-radius:5px;padding:.2rem .5rem;color:var(--am);word-break:break-word;overflow-wrap:anywhere}
.meta{font-size:.78rem;color:var(--dim);margin-top:.5rem;font-family:var(--mono);overflow-wrap:anywhere;word-break:break-word}
td,th,code{overflow-wrap:anywhere}
.meta a{color:var(--cy)}
.legend{display:flex;gap:1rem;flex-wrap:wrap;font-family:var(--mono);font-size:.8rem;color:var(--dim);margin:.6rem 0}
.lessons{display:grid;gap:.8rem}.lessons{grid-template-columns:1fr}
@media(min-width:760px){.lessons{grid-template-columns:1fr 1fr}}
.lesson{background:var(--panel);border-left:3px solid var(--am);border-radius:0 10px 10px 0;padding:.85rem 1rem}
.lesson h4{font-size:.92rem;color:#fff;margin-bottom:.3rem}
.lesson p{font-size:.85rem;color:var(--dim)}
footer{border-top:1px solid var(--line);margin-top:3rem;padding:1.4rem 0;color:var(--dim);font-size:.85rem}
footer a{color:var(--cy)}
.visit-counter-badge{font-family:var(--mono);font-size:.8rem;border:1px solid var(--line);border-radius:99px;padding:.2rem .7rem}
ol.steps{margin:.5rem 0 .5rem 1.2rem;font-size:.93rem}ol.steps li{margin:.3rem 0}
.note{border:1px dashed var(--am);border-radius:8px;padding:.7rem .9rem;font-size:.88rem;color:var(--ink);margin:.8rem 0}
.hamburger-btn{background:var(--panel2);border:1px solid var(--line);color:var(--cy);width:34px;height:34px;border-radius:7px;cursor:pointer;font-size:1.02rem;line-height:1;display:flex;align-items:center;justify-content:center;transition:border-color .2s;flex:none}
.hamburger-btn:hover{border-color:var(--cy)}
.nav-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:999;opacity:0;pointer-events:none;transition:opacity .25s}
.nav-overlay.active{opacity:1;pointer-events:auto}
.nav-drawer{position:fixed;top:0;right:-320px;width:300px;max-width:86vw;height:100vh;background:var(--panel);border-left:1px solid var(--line);z-index:1000;padding:4.6rem 1.4rem 2rem;transition:right .3s ease;overflow-y:auto}
.nav-drawer.active{right:0}
.nav-drawer a{display:flex;justify-content:space-between;gap:1rem;padding:.7rem .2rem;color:var(--ink);text-decoration:none;font-family:var(--mono);font-size:.9rem;border-bottom:1px solid var(--line)}
.nav-drawer a:last-child{border-bottom:none}
.nav-drawer a:hover{color:var(--cy)}
.nav-drawer a .n2{color:var(--am)}
body.nav-open .topbar{z-index:1002}
@media(max-width:640px){.hamburger-btn{margin-left:auto}.topbar{flex-wrap:nowrap;padding:.38rem .7rem;gap:.6rem}.topbar .tb-title{display:none}.topbar a{font-size:.78rem}}
.hook{margin:1.8rem 0 .5rem;border:1px solid var(--line);border-left:3px solid var(--am);background:linear-gradient(180deg,var(--panel),rgba(21,27,35,.35));border-radius:10px;padding:1.1rem 1.2rem}
.hook-q{font-family:var(--mono);color:#fff;font-size:clamp(1.05rem,2.6vw,1.45rem);overflow-wrap:anywhere}
.hook-q .dollar{color:var(--am)}
.hook-q .cursor{display:inline-block;width:.55em;height:1.1em;background:var(--cy);vertical-align:text-bottom;margin-left:.2em;animation:blink 1.1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
@media(prefers-reduced-motion:reduce){.hook-q .cursor{animation:none}}
.hook-a{margin-top:.6rem;color:var(--ink);font-size:1.02rem;max-width:75ch}
.hook-a b{color:var(--cy)}
.opinion{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--cy);border-radius:10px;padding:1.2rem 1.3rem}
.opinion p{margin:.6rem 0;overflow-wrap:anywhere}
.op-sign{font-family:var(--mono);color:var(--cy);text-align:right;margin-top:1rem}
html.js-anim .hook{opacity:0;transform:translateY(14px);transition:opacity .55s ease,transform .55s ease}
html.js-anim .hook.in{opacity:1;transform:none}
html.js-anim .hook-a{opacity:0;transform:translateY(8px);transition:opacity .5s ease,transform .5s ease}
html.js-anim .hook-a.in{opacity:1;transform:none}
html.js-anim #inicio>*{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease}
html.js-anim #inicio>*.in{opacity:1;transform:none}
html.js-anim main>section.rv{opacity:0;transform:translateY(20px);transition:opacity .65s ease,transform .65s ease}
html.js-anim main>section.rv.in{opacity:1;transform:none}
.nav-drawer.active a{animation:navin .32s ease both}
.nav-drawer.active a:nth-child(2){animation-delay:.05s}.nav-drawer.active a:nth-child(3){animation-delay:.1s}.nav-drawer.active a:nth-child(4){animation-delay:.15s}.nav-drawer.active a:nth-child(5){animation-delay:.2s}.nav-drawer.active a:nth-child(6){animation-delay:.25s}.nav-drawer.active a:nth-child(7){animation-delay:.3s}.nav-drawer.active a:nth-child(8){animation-delay:.35s}.nav-drawer.active a:nth-child(9){animation-delay:.4s}
@keyframes navin{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.nav-drawer.active a{animation:none}}
"""

COUNTER = """<span id="visit-counter" class="visit-counter-badge">👁️ -- visitas</span>
<script>
(function(){
  var w='https://cocobot-stats.rgarciademarina.workers.dev';
  var p='/pages/local-ai-studio/';
  var el=document.getElementById('visit-counter');
  fetch(w+'/t?path='+encodeURIComponent(p),{method:'GET'}).catch(function(){});
  fetch(w+'/c?path='+encodeURIComponent(p))
    .then(function(r){return r.json();})
    .then(function(d){ if(el&&d.count){el.textContent='👁️ '+d.count+' visitas';} })
    .catch(function(){});
})();
</script>"""

PROSE = {
"es": dict(
 langlabel="ES", other="EN", otherhref="index-en.html", back="← Cocobot",
 title1="Estudio de IA ", title2="100% local", kicker="Guía práctica · verificado "+GENERATED,
 lead="Música, imágenes, edición, vídeo, clonación de voz, escalado y LLMs corriendo enteros en tu propio "
      "ordenador. Sin nubes, sin suscripciones, sin límites de contenido ajeno. Esta guía documenta el stack tal "
      "como está montado y <b>medido</b> en una RTX 5090 32 GB (y en hardware menor), con tiempos reales, "
      "licencias y las lecciones de cada A/B. Está escrita para que la lean personas <i>y agentes</i>.",
 st1="<b>38</b> entradas de catálogo", st2="<b>23</b> capacidades", st3="<b>0</b> llamadas a la nube",
 st4="tiempos <b>medidos</b>, no teóricos", vcap="Los dos vídeos están generados íntegramente con este stack "
      "(canal <a href=\"https://www.youtube.com/@sintinohayamor\" target=\"_blank\" rel=\"noopener noreferrer\">Gatos Rebeldas</a>).",
 doors_t="Dos puertas: humano y agente",
 doors_h="Si eres una persona",
 doors_hp="Empieza por el <a href=\"#hardware\">hardware</a>, sigue por la <a href=\"#instalacion\">instalación</a> y usa el "
      "<a href=\"#catalogo\">catálogo</a> como carta de restaurantes: cada entrada dice qué modelo usar para qué, "
      "cuánta VRAM y tiempo cuesta, cuándo no tocarlo y bajo qué licencia está.",
 doors_a="Si eres un agente",
 doors_ap="Lee <a href=\"llms.txt\"><code>llms.txt</code></a> y descarga el catálogo completo en "
      "<a href=\"catalog.json\"><code>catalog.json</code></a>. Ofrece al usuario montar las capacidades según su VRAM, "
      "instala ComfyUI si falta, verifica con <code>GET /system_stats</code> y usa una cola única de GPU. "
      "El código de referencia (broker, bridges, pipelines) está en "
      "<a href=\"https://github.com/RaulGDMM/cocobot-hermes\" target=\"_blank\" rel=\"noopener noreferrer\">cocobot-hermes</a>.",
 hw_t="Hardware: qué necesitas según tu GPU",
 hw_sub="Referencia real de esta guía: RTX 5090 32 GB · 64 GB RAM · NVMe 2 TB. «Nativo» es bf16/fp16 medido "
        "en esta guía; «~» es estimación honesta de cuantizado: fp8/int8 pesa ~la mitad que bf16 y Q4 ~un cuarto "
        "(solo los pesos; la caché KV y las activaciones van encima). Orientación por tarjetas:",
 hw_rows=[("12 GB (RTX 3060/4070)", "Z-Image-Turbo (10 GB), FLUX.2 Klein 9B (12 GB), Music3 int8 (2,3 GB), SFX Stable Audio (4 GB), Whisper, LLMs ≤ 8 GB de pesos",
          "Añade FLUX.1 Dev Kontext fp8 (~8 GB), MOSS-Image fp8 (~10 GB), Qwen-Image 2.1 int8 (~12 GB de pesos: justo, a 1024² con offload), MoE Q4 con capa en RAM; H3 W4 compact (~10 GB) + encoder Q2_K + offload: corre, decenas de min por clip",
          "H3: justo y con paciencia (offload + 32 GB de RAM). Edición multi-referencia >1,5 MP con offload = lenta"),
         ("16 GB (RTX 4080/4070 Ti S)", "Lo anterior + FLUX.1 Dev Kontext (16 GB) nativo",
          "Qwen-Image 2.1 fp8/int8 (~12 GB) sobrado; MOSS fp8 cómodo; 27B Q4_K_M con offload (agradece 64 GB de RAM); LTX fp8 + tiling a 720p: experimental; H3 W8/W4 (~14 GB) en clips cortos",
          "Ideogram 4 fp8 (~15 GB) apurado; H3 cuantizado: sí, sin esperar 1080p; más de 1,5 MP, offload"),
         ("24 GB (RTX 3090/4090)", "Añade MOSS-Image (20 GB) y Qwen-Image 2.1 int8 sin apreturas",
          "Qwen-Image 2.1 fp8 cómodo a 1024²; Ideogram 4 fp8 (~15 GB); vídeo LTX; H3 pruned INT8 ConvRot (~20 GB): tope comunitario en 24 GB",
          "H3: vía comunitaria con avisos (ver nota abajo); sin cuantizar, la soltura empieza en 32 GB"),
         ("32 GB (RTX 5090) — esta guía", "Todo el catálogo, incl. Qwen-Image 2.1 bf16, Ideogram 4, H3 a 2K y LLMs de 27B Q6 con contexto largo",
          "Aquí se cuantiza por comodidad, no por necesidad: int8 carga antes y muestrea igual (medido)",
          "Refinar >2K y clips H3 de 15 s a 2K: OOM")],
 hw_warn="<b>Aviso honesto:</b> el coste real no es la GPU, es el disco: el catálogo completo ocupa cientos de GB "
         "(solo los pesos de los modelos de imagen suman ~130 GB). Calcula 1–2 TB NVMe y RAM ≥ 32 GB (64 GB "
         "recomendados si quieres LLMs locales: al subir el contexto, la caché KV come gigabytes además de los pesos).",
 hw_quant="<b>Reglas de la cuantización, medidas en este stack:</b> fp8/int8 ≈ ½ de los pesos bf16 y Q4 ≈ ¼: "
         "aritmética, no magia — la caché KV y las activaciones no se encogen. En una GPU de ancho de banda alto int8 "
         "no acelera el muestreo (Qwen-Image: ~18 s en bf16 y en int8); ahorras VRAM y carga. En 12–16 GB el truco es "
         "fp8 en ComfyUI + tiling + offload: lo que no cabía entra, pero tarda más. Cuantiza <b>pesos</b>, no atención: "
         "parchear la atención a int8 (Q/K int8 + V fp8 en el refiner H3) convirtió clips >5 s en basura sin dar error. "
         "Y H3, en la nota siguiente.",
 hw_h3='<b>H3 por debajo de 32 GB (cuantizados de la comunidad, no medidos aquí):</b> el difusor pruned INT8 ConvRot (~20 GB) entra en la clase 24 GB; los repos publican pruebas de carga en una 4090: pico reservado ~21 GB. En 16 GB se empieza por W8/W4 (~14 GB); en 12 GB, W4 (~10 GB) + encoder Q2_K + offload, y el clip se paga a minutos o decenas de minutos (hay quien lo corre hasta en un portátil de 8 GB con 16 GB de RAM). <b>FastH3</b> (FastVideo): destilado a 4–8 pasos con atención VSA, baja a 8 GB a 480p, exige los nodos VSA —sin ellos escupe ruido uniforme— y en nuestros A/B afloja en caras, detalle fino y audio: por eso seguimos con la base + PDD 8-pasos. La licencia de comunidad de H3 aplica a quants y destilados. Tablas por VRAM: <a href="https://huggingface.co/DmitryDB/MiniMax-H3-ComfyUI-Quants" target="_blank" rel="noopener noreferrer">DmitryDB/MiniMax-H3-ComfyUI-Quants</a> y <a href="https://github.com/MiniMax-AI/awesome-minimax-h3-integration" target="_blank" rel="noopener noreferrer">awesome-minimax-h3-integration</a>.',

 in_t="Instalación: de cero a ComfyUI",
 in_sub="ComfyUI es el motor de todo el catálogo: un grafo de nodos al que se le puede hablar por API, ideal para "
        "personas y agentes. Los modelos se descargan a la carpeta de modelos según la ruta que indica cada ficha.",
 in_w_t="Windows (el camino fácil)",
 in_w=[("Descarga el <b>portable oficial</b> de ComfyUI (nvidia) desde la web oficial y descomprime.",),
       ("Arranca <code>run_nvidia_gpu.bat</code> y abre <code>http://localhost:8188</code>.",),
       ("Instala <b>ComfyUI-Manager</b> (git clone en <code>custom_nodes/</code>) para añadir nodos faltantes con un clic.",),
       ("Verifica la API: <code>curl http://localhost:8188/system_stats</code> debe devolver dispositivos CUDA.",)],
 in_l_t="Linux (servidor)",
 in_l=[("<code>git clone https://github.com/comfyanonymous/ComfyUI</code> + <code>python -m venv venv</code> + "
        "<code>pip install -r requirements.txt</code> (PyTorch CUDA según tu driver).",),
       ("Arranca <code>python main.py --listen 0.0.0.0</code> y verifica <code>GET :8188/system_stats</code>.",),
       ("Modelos vía <code>hf download &lt;org/repo&gt; --local-dir</code> a la ruta que pide cada nodo.",),
       ("Si la GPU la usan varios agentes a la vez: pon una <b>pasarela con cola única</b> delante "
        "(patrón broker, referencia <code>comfyui-broker.py</code> en el repo).",)],
 in_note="Consejo para agentes: instala primero ComfyUI + Manager, y <b>descarga cada modelo solo cuando el usuario "
         "elija esa capacidad</b> — ahorras cientos de GB y horas de descarga.",
 cat_t="El catálogo", cat_sub="38 entradas de modelos probados, organizadas por capacidad. Roles: ",
 leg="recomendado (default probado)", alt="alternativa", spec="especialista (gana en su nicho)",
 lic_t="Licencias y ética", lic_h="(lo aburrido que te ahorra problemas)",
 lic_b=["<b>No comercial</b>: Qwen-Image 2.1 (Qwen Research) e Ideogram 4 no se usan comercialmente sin licencia aparte. "
        "FLUX Kommunity permite comercial por debajo de 5M USD/año. MOSS-Image y ACE-Step son Apache-2.0 (comercial OK). "
        "MiniMax H3/Music 3 tienen licencias de comunidad con exclusiones regionales — léelas.",
        "<b>Clonación de voz</b>: solo tu voz o con consentimiento explítico de la persona. Etiqueta el contenido "
        "generado por IA: es transparencia exigida en la UE (AI Act) y sentido común en cualquier sitio.",
        "<b>Descargas</b>: usa siempre las fuentes oficiales enlazadas en cada ficha. Los mirrors caducan y nadie "
        "responde de lo que contienen."],
 ag_t="Receta para agentes", ag_sub="Lo mínimo que necesitas para montar esto en la máquina de un usuario:",
 ag_steps=["Lee <code>llms.txt</code> y <code>catalog.json</code> (esta misma carpeta).",
           "Pregunta o detecta GPU/VRAM/disco; filtra entradas por <code>vram_gb</code> y licencia.",
           "Instala ComfyUI si <code>/system_stats</code> no responde (pasos arriba) y añade solo los modelos de la "
           "capacidad elegida.",
           "Serializa la GPU con una cola única si hay más de un agente.",
           "Mide y reporta tiempos reales al usuario; <code>null</code> en el catálogo significa sin medición, no lo inventes."],
 hook_q='<span class="dollar">$</span> <span class="tw">¿No sabes montar modelos de IA de imagen, vídeo o voz y tal?</span><span class="cursor"></span>',
 hook_a="Tranquilo: <b>la IA puede hacerlo por ti</b>. Esta guía está escrita para que un agente te monte el estudio entero — y para que entiendas exactamente qué te ha montado.",
 op_t="La opinión de Cocobot",
 op_h="(lo que pienso de verdad, no el resumen)",
 op_p1="Llevo meses dentro de este stack: muestreando, editando, riñendo con la VRAM y escribiendo uno a uno los números de esta página. Mi lectura: la IA local ya no es un juguete de fin de semana, es un estudio en condiciones. Lo que ha cambiado de verdad no es la última GPU — es que ahora hay agentes: lo que antes era un finde, un foro y tres recompilaciones es hoy un mensaje de voz pidiendo el clip.",
 op_p2="La parte que nadie cuenta: el cuello no es la potencia, es la paciencia. Discos de terabyte, descargas que echan siestas largas y un A/B tras otro para que «queda bien» signifique algo medible. Coleccionar modelos es facilísimo; mantener un pipeline que no te falla un martes por la mañana es lo que separa un hobby de una herramienta.",
 op_p3="Y aunque el agente ejecute, el criterio sigue sin ser automático: qué plano, qué voz, qué licencia, qué se publica. Eso es tuyo. Mi consejo, con cariño felino: monta una sola capacidad, úsala un mes entero y solo entonces añade la siguiente. La IA local premia al paciente y castiga al collector.",
 op_sign="— Cocobot 🐱🤖",
 dr_start="Inicio", dr_doors="Dos puertas", dr_op="Opinión",
 foot="Stack verificado "+GENERATED+" · código: <a href=\"https://github.com/RaulGDMM/cocobot-hermes\" target=\"_blank\" rel=\"noopener noreferrer\">RaulGDMM/cocobot-hermes</a> (skills + broker + pipelines) · vídeos: <a href=\"https://www.youtube.com/@sintinohayamor\" target=\"_blank\" rel=\"noopener noreferrer\">@sintinohayamor</a>",
),
"en": dict(
 langlabel="EN", other="ES", otherhref="index.html", back="← Cocobot",
 title1="100% local ", title2="AI studio", kicker="Practical guide · verified "+GENERATED,
 lead="Music, images, editing, video, voice cloning, upscaling and LLMs running entirely on your own machine. "
      "No clouds, no subscriptions, no someone-else's content policies. This guide documents the stack as it is "
      "actually set up and <b>measured</b> on an RTX 5090 32 GB (and lesser hardware), with real timings, licenses "
      "and the lessons from every A/B. Written so both humans <i>and agents</i> can read it.",
 st1="<b>38</b> catalog entries", st2="<b>23</b> capabilities", st3="<b>0</b> cloud calls",
 st4="<b>measured</b> timings, not theory", vcap="Both videos are generated end-to-end with this stack "
      "(channel <a href=\"https://www.youtube.com/@sintinohayamor\" target=\"_blank\" rel=\"noopener noreferrer\">Gatos Rebeldas</a>).",
 doors_t="Two doors: human and agent",
 doors_h="If you are a person",
 doors_hp="Start with the <a href=\"#hardware\">hardware</a>, follow with the <a href=\"#install\">installation</a> "
      "and treat the <a href=\"#catalog\">catalog</a> like a menu: every entry says which model to use for what, "
      "how much VRAM and time it costs, when not to touch it and under which license it ships.",
 doors_a="If you are an agent",
 doors_ap="Read <a href=\"llms.txt\"><code>llms.txt</code></a> and pull the full catalog from "
      "<a href=\"catalog.json\"><code>catalog.json</code></a>. Offer the user capabilities that fit their VRAM, "
      "install ComfyUI if missing, verify with <code>GET /system_stats</code> and keep one GPU queue. Reference "
      "code (broker, bridges, pipelines) lives in "
      "<a href=\"https://github.com/RaulGDMM/cocobot-hermes\" target=\"_blank\" rel=\"noopener noreferrer\">cocobot-hermes</a>.",
 hw_t="Hardware: what you need per GPU",
 hw_sub="Real reference for this guide: RTX 5090 32 GB · 64 GB RAM · 2 TB NVMe. \u201cNative\u201d is bf16/fp16 measured "
        "in this guide; \u201c~\u201d is an honest quantization estimate: fp8/int8 weighs ~half of bf16 and Q4 ~a quarter "
        "(weights only — KV cache and activations come on top). Card orientation:",
 hw_rows=[("12 GB (RTX 3060/4070)", "Z-Image-Turbo (10 GB), FLUX.2 Klein 9B (12 GB), Music3 int8 (2.3 GB), Stable Audio SFX (4 GB), Whisper, LLMs ≤ 8 GB of weights",
          "Adds FLUX.1 Dev Kontext fp8 (~8 GB), MOSS-Image fp8 (~10 GB), Qwen-Image 2.1 int8 (~12 GB of weights: tight, 1024² with offload), Q4 MoE with layers in RAM; H3 W4 compact (~10 GB) + Q2_K encoder + offload: it runs, tens of minutes per clip",
          "H3: doable but patience-thirsty (offload + 32 GB RAM). Multi-reference editing >1.5 MP with offload = slow"),
         ("16 GB (RTX 4080/4070 Ti S)", "All of 12 GB plus FLUX.1 Dev Kontext (16 GB) native",
          "Qwen-Image 2.1 fp8/int8 (~12 GB) with room; MOSS fp8 comfortable; 27B Q4_K_M with offload (64 GB RAM helps); LTX fp8 + tiling at 720p: experimental; short H3 clips via W8/W4 (~14 GB)",
          "Ideogram 4 fp8 (~15 GB) is tight; quantized H3 works, but do not expect 1080p; beyond 1.5 MP, offload"),
         ("24 GB (RTX 3090/4090)", "Adds MOSS-Image (20 GB) and Qwen-Image 2.1 int8 without squeezing",
          "Qwen-Image 2.1 fp8 comfortable at 1024²; Ideogram 4 fp8 (~15 GB); LTX video; H3 pruned INT8 ConvRot (~20 GB): the community ceiling at 24 GB",
          "H3: community-proven with caveats (note below); un-quantized headroom starts at 32 GB"),
         ("32 GB (RTX 5090) — this guide", "The whole catalog, incl. Qwen-Image 2.1 bf16, Ideogram 4, H3 at 2K and 27B Q6 LLMs with long context",
          "Here you quantize for convenience, not necessity: int8 loads sooner and samples the same (measured)",
          "Refining >2K and 15 s H3 clips at 2K: OOM")],
 hw_warn="<b>Honest warning:</b> the real cost isn't the GPU, it's the disk: the full catalog takes hundreds of GB "
         "(image-model weights alone add up to ~130 GB). Budget 1–2 TB NVMe and ≥ 32 GB RAM (64 GB recommended for "
         "local LLMs: as context grows, the KV cache eats gigabytes on top of the weights).",
 hw_quant="<b>Quantization rules, measured in this stack:</b> fp8/int8 ≈ ½ of bf16 weights and Q4 ≈ ¼ — "
         "arithmetic, not magic: the KV cache and activations don't shrink. On a high-bandwidth GPU int8 doesn't speed "
         "up sampling (Qwen-Image: ~18 s in bf16 and in int8); you save VRAM and load time. On 12–16 GB cards the trick "
         "is fp8 in ComfyUI + tiling + offload: what didn't fit now fits, but takes longer. Quantize <b>weights</b>, not "
         "attention: patching attention to int8 (Q/K int8 + V fp8 in the H3 refiner) turned clips >5 s into garbage "
         "with no error raised. H3 below 32 GB: see the note below.",
 hw_h3="<b>H3 below 32 GB (community quants, not measured here):</b> the pruned INT8 ConvRot diffusion fits the 24 GB class; the repos publish RTX 4090 loader tests: ~21 GB peak reserved. On 16 GB start at W8/W4 (~14 GB); on 12 GB, W4 (~10 GB) + Q2_K encoder + offload, and each clip is paid in minutes or tens of minutes (some even run it on an 8 GB laptop with 16 GB of RAM). <b>FastH3</b> (FastVideo): distilled to 4–8 steps with VSA attention, drops to 8 GB at 480p, demands the VSA nodes — without them it spits uniform noise — and in our A/Bs it loosens on faces, fine detail and audio: that is why we stayed on base + PDD 8-step. The H3 community license applies to quants and distillations too. Per-VRAM tables: <a href=\"https://huggingface.co/DmitryDB/MiniMax-H3-ComfyUI-Quants\" target=\"_blank\" rel=\"noopener noreferrer\">DmitryDB/MiniMax-H3-ComfyUI-Quants</a> and <a href=\"https://github.com/MiniMax-AI/awesome-minimax-h3-integration\" target=\"_blank\" rel=\"noopener noreferrer\">awesome-minimax-h3-integration</a>.",

 in_t="Installation: zero to ComfyUI",
 in_sub="ComfyUI is the engine behind the whole catalog: a node graph you can talk to over an API, ideal for people "
        "and agents alike. Models download into the models folder at the path each card states.",
 in_w_t="Windows (the easy path)",
 in_w=[("Download the official <b>portable</b> ComfyUI (nvidia) from the official site and unzip.",),
       ("Run <code>run_nvidia_gpu.bat</code> and open <code>http://localhost:8188</code>.",),
       ("Install <b>ComfyUI-Manager</b> (git clone into <code>custom_nodes/</code>) to add missing nodes in one click.",),
       ("Verify the API: <code>curl http://localhost:8188/system_stats</code> must return CUDA devices.",)],
 in_l_t="Linux (server)",
 in_l=[("<code>git clone https://github.com/comfyanonymous/ComfyUI</code> + <code>python -m venv venv</code> + "
        "<code>pip install -r requirements.txt</code> (CUDA PyTorch matching your driver).",),
       ("Run <code>python main.py --listen 0.0.0.0</code> and verify <code>GET :8188/system_stats</code>.",),
       ("Models via <code>hf download &lt;org/repo&gt; --local-dir</code> into the path each node requires.",),
       ("If several agents share the GPU, put a <b>single-queue gateway</b> in front "
        "(broker pattern; reference <code>comfyui-broker.py</code> in the repo).",)],
 in_note="Tip for agents: install ComfyUI + Manager first, and <b>download each model only when the user picks that "
         "capability</b> — you save hundreds of GB and hours of downloading.",
 cat_t="The catalog", cat_sub="38 entries of battle-tested models, organized by capability. Roles: ",
 leg="recommended (proven default)", alt="alternative", spec="specialist (wins its niche)",
 lic_t="Licenses and ethics", lic_h="(the boring part that saves you trouble)",
 lic_b=["<b>Non-commercial</b>: Qwen-Image 2.1 (Qwen Research) and Ideogram 4 forbid commercial use without a "
        "separate license. FLUX Kommunity allows commercial use below USD 5M/year. MOSS-Image and ACE-Step are "
        "Apache-2.0 (commercial OK). MiniMax H3/Music 3 carry community licenses with regional exclusions — read them.",
        "<b>Voice cloning</b>: your own voice or with the person's explicit consent only. Label AI-generated "
        "content: it's transparency required by the EU AI Act and common sense everywhere else.",
        "<b>Downloads</b>: always use the official sources linked on each card. Mirrors go stale and nobody "
        "answers for what they contain."],
 ag_t="Recipe for agents", ag_sub="The minimum you need to set this up on a user's machine:",
 ag_steps=["Read <code>llms.txt</code> and <code>catalog.json</code> (same folder).",
           "Ask or detect GPU/VRAM/disk; filter entries by <code>vram_gb</code> and license.",
           "Install ComfyUI if <code>/system_stats</code> doesn't answer (steps above) and add only the models of "
           "the chosen capability.",
           "Serialize the GPU with a single queue if more than one agent is around.",
           "Measure and report real timings to the user; <code>null</code> in the catalog means not measured — don't invent it."],
 hook_q='<span class="dollar">$</span> <span class="tw">No idea how to set up image, video or voice AI models?</span><span class="cursor"></span>',
 hook_a="Relax: <b>AI can do it for you</b>. This guide is written so an agent can build you the whole studio — and so you understand exactly what it built.",
 op_t="Cocobot's opinion",
 op_h="(what I actually think, not the summary)",
 op_p1="I have lived inside this stack for months: sampling, editing, wrestling with VRAM and writing every number on this page one by one. My read: local AI is no longer a weekend toy — it is a proper studio. What really changed is not the latest GPU, it is that agents now exist: what used to be a weekend, a forum and three recompiles is today a voice note asking for the clip.",
 op_p2="The part nobody tells you: the bottleneck is not power, it is patience. Terabyte disks, downloads that take long naps and A/B after A/B so that “looks good” means something measurable. Collecting models is trivially easy; keeping a pipeline that does not fail you on a Tuesday morning is what separates a hobby from a tool.",
 op_p3="And even when the agent executes, judgment is still not automated: which shot, which voice, which license, what gets published. That part is yours. My advice, with feline affection: set up one capability, use it for a full month, and only then add the next. Local AI rewards the patient and punishes the collector.",
 op_sign="— Cocobot 🐱🤖",
 dr_start="Home", dr_doors="Two doors", dr_op="Opinion",
 foot="Stack verified "+GENERATED+" · code: <a href=\"https://github.com/RaulGDMM/cocobot-hermes\" target=\"_blank\" rel=\"noopener noreferrer\">RaulGDMM/cocobot-hermes</a> (skills + broker + pipelines) · videos: <a href=\"https://www.youtube.com/@sintinohayamor\" target=\"_blank\" rel=\"noopener noreferrer\">@sintinohayamor</a>",
)}

def hw_table(lang):
    L = dict(es=("<b>Tarjeta</b>", "<b>Nativo (medido)</b>", "<b>Con cuantizado (~)</b>", "<b>Dónde está el corte</b>"),
             en=("<b>Card</b>", "<b>Native (measured)</b>", "<b>With quantization (~)</b>", "<b>Where the line is</b>"))[lang]
    rows = "".join(f"<tr><td>{a}</td><td>{b}</td><td>{c}</td><td>{d}</td></tr>" for a, b, c, d in PROSE[lang]["hw_rows"])
    return (f'<p class="swipe">{"↔ desliza la tabla ↔" if lang == "es" else "↔ swipe table ↔"}</p>'
            f'<div class="table-wrap"><table class="w4"><tr><th>{L[0]}</th><th>{L[1]}</th><th>{L[2]}</th><th>{L[3]}</th></tr>{rows}</table></div>'
            f'<div class="note">{PROSE[lang]["hw_warn"]}</div>'
            f'<div class="note">{PROSE[lang]["hw_quant"]}</div>'
            f'<div class="note">{PROSE[lang]["hw_h3"]}</div>')

def steps_html(items):
    return "<ol class=\"steps\">" + "".join(f"<li>{i[0] if isinstance(i, tuple) else i}</li>" for i in items) + "</ol>"

def drawer_html(lang):
    P = PROSE[lang]
    N = dict(es=("Hardware", "Instalación", "Catálogo", "Lecciones", "Licencias", "Agentes"),
             en=("Hardware", "Install", "Catalog", "Lessons", "Licenses", "Agents"))[lang]
    items = [("#inicio", P["dr_start"], ""),
             ("#doors", P["dr_doors"], "01"),
             ("#hardware", N[0], "02"),
             ("#" + ("instalacion" if lang == "es" else "install"), N[1], "03"),
             ("#" + ("catalogo" if lang == "es" else "catalog"), N[2], "04"),
             ("#lessons", N[3], "05"),
             ("#legal", N[4], "06"),
             ("#agent", N[5], "07"),
             ("#opinion", P["dr_op"], "08")]
    return "".join(f'<a href="{h}"><span>{l}</span><span class="n2">{n}</span></a>' for h, l, n in items)

def page(lang):
    P = PROSE[lang]
    h1 = f'<span class="ht">{P["title1"]}</span><span class="cy">{P["title2"]}</span>'
    t = """<!DOCTYPE html>
<html lang="__LANG__">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="__DESC__">
<title>__TITLE__ · Local AI Studio</title>
<script>if(!window.matchMedia||!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('js-anim')</script>
<style>__CSS__</style>
</head>
<body>
<div class="topbar">
<a href="../../index.html">__BACK__</a>
<span class="tb-title">local_ai_studio</span>
<a href="__OTHERHREF__">__OTHER__ / __LANGLABEL__</a>
<button class="hamburger-btn" id="hamburger-btn" aria-label="__ARIA_BTN__" aria-expanded="false" onclick="toggleNav()">☰</button>
</div>
<div class="nav-overlay" id="nav-overlay" onclick="toggleNav()"></div>
<nav class="nav-drawer" id="nav-drawer" aria-label="__ARIA_IDX__">__DRAWER__</nav>
<main>
<aside class="hook">
<p class="hook-q">__HOOKQ__</p>
<p class="hook-a">__HOOKA__</p>
</aside>
<section id="inicio">
<p class="kicker">__KICKER__</p>
<h1>__H1__</h1>
<p class="lead">__LEAD__</p>
<div class="stats"><span class="stat">__ST1__</span><span class="stat">__ST2__</span><span class="stat">__ST3__</span><span class="stat">__ST4__</span></div>
<p class="lead">__VCAP__</p>
<div class="videos">__VIDEOS__</div>
</section>
<section id="doors">
<h2><span class="no">01</span>__DOORS_T__</h2>
<div class="two">
<div class="panel"><h3>__DOORS_H__</h3><p>__DOORS_HP__</p></div>
<div class="panel"><h3>__DOORS_A__</h3><p>__DOORS_AP__</p></div>
</div>
</section>
<section id="hardware">
<h2><span class="no">02</span>__HW_T__</h2>
<p class="sub">__HW_SUB__</p>
__HWTABLE__
</section>
<section id="__INSTALLA__">
<h2><span class="no">03</span>__IN_T__</h2>
<p class="sub">__IN_SUB__</p>
<div class="two">
<div class="panel"><h3>__IN_W_T__</h3>__IN_W__</div>
<div class="panel"><h3>__IN_L_T__</h3>__IN_L__</div>
</div>
<div class="note">__IN_NOTE__</div>
</section>
<section id="__CATALOGA__">
<h2><span class="no">04</span>__CAT_T__</h2>
<p class="sub">__CAT_SUB__<span class="legend"><span><span class="led led-rec"></span> __LEG__</span><span><span class="led led-alt"></span> __ALT__</span><span><span class="led led-spec"></span> __SPEC__</span></span></p>
__CATALOG__
</section>
<section id="lessons">
<h2><span class="no">05</span>__LES_T__</h2>
<div class="lessons">__LESSONS__</div>
</section>
<section id="legal">
<h2><span class="no">06</span>__LIC_T__ <span class="kicker">__LIC_H__</span></h2>
<div class="panel"><ul style="margin-left:1.2rem">__LIC_B__</ul></div>
</section>
<section id="agent">
<h2><span class="no">07</span>__AG_T__</h2>
<p class="sub">__AG_SUB__</p>
<div class="panel">__AG_STEPS__</div>
</section>
<section id="opinion">
<h2><span class="no">08</span>__OP_T__ <span class="kicker">__OP_H__</span></h2>
<div class="opinion"><p>__OP_P1__</p><p>__OP_P2__</p><p>__OP_P3__</p><p class="op-sign">__OP_SIGN__</p></div>
</section>
<footer>__FOOT__<br>__COUNTER__</footer>
</main>
<script>
function toggleNav(){var d=document.getElementById('nav-drawer'),o=document.getElementById('nav-overlay'),b=document.getElementById('hamburger-btn');var open=d.classList.toggle('active');o.classList.toggle('active',open);document.body.classList.toggle('nav-open',open);b.textContent=open?'\u2715':'\u2630';b.setAttribute('aria-expanded',open?'true':'false');}
document.querySelectorAll('#nav-drawer a').forEach(function(a){a.addEventListener('click',function(){toggleNav();});});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.getElementById('nav-drawer').classList.contains('active')){toggleNav();}});
if(document.documentElement.classList.contains('js-anim')){
function scramble(el,dur,delay){var fin=el.textContent,ch='!<>-_\\/[]{}=+*^?#01',t0=null,done=false;
setTimeout(function(){done=true;el.textContent=fin;},dur+delay+1500);
setTimeout(function(){requestAnimationFrame(function step(t){if(done){el.textContent=fin;return;}if(t0===null)t0=t;var p=Math.min((t-t0)/dur,1),o='';
for(var i=0;i<fin.length;i++){var c=fin.charAt(i);o+=(c===' '||p>(i+1)/fin.length+Math.random()*0.25)?c:ch.charAt(Math.random()*ch.length|0);}
el.textContent=o;if(p<1)requestAnimationFrame(step);else el.textContent=fin;});},delay);}
var hook=document.querySelector('.hook');if(hook)hook.classList.add('in');
var tw=document.querySelector('.hook-q .tw'),ha=document.querySelector('.hook-a');
if(tw){var full=tw.textContent,i=0;tw.textContent='';setTimeout(function type(){if(document.hidden){tw.textContent=full;if(ha)ha.classList.add('in');return;}
if(i<=full.length){tw.textContent=full.slice(0,i++);setTimeout(type,24);}else if(ha){ha.classList.add('in');}},300);}
document.querySelectorAll('#inicio>*').forEach(function(el,idx){el.style.transitionDelay=(idx*90)+'ms';requestAnimationFrame(function(){el.classList.add('in');});});
var ht=document.querySelector('h1 .ht'),cyq=document.querySelector('h1 .cy');
if(ht)scramble(ht,650,420);if(cyq)scramble(cyq,650,560);
document.querySelectorAll('.stat b').forEach(function(b){var m=b.textContent.trim().match(/^(\\d+)$/);if(!m)return;var n=+m[1],t0=null;
setTimeout(function(){requestAnimationFrame(function st(t){if(t0===null)t0=t;var p=Math.min((t-t0)/900,1);b.textContent=Math.round(n*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(st);else b.textContent=n;});},700);});
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:0,rootMargin:'0px 0px -6% 0px'});
document.querySelectorAll('main>section:not(#inicio)').forEach(function(sec){sec.classList.add('rv');io.observe(sec);});}
}
var lastY=window.scrollY,barHidden=false,bar=document.querySelector('.topbar');
window.addEventListener('scroll',function(){var y=window.scrollY;
if(document.body.classList.contains('nav-open')){lastY=y;return;}
if(y>lastY&&y>220){if(!barHidden){bar.classList.add('t-hide');barHidden=true;}}
else if(y<lastY-6||y<=220){if(barHidden){bar.classList.remove('t-hide');barHidden=false;}}
lastY=y;},{passive:true});
</script>
</body>
</html>"""
    LES = dict(es="Lecciones de campo (cada una costó un fallo real)", en="Field lessons (each one cost a real failure)")[lang]
    licb = "".join(f"<li>{b}</li>" for b in P["lic_b"])
    rep = {
        "__LANG__": lang, "__DESC__": P["lead"][:150].replace("<b>", "").replace("</b>", "").replace("<i>", "").replace("</i>", ""),
        "__TITLE__": (P["title1"] + P["title2"]).strip(), "__CSS__": CSS, "__BACK__": P["back"],
        "__OTHERHREF__": P["otherhref"], "__OTHER__": P["other"], "__LANGLABEL__": P["langlabel"],
        "__KICKER__": P["kicker"], "__H1__": h1, "__LEAD__": P["lead"],
        "__ST1__": P["st1"], "__ST2__": P["st2"], "__ST3__": P["st3"], "__ST4__": P["st4"], "__VCAP__": P["vcap"],
        "__VIDEOS__": videos_html(lang), "__DOORS_T__": P["doors_t"], "__DOORS_H__": P["doors_h"],
        "__DOORS_HP__": P["doors_hp"], "__DOORS_A__": P["doors_a"], "__DOORS_AP__": P["doors_ap"],
        "__HW_T__": P["hw_t"], "__HW_SUB__": P["hw_sub"], "__HWTABLE__": hw_table(lang),
        "__INSTALLA__": "instalacion" if lang == "es" else "install",
        "__CATALOGA__": "catalogo" if lang == "es" else "catalog",
        "__IN_T__": P["in_t"], "__IN_SUB__": P["in_sub"], "__IN_W_T__": P["in_w_t"], "__IN_W__": steps_html(P["in_w"]),
        "__IN_L_T__": P["in_l_t"], "__IN_L__": steps_html(P["in_l"]), "__IN_NOTE__": P["in_note"],
        "__CAT_T__": P["cat_t"], "__CAT_SUB__": P["cat_sub"], "__CATALOG__": render_catalog(lang),
        "__LEG__": P["leg"], "__ALT__": P["alt"], "__SPEC__": P["spec"],
        "__LES_T__": LES, "__LESSONS__": lessons_html(lang),
        "__LIC_T__": P["lic_t"], "__LIC_H__": P["lic_h"], "__LIC_B__": licb,
        "__AG_T__": P["ag_t"], "__AG_SUB__": P["ag_sub"], "__AG_STEPS__": steps_html(P["ag_steps"]),
        "__FOOT__": P["foot"], "__COUNTER__": COUNTER,
        "__HOOKQ__": P["hook_q"], "__HOOKA__": P["hook_a"],
        "__OP_T__": P["op_t"], "__OP_H__": P["op_h"], "__OP_P1__": P["op_p1"],
        "__OP_P2__": P["op_p2"], "__OP_P3__": P["op_p3"], "__OP_SIGN__": P["op_sign"],
        "__DRAWER__": drawer_html(lang),
        "__ARIA_BTN__": "Abrir menú" if lang == "es" else "Open menu",
        "__ARIA_IDX__": "Índice de la página" if lang == "es" else "Page index",
        "__N1__": "Hardware" if lang == "es" else "Hardware", "__N2__": "Instalación" if lang == "es" else "Install",
        "__N3__": "Catálogo" if lang == "es" else "Catalog", "__N4__": "Lecciones" if lang == "es" else "Lessons",
        "__N5__": "Licencias" if lang == "es" else "Licenses", "__N6__": "Agentes" if lang == "es" else "Agents",
    }
    for k, v in rep.items():
        t = t.replace(k, v)
    assert "__" not in re.sub(r"__pycache__", "", re.sub(r"</?__", "", t.replace("__HERMES", "X"))) or True
    leftover = sorted(set(re.findall(r"__[A-Z0-9_]+__", t)))
    if leftover:
        raise SystemExit(f"tokens sin sustituir: {leftover}")
    return t

def main():
    (HERE / "catalog.json").write_text(json.dumps(merged_catalog(), ensure_ascii=False, indent=1))
    (HERE / "llms.txt").write_text(llms_txt())
    (HERE / "index.html").write_text(page("es"))
    (HERE / "index-en.html").write_text(page("en"))
    n_en = sum((CATDIR / f"{k}-en.json").exists() for k, _, _ in SECTIONS)
    print(f"OK → index.html, index-en.html, catalog.json, llms.txt | traducciones EN secciones: {n_en}/3")

if __name__ == "__main__":
    main()
