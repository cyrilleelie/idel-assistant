"""Serveur web de review du corpus IDEL.

Lance une interface web pour valider manuellement les exemples du corpus.
Sauvegarde les verdicts (OK/KO + commentaires) dans un fichier JSON.

Usage (depuis backend/) :
  python ../scripts/corpus_generation/review_server.py

Puis ouvrir http://localhost:8501 dans le navigateur.
"""

import json
import random
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_DIR = PROJECT_ROOT / "backend" / "data" / "corpus" / "raw"
DOCS_DIR = PROJECT_ROOT / "docs"
VERDICTS_FILE = PROJECT_ROOT / "backend" / "data" / "corpus" / "verdicts.json"
RULES_FILE = PROJECT_ROOT / "backend" / "data" / "corpus" / "regles_facturation.json"
SAMPLE_SIZE = 50
PORT = 8502


def load_verdicts() -> dict:
    if VERDICTS_FILE.exists():
        with open(VERDICTS_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_verdicts(verdicts: dict) -> None:
    VERDICTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(VERDICTS_FILE, "w", encoding="utf-8") as f:
        json.dump(verdicts, f, ensure_ascii=False, indent=2)


def load_categories() -> dict[str, list[dict]]:
    """Charge un échantillon de 50 exemples par catégorie."""
    categories = {}
    for f in sorted(RAW_DIR.glob("*.jsonl")):
        examples = []
        with open(f, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    try:
                        examples.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
        random.seed(42)  # Reproductible
        sample = random.sample(examples, min(SAMPLE_SIZE, len(examples)))
        categories[f.stem] = sample
    return categories


CATEGORIES = load_categories()


def list_docs() -> list[dict]:
    """Liste les fichiers markdown du dossier docs/."""
    docs = []
    if not DOCS_DIR.exists():
        return docs
    for f in sorted(DOCS_DIR.rglob("*.md")):
        rel = f.relative_to(DOCS_DIR)
        docs.append({"path": str(rel).replace("\\", "/"), "name": f.stem})
    return docs


def read_doc(rel_path: str) -> str | None:
    """Lit un fichier doc en vérifiant qu'il est bien dans docs/."""
    target = (DOCS_DIR / rel_path).resolve()
    if not str(target).startswith(str(DOCS_DIR.resolve())):
        return None  # Path traversal
    if not target.exists() or not target.is_file():
        return None
    return target.read_text(encoding="utf-8")


# --- Règles de facturation ---

DEFAULT_RULES = [
    {"id": "MAJ_NUIT_PROF", "category": "majoration_horaire", "code": "MAJ_NUIT_PROF", "label": "Nuit profonde", "montant": "18.30", "condition": "23h00 – 5h00", "description": "Majoration nuit profonde applicable aux actes techniques AMI/AMX uniquement (pas aux forfaits BSI)."},
    {"id": "MAJ_NUIT", "category": "majoration_horaire", "code": "MAJ_NUIT", "label": "Nuit", "montant": "9.15", "condition": "20h00 – 23h00 / 5h00 – 8h00", "description": "Majoration nuit applicable aux actes techniques AMI/AMX uniquement."},
    {"id": "MAJ_DIM", "category": "majoration_horaire", "code": "MAJ_DIM", "label": "Dimanche / jour férié", "montant": "8.50", "condition": "Dimanche ou jour férié (toute la journée)", "description": "Cumulable avec majoration nuit. 11 jours fériés français reconnus."},
    {"id": "MCI", "category": "majoration_acte", "code": "MCI", "label": "Coordination infirmière", "montant": "5.00", "condition": "1er soin technique de la journée pour ce patient", "description": "S'applique une seule fois par patient par jour, uniquement s'il y a au moins 1 acte technique."},
    {"id": "MAU", "category": "majoration_acte", "code": "MAU", "label": "Acte unique", "montant": "1.35", "condition": "Exactement 1 seul acte technique dans le passage", "description": "Mutuellement exclusif avec l'article 11 (cumul d'actes) en pratique."},
    {"id": "MIE", "category": "majoration_acte", "code": "MIE", "label": "Enfant < 7 ans", "montant": "3.15", "condition": "Patient < 7 ans, 1 MIE par acte technique", "description": "Si 2 actes techniques, 2 lignes MIE sont ajoutées."},
    {"id": "IFD", "category": "indemnite", "code": "IFD", "label": "Forfait déplacement (hors BSI)", "montant": "2.75", "condition": "Lieu = domicile, patient sans BSI", "description": "Forfait fixe de déplacement."},
    {"id": "IFI", "category": "indemnite", "code": "IFI", "label": "Forfait infirmier BSI", "montant": "2.75", "condition": "Lieu = domicile, patient avec BSI", "description": "Remplace IFD pour les patients BSI. Auto-correction tracée."},
    {"id": "IK_PLAINE", "category": "indemnite", "code": "IK", "label": "Kilométrique plaine", "montant": "0.35", "condition": "Par km après abattement de 4 km", "description": "distance_facturable = max(0, distance_km − 4). Montant = distance_facturable × 0.35€/km."},
    {"id": "IK_MONTAGNE", "category": "indemnite", "code": "IK", "label": "Kilométrique montagne", "montant": "0.50", "condition": "Par km après abattement de 2 km", "description": "distance_facturable = max(0, distance_km − 2). Montant = distance_facturable × 0.50€/km."},
    {"id": "ETAPE_1", "category": "pipeline", "code": "AMI→AMX", "label": "Résolution AMI → AMX (patient BSI)", "montant": "", "condition": "has_active_bsi = true", "description": "Tous les codes AMI sont convertis en AMX. Le suffixe (coefficient) est conservé."},
    {"id": "ETAPE_2", "category": "pipeline", "code": "ART_11", "label": "Article 11 — cumul d'actes techniques", "montant": "", "condition": "Plusieurs actes AMI/AMX dans le même passage", "description": "1er acte : 100 %. 2e acte : 50 %. 3e et suivants : 0 %. Tri par coefficient décroissant."},
    {"id": "ETAPE_3", "category": "pipeline", "code": "BSI_FORFAIT", "label": "Ajout forfait BSI", "montant": "", "condition": "BSI actif + pas déjà facturé aujourd'hui + niveau défini", "description": "Forfait journalier unique par patient (BSA/BSB/BSC). Déduplication multi-IDEL."},
    {"id": "ETAPE_9", "category": "pipeline", "code": "TOTAUX", "label": "Calcul totaux et répartition AMO/AMC", "montant": "", "condition": "Toujours", "description": "ALD/Maternité : 100% AMO. Standard : 60% AMO, 40% AMC. Arrondi ROUND_HALF_UP."},
    {"id": "REVIEW_ORDO_MANQUANTE", "category": "needs_review", "code": "ORDO_MANQUANTE", "label": "Ordonnance manquante", "montant": "", "condition": "Aucune ordonnance rattachée au plan de soins", "description": "Facture marquée needs_review = true."},
    {"id": "REVIEW_ORDO_INVALIDE", "category": "needs_review", "code": "ORDO_INVALIDE", "label": "Ordonnance invalide", "montant": "", "condition": "Ordonnance expirée ou incomplète", "description": "Message spécifique de l'erreur affiché."},
    {"id": "REVIEW_ORDO_EXPIRANTE", "category": "needs_review", "code": "ORDO_EXPIRANTE", "label": "Ordonnance expirante", "montant": "", "condition": "Ordonnance expire bientôt (statut expiring)", "description": "Message : Ordonnance expire dans X jour(s)."},
    {"id": "REVIEW_HORAIRE", "category": "needs_review", "code": "HORAIRE_EXCEP", "label": "Horaire exceptionnel", "montant": "", "condition": "Soin avant 7h ou après 20h", "description": "Vérifier majorations appliquées."},
    {"id": "REVIEW_MONTANT_ELEVE", "category": "needs_review", "code": "MONTANT_ELEVE", "label": "Montant élevé", "montant": "80", "condition": "total > 80 €", "description": "Seuil de vérification."},
    {"id": "REVIEW_MONTANT_FAIBLE", "category": "needs_review", "code": "MONTANT_FAIBLE", "label": "Montant très faible", "montant": "3", "condition": "0 < total < 3 €", "description": "Seuil de vérification."},
]

RULE_CATEGORIES = {
    "majoration_horaire": "Majorations horaires",
    "majoration_acte": "Majorations actes",
    "indemnite": "Indemnités de déplacement",
    "pipeline": "Pipeline de cotation",
    "needs_review": "Critères needs_review",
}


def load_rules() -> list[dict]:
    if RULES_FILE.exists():
        with open(RULES_FILE, encoding="utf-8") as f:
            return json.load(f)
    # Initialise depuis les defaults
    save_rules(DEFAULT_RULES)
    return list(DEFAULT_RULES)


def save_rules(rules: list[dict]) -> None:
    RULES_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(RULES_FILE, "w", encoding="utf-8") as f:
        json.dump(rules, f, ensure_ascii=False, indent=2)


HTML_PAGE = r"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Review Corpus IDEL</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; }

  .header { background: #2563eb; color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
  .header h1 { font-size: 20px; }
  .progress-badge { background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 20px; font-size: 14px; }

  .layout { display: flex; height: calc(100vh - 56px); }

  .sidebar { width: 240px; background: white; border-right: 1px solid #e0e0e0; overflow-y: auto; flex-shrink: 0; }
  .sidebar-item { padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; transition: background 0.15s; }
  .sidebar-item:hover { background: #f0f7ff; }
  .sidebar-item.active { background: #dbeafe; font-weight: 600; }
  .sidebar-item .cat-name { font-size: 14px; }
  .sidebar-item .cat-stats { font-size: 12px; color: #888; margin-top: 2px; }
  .sidebar-item .cat-bar { height: 4px; background: #e0e0e0; border-radius: 2px; margin-top: 6px; overflow: hidden; }
  .sidebar-item .cat-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }

  .main { flex: 1; overflow-y: auto; padding: 24px; }

  .example-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .example-nav button { padding: 8px 20px; border: 1px solid #d0d0d0; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.15s; }
  .example-nav button:hover:not(:disabled) { background: #f0f7ff; border-color: #2563eb; }
  .example-nav button:disabled { opacity: 0.4; cursor: default; }
  .example-counter { font-size: 15px; font-weight: 600; }

  .card { background: white; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); padding: 20px; margin-bottom: 16px; }

  .message { margin-bottom: 14px; }
  .message:last-child { margin-bottom: 0; }
  .msg-role { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .msg-role.system { color: #888; }
  .msg-role.user { color: #2563eb; }
  .msg-role.assistant { color: #059669; }
  .msg-role.tool { color: #d97706; }
  .msg-content { font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
  .msg-content code { background: #f3f4f6; padding: 2px 5px; border-radius: 3px; font-size: 13px; }
  .msg-content pre { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; overflow-x: auto; margin: 6px 0; font-size: 13px; }
  .msg-tool-call { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; margin: 4px 0; }
  .msg-tool-name { font-weight: 600; color: #059669; font-size: 13px; }

  .verdict-section { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
  .verdict-buttons { display: flex; gap: 8px; flex-shrink: 0; }
  .verdict-btn { padding: 10px 28px; border: 2px solid #d0d0d0; background: white; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.15s; }
  .verdict-btn:hover { transform: translateY(-1px); }
  .verdict-btn.ok { border-color: #22c55e; color: #16a34a; }
  .verdict-btn.ok.selected { background: #22c55e; color: white; }
  .verdict-btn.ko { border-color: #ef4444; color: #dc2626; }
  .verdict-btn.ko.selected { background: #ef4444; color: white; }
  .comment-input { flex: 1; min-width: 250px; padding: 10px 14px; border: 1px solid #d0d0d0; border-radius: 8px; font-size: 14px; font-family: inherit; resize: vertical; min-height: 42px; }
  .comment-input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  .save-indicator { font-size: 12px; color: #22c55e; margin-top: 8px; opacity: 0; transition: opacity 0.3s; }
  .save-indicator.visible { opacity: 1; }

  .empty-state { text-align: center; padding: 60px; color: #888; }
  .empty-state h2 { font-size: 18px; margin-bottom: 8px; }

  .filter-bar { display: flex; gap: 8px; margin-bottom: 16px; }
  .filter-btn { padding: 6px 14px; border: 1px solid #d0d0d0; background: white; border-radius: 20px; cursor: pointer; font-size: 13px; transition: all 0.15s; }
  .filter-btn:hover { border-color: #2563eb; }
  .filter-btn.active { background: #2563eb; color: white; border-color: #2563eb; }

  .sidebar-section { padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #999; background: #f9f9f9; border-bottom: 1px solid #e0e0e0; cursor: default; }
  .sidebar-item.rules-link { border-left: 3px solid #f59e0b; }
  .sidebar-item.rules-link.active { border-left-color: #d97706; }

  .doc-content { font-size: 14px; line-height: 1.7; }
  .doc-content h1 { font-size: 22px; margin: 20px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e0e0e0; }
  .doc-content h2 { font-size: 18px; margin: 18px 0 10px; padding-bottom: 4px; border-bottom: 1px solid #eee; }
  .doc-content h3 { font-size: 15px; margin: 14px 0 8px; }
  .doc-content p { margin: 8px 0; }
  .doc-content pre { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; overflow-x: auto; margin: 10px 0; font-size: 13px; }
  .doc-content code { background: #f3f4f6; padding: 2px 5px; border-radius: 3px; font-size: 13px; }
  .doc-content pre code { background: none; padding: 0; }
  .doc-content ul, .doc-content ol { margin: 8px 0; padding-left: 24px; }
  .doc-content li { margin: 4px 0; }
  .doc-content table { border-collapse: collapse; margin: 10px 0; width: 100%; }
  .doc-content th, .doc-content td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
  .doc-content th { background: #f5f5f5; font-weight: 600; }
  .doc-content blockquote { border-left: 3px solid #2563eb; margin: 10px 0; padding: 8px 16px; background: #f0f7ff; color: #555; }
  .doc-content hr { border: none; border-top: 1px solid #e0e0e0; margin: 16px 0; }

  .rules-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
  .rules-toolbar h2 { font-size: 18px; }
  .btn { padding: 8px 18px; border: 1px solid #d0d0d0; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.15s; }
  .btn:hover { background: #f0f7ff; border-color: #2563eb; }
  .btn-primary { background: #2563eb; color: white; border-color: #2563eb; }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-danger { color: #dc2626; border-color: #fca5a5; }
  .btn-danger:hover { background: #fef2f2; border-color: #dc2626; }
  .btn-sm { padding: 4px 12px; font-size: 13px; }

  .rule-group { margin-bottom: 24px; }
  .rule-group-title { font-size: 14px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }

  .rule-card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); padding: 14px 18px; margin-bottom: 8px; display: flex; align-items: flex-start; gap: 14px; transition: box-shadow 0.15s; }
  .rule-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .rule-info { flex: 1; min-width: 0; }
  .rule-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
  .rule-code { background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; font-family: monospace; }
  .rule-label { font-weight: 600; font-size: 14px; }
  .rule-montant { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
  .rule-condition { font-size: 13px; color: #6b7280; margin-top: 2px; }
  .rule-desc { font-size: 13px; color: #888; margin-top: 4px; line-height: 1.4; }
  .rule-actions { display: flex; gap: 6px; flex-shrink: 0; }

  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 200; display: flex; align-items: center; justify-content: center; }
  .modal { background: white; border-radius: 12px; padding: 24px; width: 560px; max-width: 95vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
  .modal h3 { font-size: 18px; margin-bottom: 16px; }
  .form-group { margin-bottom: 14px; }
  .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: #555; }
  .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 8px 12px; border: 1px solid #d0d0d0; border-radius: 6px; font-size: 14px; font-family: inherit; }
  .form-group textarea { min-height: 70px; resize: vertical; }
  .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; }

  @media (max-width: 768px) {
    .layout { flex-direction: column; }
    .sidebar { width: 100%; height: auto; max-height: 200px; flex-direction: row; overflow-x: auto; display: flex; }
    .sidebar-item { min-width: 140px; }
    .verdict-section { flex-direction: column; }
    .comment-input { min-width: unset; width: 100%; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>Review Corpus IDEL</h1>
  <div class="progress-badge" id="global-progress">Chargement...</div>
</div>

<div class="layout">
  <div class="sidebar" id="sidebar"></div>
  <div class="main" id="main">
    <div class="empty-state">
      <h2>Bienvenue !</h2>
      <p>Choisis une catégorie à gauche pour commencer la review.</p>
    </div>
  </div>
</div>

<script>
let categories = {};
let verdicts = {};
let docsList = [];
let currentCat = null;
let currentDoc = null;
let currentIdx = 0;
let currentFilter = 'all';
let mode = 'review'; // 'review' or 'docs'

async function init() {
  const [catRes, verdRes, docsRes] = await Promise.all([
    fetch('/api/categories').then(r => r.json()),
    fetch('/api/verdicts').then(r => r.json()),
    fetch('/api/docs').then(r => r.json())
  ]);
  categories = catRes;
  verdicts = verdRes;
  docsList = docsRes;
  renderSidebar();
  updateGlobalProgress();
}

function renderSidebar() {
  const sb = document.getElementById('sidebar');
  sb.innerHTML = '';

  // Section Review
  const reviewHeader = document.createElement('div');
  reviewHeader.className = 'sidebar-section';
  reviewHeader.textContent = 'Review corpus';
  sb.appendChild(reviewHeader);

  for (const cat of Object.keys(categories)) {
    const total = categories[cat].length;
    const done = countDone(cat);
    const ok = countByVerdict(cat, 'ok');
    const ko = countByVerdict(cat, 'ko');
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const color = pct === 100 ? '#22c55e' : '#2563eb';

    const div = document.createElement('div');
    div.className = 'sidebar-item' + (mode === 'review' && cat === currentCat ? ' active' : '');
    div.innerHTML = `
      <div class="cat-name">${formatCatName(cat)}</div>
      <div class="cat-stats">${done}/${total} — ${ok} OK, ${ko} KO</div>
      <div class="cat-bar"><div class="cat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    `;
    div.onclick = () => { mode = 'review'; currentCat = cat; currentDoc = null; currentIdx = 0; currentFilter = 'all'; renderSidebar(); renderMain(); };
    sb.appendChild(div);
  }

  // Section Règles
  const rulesHeader = document.createElement('div');
  rulesHeader.className = 'sidebar-section';
  rulesHeader.textContent = 'Facturation';
  sb.appendChild(rulesHeader);

  const rulesDiv = document.createElement('div');
  rulesDiv.className = 'sidebar-item rules-link' + (mode === 'rules' ? ' active' : '');
  rulesDiv.innerHTML = '<div class="cat-name">Règles de facturation</div><div class="cat-stats">NGAP, majorations, pipeline</div>';
  rulesDiv.onclick = () => { mode = 'rules'; currentCat = null; currentDoc = null; renderSidebar(); loadRules(); };
  sb.appendChild(rulesDiv);

  // Section Docs
  if (docsList.length > 0) {
    const docsHeader = document.createElement('div');
    docsHeader.className = 'sidebar-section';
    docsHeader.textContent = 'Documentation';
    sb.appendChild(docsHeader);

    for (const doc of docsList) {
      const div = document.createElement('div');
      div.className = 'sidebar-item' + (mode === 'docs' && currentDoc === doc.path ? ' active' : '');
      div.innerHTML = `<div class="cat-name">${doc.name.replace(/-/g, ' ')}</div><div class="cat-stats">${doc.path}</div>`;
      div.onclick = () => { mode = 'docs'; currentDoc = doc.path; currentCat = null; renderSidebar(); loadDoc(doc.path); };
      sb.appendChild(div);
    }
  }
}

function renderMain() {
  const main = document.getElementById('main');
  if (!currentCat || !categories[currentCat]) {
    main.innerHTML = '<div class="empty-state"><h2>Choisis une catégorie</h2></div>';
    return;
  }

  const examples = getFilteredExamples();
  if (examples.length === 0) {
    main.innerHTML = `<div class="filter-bar">${renderFilters()}</div><div class="empty-state"><h2>Aucun exemple</h2><p>Aucun exemple ne correspond au filtre sélectionné.</p></div>`;
    bindFilters();
    return;
  }

  if (currentIdx >= examples.length) currentIdx = examples.length - 1;
  if (currentIdx < 0) currentIdx = 0;

  const realIdx = examples[currentIdx].realIdx;
  const ex = examples[currentIdx].data;
  const key = `${currentCat}:${realIdx}`;
  const v = verdicts[key] || {};

  let html = `<div class="filter-bar">${renderFilters()}</div>`;

  html += `<div class="example-nav">
    <button onclick="nav(-1)" ${currentIdx === 0 ? 'disabled' : ''}>&larr; Précédent</button>
    <span class="example-counter">${currentIdx + 1} / ${examples.length}</span>
    <button onclick="nav(1)" ${currentIdx === examples.length - 1 ? 'disabled' : ''}>Suivant &rarr;</button>
  </div>`;

  html += '<div class="card">';
  for (const msg of (ex.messages || [])) {
    html += renderMessage(msg);
  }
  html += '</div>';

  html += `<div class="card">
    <div class="verdict-section">
      <div class="verdict-buttons">
        <button class="verdict-btn ok ${v.verdict === 'ok' ? 'selected' : ''}" onclick="setVerdict('${key}', 'ok')">OK</button>
        <button class="verdict-btn ko ${v.verdict === 'ko' ? 'selected' : ''}" onclick="setVerdict('${key}', 'ko')">KO</button>
      </div>
      <textarea class="comment-input" id="comment-input" placeholder="Commentaire (optionnel)..." oninput="saveComment('${key}', this.value)">${v.comment || ''}</textarea>
    </div>
    <div class="save-indicator" id="save-indicator">Sauvegardé ✓</div>
  </div>`;

  main.innerHTML = html;
  main.scrollTop = 0;
  bindFilters();
}

function renderFilters() {
  const all = categories[currentCat].length;
  const done = countDone(currentCat);
  const pending = all - done;
  return `
    <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Tous (${all})</button>
    <button class="filter-btn ${currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">À faire (${pending})</button>
    <button class="filter-btn ${currentFilter === 'ok' ? 'active' : ''}" data-filter="ok">OK (${countByVerdict(currentCat, 'ok')})</button>
    <button class="filter-btn ${currentFilter === 'ko' ? 'active' : ''}" data-filter="ko">KO (${countByVerdict(currentCat, 'ko')})</button>
  `;
}

function bindFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => { currentFilter = btn.dataset.filter; currentIdx = 0; renderMain(); };
  });
}

function getFilteredExamples() {
  const all = categories[currentCat] || [];
  const result = [];
  for (let i = 0; i < all.length; i++) {
    const key = `${currentCat}:${i}`;
    const v = verdicts[key];
    if (currentFilter === 'all' ||
        (currentFilter === 'pending' && !v) ||
        (currentFilter === 'ok' && v && v.verdict === 'ok') ||
        (currentFilter === 'ko' && v && v.verdict === 'ko')) {
      result.push({ realIdx: i, data: all[i] });
    }
  }
  return result;
}

function renderMessage(msg) {
  const role = msg.role || '?';
  let html = `<div class="message"><div class="msg-role ${role}">${roleLabel(role)}</div>`;

  if (role === 'system') {
    html += '<div class="msg-content" style="color:#888;font-style:italic">(prompt système)</div>';
  } else if (role === 'assistant' && msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      const fn = tc.function || {};
      let args = fn.arguments || '{}';
      try { args = JSON.stringify(JSON.parse(args), null, 2); } catch(e) {}
      html += `<div class="msg-tool-call"><div class="msg-tool-name">→ ${fn.name || '?'}</div><pre>${escapeHtml(args)}</pre></div>`;
    }
    if (msg.content) html += `<div class="msg-content">${escapeHtml(msg.content)}</div>`;
  } else if (role === 'tool') {
    let content = msg.content || '';
    try { content = JSON.stringify(JSON.parse(content), null, 2); } catch(e) {}
    html += `<pre>${escapeHtml(content)}</pre>`;
  } else {
    html += `<div class="msg-content">${escapeHtml(msg.content || '')}</div>`;
  }

  html += '</div>';
  return html;
}

function roleLabel(r) {
  return { system: 'Système', user: 'IDEL (question)', assistant: 'Agent IA', tool: 'Résultat outil' }[r] || r;
}

function escapeHtml(s) {
  if (s == null) return '';
  if (typeof s !== 'string') s = JSON.stringify(s, null, 2);
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatCatName(cat) {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function loadDoc(path) {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="empty-state"><h2>Chargement...</h2></div>';
  const res = await fetch('/api/docs/' + encodeURIComponent(path));
  if (!res.ok) {
    main.innerHTML = '<div class="empty-state"><h2>Erreur</h2><p>Impossible de charger ce fichier.</p></div>';
    return;
  }
  const text = await res.text();
  main.innerHTML = '<div class="card doc-content">' + renderMarkdown(text) + '</div>';
  main.scrollTop = 0;
}

function renderMarkdown(md) {
  let html = escapeHtml(md);
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => '<pre><code>' + code.trim() + '</code></pre>');
  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // HR
  html = html.replace(/^---$/gm, '<hr>');
  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => '<ul>' + m + '</ul>');
  // Paragraphs (double newline)
  html = html.replace(/\n\n+/g, '</p><p>');
  html = '<p>' + html + '</p>';
  // Clean up empty paragraphs around block elements
  html = html.replace(/<p>\s*(<h[1-4]>)/g, '$1');
  html = html.replace(/(<\/h[1-4]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<hr>)/g, '$1');
  html = html.replace(/(<hr>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*<\/p>/g, '');
  return html;
}

function nav(delta) {
  currentIdx += delta;
  renderMain();
}

async function setVerdict(key, verdict) {
  if (!verdicts[key]) verdicts[key] = {};
  verdicts[key].verdict = verdict;
  await saveToServer();
  renderMain();
  renderSidebar();
  updateGlobalProgress();
  // Auto-avance après verdict
  if (currentFilter === 'pending') {
    // Reste sur le même index (l'élément courant disparaît du filtre)
    renderMain();
  }
}

let commentTimeout = null;
function saveComment(key, comment) {
  if (!verdicts[key]) verdicts[key] = {};
  verdicts[key].comment = comment;
  clearTimeout(commentTimeout);
  commentTimeout = setTimeout(async () => {
    await saveToServer();
    const ind = document.getElementById('save-indicator');
    if (ind) { ind.classList.add('visible'); setTimeout(() => ind.classList.remove('visible'), 1500); }
  }, 500);
}

async function saveToServer() {
  await fetch('/api/verdicts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(verdicts)
  });
}

function countDone(cat) {
  let n = 0;
  const total = (categories[cat] || []).length;
  for (let i = 0; i < total; i++) {
    if (verdicts[`${cat}:${i}`]) n++;
  }
  return n;
}

function countByVerdict(cat, v) {
  let n = 0;
  const total = (categories[cat] || []).length;
  for (let i = 0; i < total; i++) {
    const vd = verdicts[`${cat}:${i}`];
    if (vd && vd.verdict === v) n++;
  }
  return n;
}

function updateGlobalProgress() {
  let total = 0, done = 0;
  for (const cat of Object.keys(categories)) {
    total += categories[cat].length;
    done += countDone(cat);
  }
  document.getElementById('global-progress').textContent = `${done} / ${total} reviewés`;
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft') nav(-1);
  if (e.key === 'ArrowRight') nav(1);
  if (e.key === 'o' || e.key === 'O') {
    const examples = getFilteredExamples();
    if (examples.length > 0) setVerdict(`${currentCat}:${examples[currentIdx].realIdx}`, 'ok');
  }
  if (e.key === 'k' || e.key === 'K') {
    const examples = getFilteredExamples();
    if (examples.length > 0) setVerdict(`${currentCat}:${examples[currentIdx].realIdx}`, 'ko');
  }
});

// --- Rules management ---
let rulesData = [];
const RULE_CATEGORIES = {
  majoration_horaire: 'Majorations horaires',
  majoration_acte: 'Majorations actes',
  indemnite: 'Indemnités de déplacement',
  pipeline: 'Pipeline de cotation',
  needs_review: 'Critères needs_review'
};

async function loadRules() {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="empty-state"><h2>Chargement...</h2></div>';
  rulesData = await fetch('/api/rules').then(r => r.json());
  renderRules();
}

function renderRules() {
  const main = document.getElementById('main');
  let html = '<div class="rules-toolbar"><h2>Règles de facturation NGAP</h2>';
  html += '<button class="btn btn-primary" onclick="openRuleModal()">+ Nouvelle règle</button></div>';

  for (const [catKey, catLabel] of Object.entries(RULE_CATEGORIES)) {
    const catRules = rulesData.filter(r => r.category === catKey);
    if (catRules.length === 0) continue;

    html += `<div class="rule-group"><div class="rule-group-title">${catLabel} (${catRules.length})</div>`;
    for (const rule of catRules) {
      const montantBadge = rule.montant ? `<span class="rule-montant">${rule.montant} €</span>` : '';
      html += `<div class="rule-card">
        <div class="rule-info">
          <div class="rule-header">
            <span class="rule-code">${escapeHtml(rule.code)}</span>
            <span class="rule-label">${escapeHtml(rule.label)}</span>
            ${montantBadge}
          </div>
          <div class="rule-condition">${escapeHtml(rule.condition)}</div>
          <div class="rule-desc">${escapeHtml(rule.description)}</div>
        </div>
        <div class="rule-actions">
          <button class="btn btn-sm" onclick="openRuleModal('${rule.id}')">Modifier</button>
          <button class="btn btn-sm btn-danger" onclick="deleteRule('${rule.id}')">Supprimer</button>
        </div>
      </div>`;
    }
    html += '</div>';
  }

  // Règles sans catégorie connue
  const uncategorized = rulesData.filter(r => !RULE_CATEGORIES[r.category]);
  if (uncategorized.length > 0) {
    html += '<div class="rule-group"><div class="rule-group-title">Autres</div>';
    for (const rule of uncategorized) {
      const montantBadge = rule.montant ? `<span class="rule-montant">${rule.montant} €</span>` : '';
      html += `<div class="rule-card">
        <div class="rule-info">
          <div class="rule-header"><span class="rule-code">${escapeHtml(rule.code)}</span><span class="rule-label">${escapeHtml(rule.label)}</span>${montantBadge}</div>
          <div class="rule-condition">${escapeHtml(rule.condition)}</div>
          <div class="rule-desc">${escapeHtml(rule.description)}</div>
        </div>
        <div class="rule-actions">
          <button class="btn btn-sm" onclick="openRuleModal('${rule.id}')">Modifier</button>
          <button class="btn btn-sm btn-danger" onclick="deleteRule('${rule.id}')">Supprimer</button>
        </div>
      </div>`;
    }
    html += '</div>';
  }

  main.innerHTML = html;
  main.scrollTop = 0;
}

function openRuleModal(ruleId) {
  const existing = ruleId ? rulesData.find(r => r.id === ruleId) : null;
  const title = existing ? 'Modifier la règle' : 'Nouvelle règle';
  const r = existing || { id: '', category: 'majoration_horaire', code: '', label: '', montant: '', condition: '', description: '' };

  let catOptions = '';
  for (const [k, v] of Object.entries(RULE_CATEGORIES)) {
    catOptions += `<option value="${k}" ${r.category === k ? 'selected' : ''}>${v}</option>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `<div class="modal">
    <h3>${title}</h3>
    <div class="form-group"><label>Catégorie</label><select id="rf-category">${catOptions}</select></div>
    <div class="form-group"><label>Code NGAP</label><input id="rf-code" value="${escapeHtml(r.code)}" placeholder="Ex: MAU, IK, ART_11..."></div>
    <div class="form-group"><label>Libellé</label><input id="rf-label" value="${escapeHtml(r.label)}" placeholder="Nom lisible de la règle"></div>
    <div class="form-group"><label>Montant (€) — laisser vide si non applicable</label><input id="rf-montant" value="${escapeHtml(r.montant)}" placeholder="Ex: 5.00"></div>
    <div class="form-group"><label>Condition d'application</label><input id="rf-condition" value="${escapeHtml(r.condition)}" placeholder="Quand cette règle s'applique"></div>
    <div class="form-group"><label>Description détaillée</label><textarea id="rf-description" placeholder="Explications, cas particuliers...">${escapeHtml(r.description)}</textarea></div>
    <div class="modal-actions">
      <button class="btn" onclick="this.closest('.modal-overlay').remove()">Annuler</button>
      <button class="btn btn-primary" onclick="saveRule('${ruleId || ''}')">Enregistrer</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#rf-code').focus();
}

async function saveRule(existingId) {
  const rule = {
    id: existingId || 'rule_' + Date.now(),
    category: document.getElementById('rf-category').value,
    code: document.getElementById('rf-code').value.trim(),
    label: document.getElementById('rf-label').value.trim(),
    montant: document.getElementById('rf-montant').value.trim(),
    condition: document.getElementById('rf-condition').value.trim(),
    description: document.getElementById('rf-description').value.trim(),
  };

  if (!rule.code || !rule.label) {
    alert('Le code et le libellé sont obligatoires.');
    return;
  }

  if (existingId) {
    const idx = rulesData.findIndex(r => r.id === existingId);
    if (idx !== -1) rulesData[idx] = rule;
  } else {
    rulesData.push(rule);
  }

  await fetch('/api/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rulesData)
  });

  document.querySelector('.modal-overlay').remove();
  renderRules();
}

async function deleteRule(ruleId) {
  const rule = rulesData.find(r => r.id === ruleId);
  if (!rule) return;
  if (!confirm(`Supprimer la règle "${rule.label}" (${rule.code}) ?`)) return;

  rulesData = rulesData.filter(r => r.id !== ruleId);
  await fetch('/api/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rulesData)
  });
  renderRules();
}

init();
</script>
</body>
</html>
"""


class ReviewHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/" or path == "":
            self._respond(200, "text/html", HTML_PAGE.encode())
        elif path == "/api/categories":
            # Envoie juste la structure (sans les données lourdes inutiles)
            self._respond(200, "application/json", json.dumps(CATEGORIES, ensure_ascii=False).encode())
        elif path == "/api/verdicts":
            self._respond(200, "application/json", json.dumps(load_verdicts(), ensure_ascii=False).encode())
        elif path == "/api/docs":
            self._respond(200, "application/json", json.dumps(list_docs(), ensure_ascii=False).encode())
        elif path == "/api/rules":
            self._respond(200, "application/json", json.dumps(load_rules(), ensure_ascii=False).encode())
        elif path.startswith("/api/docs/"):
            rel_path = unquote(path[len("/api/docs/"):])
            content = read_doc(rel_path)
            if content is not None:
                self._respond(200, "text/plain", content.encode())
            else:
                self._respond(404, "text/plain", b"Not found")
        else:
            self._respond(404, "text/plain", b"Not found")

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/rules":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                rules = json.loads(body)
                save_rules(rules)
                self._respond(200, "application/json", b'{"ok":true}')
            except json.JSONDecodeError:
                self._respond(400, "application/json", b'{"error":"invalid json"}')
        elif path == "/api/verdicts":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                verdicts = json.loads(body)
                save_verdicts(verdicts)
                self._respond(200, "application/json", b'{"ok":true}')
            except json.JSONDecodeError:
                self._respond(400, "application/json", b'{"error":"invalid json"}')
        else:
            self._respond(404, "text/plain", b"Not found")

    def _respond(self, code, content_type, body):
        self.send_response(code)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # Silencieux


def main():
    if not RAW_DIR.exists():
        print(f"ERREUR: Dossier introuvable : {RAW_DIR}")
        print("Lance d'abord la génération du corpus.")
        sys.exit(1)

    n_cats = len(CATEGORIES)
    n_total = sum(len(v) for v in CATEGORIES.values())
    v = load_verdicts()
    n_done = len(v)

    print(f"Review Corpus IDEL")
    print(f"  {n_cats} catégories, {n_total} exemples ({SAMPLE_SIZE}/catégorie)")
    print(f"  {n_done} déjà reviewés")
    print(f"  Verdicts sauvegardés dans : {VERDICTS_FILE}")
    print(f"\n  → http://localhost:{PORT}")
    print(f"\n  Raccourcis clavier : O = OK, K = KO, ← → = navigation")
    print(f"  Ctrl+C pour arrêter\n")

    server = HTTPServer(("0.0.0.0", PORT), ReviewHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
        server.server_close()


if __name__ == "__main__":
    main()
