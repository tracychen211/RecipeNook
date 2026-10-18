/* Recipe Nook — smart paste parser.
   Turns messy pasted text (reel captions, texts from Mom, blog copy) into a recipe draft.
   Runs entirely on the phone: no internet, no API. */
(function (root) {
  'use strict';

  const FRAC = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
  function normFrac(s) {
    return String(s).replace(/(\d?)([½⅓⅔¼¾⅛⅜⅝⅞])/g, (m, d, f) => (d ? d + ' ' : '') + FRAC[f]);
  }

  const UNIT_RE = '(?:cups?|c\\.|tablespoons?|tbsps?|tbs|tbl|teaspoons?|tsps?|ounces?|oz|pounds?|lbs?|grams?|g|kilograms?|kg|ml|milliliters?|liters?|litres?|l|cloves?|pinch(?:es)?|dash(?:es)?|cans?|stalks?|slices?|pieces?|sticks?|bunch(?:es)?|handfuls?|sprigs?|inch(?:es)?|heads?|knobs?|thumbs?|packets?|packages?|pkgs?|bags?|jars?|bottles?|sheets?|drops?|quarts?|pints?|fl\\.? ?oz)';
  const NUM_RE = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?(?:\\s*(?:-|–|to)\\s*\\d+(?:\\.\\d+)?)?)';
  const QTY_START = new RegExp('^(' + NUM_RE + ')\\s*(' + UNIT_RE + ')?\\b\\.?\\s*(?:of\\s+)?', 'i');
  const WORD_QTY = new RegExp('^(?:a|an|one|two|three|four|five|six|half(?: an?)?)\\s+(?:' + UNIT_RE + '|little(?: bit)?|bit|few)\\b\\.?\\s*(?:of\\s+)?', 'i');
  const QTY_ANY = new RegExp('\\b' + NUM_RE + '\\s*' + UNIT_RE + '\\b', 'i');
  const QTY_END = new RegExp('[\\s,(:\\-–]+(' + NUM_RE + '\\s*(?:' + UNIT_RE + ')?)\\.?\\)?\\s*$', 'i');
  const LOOSE_RE = /\b(to taste|a pinch(?: of)?|pinch of|a dash(?: of)?|dash of|a splash(?: of)?|splash of|a handful(?: of)?|handful of|a drizzle(?: of)?|drizzle of|a bit(?: of)?|(?:a )?little(?: bit)?(?: of)?|some|as needed|for garnish|to garnish|to serve|for serving|optional)\b/i;

  const VERBS = 'add|mix|stir|whisk|combine|bake|cook|sear|fry|pan-fry|stir-fry|saute|sauté|simmer|boil|heat|preheat|pour|fold|chop|slice|dice|mince|toss|serve|season|marinate|blend|beat|knead|roll|cut|place|put|transfer|remove|take|let|leave|cover|uncover|drain|rinse|wash|peel|grate|spread|top|sprinkle|garnish|bring|reduce|melt|brown|flip|turn|steam|roast|grill|broil|chill|refrigerate|freeze|rest|cool|line|grease|prepare|microwave|air-fry|plate|shape|form|wrap|fill|squeeze|scoop|dip|coat|dredge|stuff|soak|massage|smash|crack|separate|sift|layer|arrange|dissolve|deglaze|scramble|whip|cream|pat|trim|score|blanch|braise|poach|toast|char|caramelize|thicken|taste|adjust|enjoy|eat|store|keep|use|start|finish|repeat|continue|wait|set|make|throw|drop|lower|increase|stir-fry';
  const VERB_START = new RegExp('^(?:(?:first|then|next|now|finally|after that|afterwards|once done|lastly|and)[,]?\\s+)*(?:' + VERBS + ')\\b', 'i');

  const FOOD = ('chicken|beef|pork|lamb|turkey|bacon|sausage|ham|shrimp|prawn|salmon|fish|tuna|cod|tofu|tempeh|egg|eggs|rice|noodle|noodles|pasta|spaghetti|udon|ramen|flour|sugar|salt|pepper|butter|oil|garlic|ginger|onion|onions|scallion|scallions|shallot|leek|carrot|carrots|celery|potato|potatoes|tomato|tomatoes|cabbage|bok choy|spinach|lettuce|kale|broccoli|cauliflower|mushroom|mushrooms|zucchini|eggplant|cucumber|corn|peas|beans|chickpeas|lentils|bell pepper|chili|chilli|jalapeno|cilantro|parsley|basil|mint|thyme|rosemary|oregano|dill|lemon|lime|orange|apple|banana|berries|strawberries|blueberries|milk|cream|cheese|parmesan|mozzarella|cheddar|yogurt|soy sauce|oyster sauce|fish sauce|hoisin|gochujang|miso|sriracha|vinegar|honey|maple syrup|mayo|mayonnaise|ketchup|mustard|sesame|sesame oil|cornstarch|baking soda|baking powder|yeast|vanilla|cinnamon|nutmeg|paprika|cumin|turmeric|curry|chocolate|chocolate chips|cocoa|oats|nuts|peanuts|almonds|walnuts|coconut|coconut milk|broth|stock|water|wine|sake|mirin|dashi|kimchi|seaweed|nori|bread|tortilla|wonton wrappers|dumpling wrappers|rock sugar|star anise|five spice|msg|chili flakes|red pepper flakes|panko|breadcrumbs').split('|');
  const FOOD_RE = new RegExp('\\b(?:' + FOOD.map(f => f.replace(/ /g, '\\s+')).join('|') + ')\\b', 'i');

  const JUNK = /(follow (me|for|along)|link in (my )?bio|save (this|it|for later)|like (and|&) (save|share)|comment ['"“]?\w+|share (this|with)|tag (a|someone|your)|subscribe|notifications|full recipe (on|at|in|below)|recipe (on|at|in) (my )?(blog|bio|website)|dm me|check out|swipe|sound on|you guys|\bomg\b|obsessed|game ?changer|so good|must try|try this|changed my life|go-to|you need to|literally|can't stop|cannot stop|i love|i'm|im so|let me know|who else|day \d+ of)/i;

  const DEFAULTS = [
    ['garlic', '2 cloves'], ['ginger', '1 inch'], ['soy sauce', '1 tbsp'], ['oyster sauce', '1 tbsp'], ['fish sauce', '1 tsp'],
    ['sesame oil', '1 tsp'], ['olive oil', '1 tbsp'], ['oil', '1 tbsp'], ['butter', '1 tbsp'], ['vinegar', '1 tbsp'], ['honey', '1 tbsp'],
    ['brown sugar', '1 tbsp'], ['sugar', '1 tsp'], ['cornstarch', '1 tbsp'], ['scallion', '2 stalks'], ['green onion', '2 stalks'],
    ['onion', '1'], ['egg', '2'], ['rice', '1 cup'], ['lemon', '1'], ['lime', '1'], ['chili flakes', '1/2 tsp'], ['red pepper flakes', '1/2 tsp'],
    ['vanilla', '1 tsp'], ['baking soda', '1 tsp'], ['baking powder', '1 tsp'], ['cinnamon', '1 tsp'], ['milk', '1 cup'], ['flour', '1 cup'],
    ['cilantro', 'a handful'], ['parsley', 'a handful'], ['basil', 'a handful'], ['mirin', '1 tbsp'], ['gochujang', '1 tbsp']
  ];
  const TO_TASTE = /^(salt|pepper|black pepper|salt and pepper|salt & pepper|white pepper|msg)$/i;

  function cap(s) { s = String(s).trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; }
  function words(s) { return String(s).trim().split(/\s+/).filter(Boolean).length; }
  function startsVerb(s) { return VERB_START.test(stripNum(s)); }
  function stripNum(s) { return String(s).replace(/^\s*(?:step\s*)?\d{1,2}\s*[:.)\-–]\s*/i, '').trim(); }
  function hasQty(s) { s = s.trim(); return QTY_START.test(s) || WORD_QTY.test(s) || QTY_ANY.test(s); }
  function looksIng(s) {
    s = s.trim();
    if (!s || words(s) > 9) return false;
    if (startsVerb(s) && !QTY_START.test(s)) return false;
    return QTY_START.test(s) || WORD_QTY.test(s) || LOOSE_RE.test(s) || (words(s) <= 5 && FOOD_RE.test(s));
  }

  function parseIng(line) {
    let s = normFrac(line).replace(/^[\s\-–•*·▪●○◦>+✔✓☐□]+/, '').replace(/\s+/g, ' ').trim();
    let qty = '', name = s, loose = false, m;
    if ((m = s.match(QTY_START)) && m[0].trim()) {
      qty = (m[1] + (m[2] ? ' ' + m[2] : '')).replace(/\s+/g, ' ').trim();
      name = s.slice(m[0].length);
    } else if ((m = s.match(WORD_QTY))) {
      qty = m[0].replace(/\s+of\s*$/i, '').trim();
      name = s.slice(m[0].length);
      loose = /pinch|dash|splash|handful|drizzle|little|bit|few/i.test(qty);
    } else if ((m = s.match(QTY_END)) && /\d/.test(m[1])) {
      qty = m[1].trim();
      name = s.slice(0, m.index);
    }
    if (!qty && (m = name.match(LOOSE_RE))) {
      qty = m[1].toLowerCase().replace(/\s+of$/, '');
      loose = true;
      name = (name.slice(0, m.index) + ' ' + name.slice(m.index + m[0].length));
    }
    if (/^little/i.test(qty)) qty = 'a ' + qty;
    name = name.replace(/\(\s*[\d~≈][^)]*\)/g, '').replace(/\(\s*\)/g, '').replace(/^[\s,:;\-–]+|[\s,.;:\-–]+$/g, '').replace(/\s{2,}/g, ' ');
    return { qty: qty, name: cap(name), loose: loose, guess: false };
  }

  function fmtMin(n) {
    if (!n) return '';
    const h = Math.floor(n / 60), mm = Math.round(n % 60);
    return h ? (h + ' hr' + (mm ? ' ' + mm + ' min' : '')) : mm + ' min';
  }

  function parseRecipe(raw, linkIn) {
    const out = { name: '', ingredients: [], steps: [], tips: [], servings: '', time: '', section: 'cooking', link: linkIn || '', guesses: 0 };
    let t = normFrac(String(raw || '')).replace(/\r/g, '');
    const urls = t.match(/https?:\/\/[^\s)]+/g);
    if (urls && !out.link) out.link = urls[0];
    t = t.replace(/https?:\/\/[^\s)]+/g, ' ')
      .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, ' ')
      .replace(/(^|\s)@[\w.]+/g, ' ')
      .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, ' ');

    let m;
    if ((m = t.match(/\b(?:serves|servings?|makes|yields?|feeds)\s*:?\s*(\d+(?:\s*(?:-|–|to)\s*\d+)?)/i))) out.servings = m[1].replace(/\s+/g, '');
    if ((m = t.match(/\b(?:total(?: time)?|ready in|takes(?: about| only| just)?)\s*:?\s*(\d+)\s*(min|mins|minutes|hrs?|hours?)\b/i))) {
      out.time = fmtMin(/h/i.test(m[2]) ? +m[1] * 60 : +m[1]);
    } else {
      let sum = 0; const re = /(\d+)\s*(?:-|–|to)?\s*(\d+)?\s*(min|mins|minutes|hrs?|hours?)\b/gi; let x;
      while ((x = re.exec(t))) { const n = +(x[2] || x[1]); sum += /h/i.test(x[3]) ? n * 60 : n; }
      if (sum) out.time = '~' + fmtMin(sum);
    }
    const bakeHits = (t.match(/\b(bake|baking|oven|preheat|flour|cookies?|cakes?|muffins?|bread|dough|batter|brownies?|loaf|frosting|cupcakes?|pastry|tart|pie crust)\b|\d{3}\s*°?\s*[fc]\b|°\s*[fc]\b/gi) || []).length;
    if (bakeHits >= 2) out.section = 'baking';

    const lines = t.split(/\n+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    let mode = null;

    function addIngText(text) {
      text = text.replace(/^(?:ingredients?|you(?:'|’)?ll need|you need|what you need)\s*:?\s*/i, '').replace(/[.!]+$/, '').trim();
      if (!text) return;
      let pieces = text.split(/\s*[,;]\s*|\s+\+\s+/).filter(Boolean);
      const ingLike = pieces.filter(p => looksIng(p)).length;
      if (pieces.length > 1 && ingLike >= 2) {
        let prev = null;
        pieces.forEach(p => {
          if (looksIng(p) || !prev) { prev = parseIng(p); if (prev.name) out.ingredients.push(prev); }
          else { prev.name = cap(prev.name + ', ' + p.toLowerCase()); }
        });
      } else {
        const ing = parseIng(text);
        if (ing.name) out.ingredients.push(ing);
      }
    }
    function addStepText(text) {
      text = stripNum(text);
      const sents = text.split(/(?<=[.!?])\s+(?=[A-Za-z0-9"“])/);
      if (sents.length > 1) { sents.forEach(addStepText); return; }
      if (!text || JUNK.test(text) && !startsVerb(text)) return;
      if (/^(done|enjoy|voila|voilà|yum|yummy|that'?s it|easy|so easy)\W*$/i.test(text)) return;
      if (maybeTip(text)) return;
      const pieces = text.split(/\s*,\s*(?:and\s+)?(?:then\s+)?|\s+then\s+|\s*;\s*/i).filter(Boolean);
      let cur = '';
      pieces.forEach(p => {
        if (cur && startsVerb(p) && words(cur) >= 2) { pushStep(cur); cur = p; }
        else cur = cur ? cur + ', ' + p : p;
      });
      if (cur) pushStep(cur);
    }
    function pushStep(s) {
      s = cap(s.replace(/^(?:and|then|next|now)[,]?\s+/i, '').trim());
      if (!s) return;
      if (!/[.!?]$/.test(s)) s += '.';
      out.steps.push(s);
    }
    function maybeTip(s) {
      const tm = s.match(/^(?:tips?|notes?|pro tip|hint)\s*[:\-–]\s*(.+)$/i);
      if (tm) { out.tips.push(cap(tm[1])); return true; }
      if (/^(make sure|don'?t|do not|be careful|important|the secret|the key|the trick)\b/i.test(s)) { out.tips.push(cap(s.replace(/[.!]*$/, '.'))); return true; }
      return false;
    }
    function classifySentence(s) {
      s = s.trim();
      if (!s) return;
      if (/^(?:serves|servings?|makes|yields?|feeds|total|prep|cook)(?: time)?\s*:?\s*\d/i.test(s)) return;
      const pre = s.match(/^([^:]{1,25}):\s+(.+)$/);
      if (pre && !/^\d/.test(pre[1])) {
        if (/^(tips?|notes?|pro tip|hint)$/i.test(pre[1].trim())) { out.tips.push(cap(pre[2])); return; }
        if (/^(ingredients?|you(?:'|’)?ll need|you need|what you need)$/i.test(pre[1].trim())) { addIngText(pre[2]); return; }
        if (/^(directions?|instructions?|method|steps|how to make(?: it)?)$/i.test(pre[1].trim())) { addStepText(pre[2]); return; }
        s = pre[2];
      }
      if (maybeTip(s)) return;
      if (startsVerb(s)) { addStepText(s); return; }
      const pieces = s.replace(/[.!]+$/, '').split(/\s*,\s*/);
      if (hasQty(s) || pieces.filter(p => looksIng(p)).length >= 2 || looksIng(s)) { addIngText(s); return; }
      if (JUNK.test(s)) return;
      if (!out.name && !out.ingredients.length && words(s) <= 8 && FOOD_RE.test(s) && !/\d/.test(s)) {
        out.name = cap(s.replace(/[.!?:]+$/, '').replace(/\s*recipe\s*$/i, ''));
      }
    }

    lines.forEach((line, idx) => {
      const hIng = line.match(/^(?:ingredients?|you(?:'|’)?ll need|what you(?:'|’)?ll need|what you need|shopping list)\s*(?::\s*(.*))?$/i);
      const hStep = line.match(/^(?:directions?|instructions?|method|steps|how to make(?: it)?|preparation)\s*(?::\s*(.*))?$/i);
      const hTip = line.match(/^(?:tips?|notes?|pro tips?)\s*(?::\s*(.*))?$/i);
      if (hIng) { mode = 'ing'; if (hIng[1]) addIngText(hIng[1]); return; }
      if (hStep) { mode = 'step'; if (hStep[1]) addStepText(hStep[1]); return; }
      if (hTip) { mode = 'tip'; if (hTip[1]) out.tips.push(cap(hTip[1])); return; }
      if (/^[^:.!?]{2,30}:$/.test(line)) return; /* sub-header like "For the sauce:" */

      if (idx === 0 && !out.name && words(line) <= 8 && !hasQty(line) && (!startsVerb(line) || FOOD_RE.test(line)) && !JUNK.test(line) && !/[.!?,]/.test(line.slice(0, -1))) {
        out.name = cap(line.replace(/[.!?:]+$/, '').replace(/\s*recipe\s*$/i, ''));
        return;
      }
      if (mode === 'ing') {
        if (startsVerb(line) && !QTY_START.test(line) && words(line) > 3) { mode = 'step'; addStepText(line); }
        else if (!JUNK.test(line) || hasQty(line)) addIngText(line);
        return;
      }
      if (mode === 'step') { if (!maybeTip(stripNum(line))) addStepText(line); return; }
      if (mode === 'tip') { out.tips.push(cap(line)); return; }
      line.split(/(?<=[.!?])\s+(?=[A-Za-z0-9"“])/).forEach(classifySentence);
    });

    /* fill in guesses for missing amounts */
    out.ingredients.forEach(g => {
      if (g.qty) return;
      if (TO_TASTE.test(g.name)) { g.qty = 'to taste'; g.loose = true; return; }
      const low = g.name.toLowerCase();
      const d = DEFAULTS.find(([k]) => low.includes(k));
      g.qty = d ? d[1] : '';
      g.guess = true;
      if (d && /handful|pinch/.test(d[1])) g.loose = true;
      out.guesses++;
    });
    return out;
  }

  /* ---------- grams <-> cups ---------- */
  const UNITS = {
    cup: { k: 'v', ml: 240 }, cups: { k: 'v', ml: 240 }, c: { k: 'v', ml: 240 },
    tbsp: { k: 'v', ml: 15 }, tbsps: { k: 'v', ml: 15 }, tbs: { k: 'v', ml: 15 }, tbl: { k: 'v', ml: 15 }, tablespoon: { k: 'v', ml: 15 }, tablespoons: { k: 'v', ml: 15 },
    tsp: { k: 'v', ml: 5 }, tsps: { k: 'v', ml: 5 }, teaspoon: { k: 'v', ml: 5 }, teaspoons: { k: 'v', ml: 5 },
    ml: { k: 'v', ml: 1 }, milliliter: { k: 'v', ml: 1 }, milliliters: { k: 'v', ml: 1 }, l: { k: 'v', ml: 1000 }, liter: { k: 'v', ml: 1000 }, liters: { k: 'v', ml: 1000 },
    g: { k: 'w', g: 1 }, gram: { k: 'w', g: 1 }, grams: { k: 'w', g: 1 }, kg: { k: 'w', g: 1000 }, kilogram: { k: 'w', g: 1000 }, kilograms: { k: 'w', g: 1000 },
    oz: { k: 'w', g: 28.35 }, ounce: { k: 'w', g: 28.35 }, ounces: { k: 'w', g: 28.35 },
    lb: { k: 'w', g: 453.6 }, lbs: { k: 'w', g: 453.6 }, pound: { k: 'w', g: 453.6 }, pounds: { k: 'w', g: 453.6 }
  };
  /* grams per cup, most specific first */
  const DENS = [
    [/bread flour/, 127], [/cake flour/, 114], [/almond flour|almond meal/, 96], [/whole wheat flour/, 120], [/rice flour/, 158], [/flour/, 120],
    [/brown sugar/, 213], [/powdered sugar|icing sugar|confectioners/, 120], [/sugar/, 200],
    [/peanut butter/, 258], [/butter/, 227], [/heavy cream|whipping cream|double cream/, 238], [/sour cream/, 230], [/cream cheese/, 232],
    [/coconut milk/, 226], [/milk/, 245], [/yogurt|yoghurt/, 245], [/water|broth|stock/, 240],
    [/oil/, 218], [/honey/, 340], [/maple syrup/, 315], [/molasses/, 328],
    [/rice/, 185], [/rolled oats|oats/, 90], [/cocoa/, 85], [/cornstarch|corn starch/, 128], [/chocolate chips|choc chips/, 170],
    [/baking soda/, 230], [/baking powder/, 192], [/salt/, 288], [/shredded cheese|grated cheese|parmesan/, 100], [/panko|breadcrumbs/, 60]
  ];
  function toNum(s) {
    s = normFrac(s).trim();
    let m;
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)/))) return +m[1] + m[2] / m[3];
    if ((m = s.match(/^(\d+)\/(\d+)/))) return m[1] / m[2];
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/))) return (+m[1] + +m[2]) / 2;
    if ((m = s.match(/^(\d+(?:\.\d+)?)/))) return +m[1];
    return NaN;
  }
  function niceFrac(x) {
    const q = Math.round(x * 4) / 4;
    const w = Math.floor(q), f = q - w;
    const fs = f === 0.25 ? '1/4' : f === 0.5 ? '1/2' : f === 0.75 ? '3/4' : '';
    if (!w && !fs) return '';
    return (w ? w : '') + (w && fs ? ' ' : '') + fs;
  }
  function convert(ing, mode) {
    if (!ing || mode === 'as' || ing.loose || !ing.qty) return null;
    const q = normFrac(ing.qty).trim();
    const m = q.match(/^((?:\d+\s+\d+\/\d+)|(?:\d+\/\d+)|(?:\d+(?:\.\d+)?(?:\s*(?:-|–|to)\s*\d+(?:\.\d+)?)?))\s*([a-zA-Z.]+)?/);
    if (!m || !m[2]) return null;
    const u = UNITS[m[2].toLowerCase().replace(/\.$/, '')];
    if (!u) return null;
    const n = toNum(m[1]);
    if (!isFinite(n)) return null;
    const lowName = String(ing.name || '').toLowerCase();
    const d = DENS.find(([re]) => re.test(lowName));
    const gpc = d ? d[1] : null;
    if (mode === 'g') {
      let grams = null;
      if (u.k === 'w') { if (u.g === 1) return null; grams = n * u.g; }
      else if (gpc) grams = n * u.ml * gpc / 240;
      if (grams == null) return null;
      if (grams >= 1000) return (Math.round(grams / 10) / 100) + ' kg';
      return (grams >= 20 ? Math.round(grams / 5) * 5 : Math.round(grams)) + ' g';
    }
    if (mode === 'cups') {
      if (u.k === 'v' || !gpc) return null;
      const ml = n * u.g / (gpc / 240);
      if (ml >= 45) { const c = niceFrac(ml / 240); return c ? c + ' cup' + (ml / 240 > 1.1 ? 's' : '') : null; }
      if (ml >= 12) { const tb = Math.round(ml / 15 * 2) / 2; return (tb % 1 ? Math.floor(tb) + ' 1/2' : tb).toString().replace(/^0 /, '') + ' tbsp'; }
      const ts = niceFrac(ml / 5); return ts ? ts + ' tsp' : null;
    }
    return null;
  }

  const api = { parseRecipe, parseIng, convert, normFrac, fmtMin };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parser = api;
})(typeof window !== 'undefined' ? window : globalThis);
