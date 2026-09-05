

import { IntentResult } from '../types';

/**
 * IntentAgent — Parses natural-language requests into structured intent.
 * Uses keyword matching + pattern recognition (deterministic, explainable).
 * Optionally enhances with LLM if OPENAI_API_KEY is available.
 */
export class IntentAgent {
  private categoryKeywords: [string, string[]][] = [
    ['Clothing', ['shirt','tshirt','tee','jeans','pants','trouser','chino','jacket','dress','suit','kurta','saree','kurti','leggings','formal','casual wear']],
    ['Electronics', ['laptop','phone','mobile','headphone','earphone','earbud','mouse','keyboard','charger','tablet','monitor','camera','speaker','smartwatch','smart watch','gaming pc','ssd','graphics card','gpu','laptop','console']],
    ['Groceries', ['rice','atta','flour','tea','coffee','honey','oil','ghee','masala','spice','groceries','grocery','milk','pasta','noodles','cookies','snacks','dry fruit','dals','pulses']],
    ['Stationery', ['notebook','pen','pencil','eraser','marker','stationery','geometry','art supplies','sketch','ruler']],
    ['Accessories', ['bag','belt','tie','watch','wallet','sunglasses','scarf','luggage','backpack']],
    ['Books', ['book','novel','textbook','guide','biography','fiction','non-fiction','story']],
    ['Home & Kitchen', ['mug','cup','plate','lamp','cookware','pillow','blanket','sheet','cooker','pan','vessel','kitchen','dinner set','bottle','jar','induction']],
  ];
  private useCaseKeywords: [string, string[]][] = [
    ['college', ['college','student','campus','university','study','presentation','school']],
    ['office', ['office','work','professional','business','corporate']],
    ['gaming', ['gaming','game','gamer','stream','esports','graphics','gpu','fps','rtx']],
    ['formal', ['formal','interview','wedding','official']],
    ['casual', ['casual','daily wear','everyday','streetwear']],
    ['sports', ['sports','gym','workout','athletic']],
    ['travel', ['travel','trip','vacation','weekend']],
    ['gift', ['birthday','gift','present','anniversary']],
    ['coding', ['coding','programming','developer','software']],
    ['storage', ['1tb','512gb','256gb','1 tb','storage','ssd','hard drive']],
    ['date', ['date','dating','romantic']],
  ];
  private recipientKeywords: [string, string[]][] = [
    ['sister', ['sister','sissy']], ['brother', ['brother','bro']],
    ['mother', ['mother','mom','mummy']], ['father', ['father','dad','daddy']],
    ['friend', ['friend','buddy']], ['husband', ['husband','hubby']],
    ['wife', ['wife','wifey']], ['student', ['student','i need','i want','myself']],
  ];
  private colorKeywords: [string, string[]][] = [
    ['white',['white','ivory']], ['black',['black','onyx']], ['blue',['blue','navy']],
    ['red',['red','maroon','crimson']], ['green',['green','olive']],
    ['grey',['grey','gray','charcoal']], ['brown',['brown','tan']],
    ['pink',['pink','rose']], ['silver',['silver','metallic']],
    ['beige',['beige','khaki']],
  ];

  async parseIntent(text: string): Promise<IntentResult> {
    const lower = text.toLowerCase();
    const intent: IntentResult = { keywords: [], confidence: 0.5, use_cases: [] };

    // Extract budget
    const budgetPatterns = [
      /(?:under|below|max|budget|spend)\s*([0-9,]+(?:\.\d+)?)\s*(?:rupees?|₹|rs)?/i,
      /([0-9,]+)\s*(?:rupees?|₹|rs)/i,
    ];
    // Extended budget parsing: "70K", "1.2L", "1 lakh", "under 70000", "₹70,000"
    const extPatterns = [
      /(?:under|below|max|budget|spend|around|about|within)?\s*([0-9,]+(?:\.[0-9]+)?)\s*(k|l|lakh|lakhs|crore|crores|cr)/i,
      /(?:under|below|max|budget|spend|around|about|within|for)\s*([0-9,]+(?:\.[0-9]+)?)/i,
      /for\s+([0-9,]+)\s*(?:rupees|rs)/i,
    ];
    for (const p of extPatterns) {
      const m = text.match(p);
      if (!m) continue;
      let num = parseFloat(m[1].replace(/,/g, ''));
      if (isNaN(num) || num <= 0) continue;
      const suffix = (m[2] || '').toLowerCase().trim();
      if (suffix) {
        if (suffix === 'k') num *= 1000;
        else if (suffix.startsWith('l')) num *= 100000;
        else if (suffix.startsWith('c')) num *= 10000000;
      }
      intent.budget = Math.round(num);
      intent.budget_currency = 'INR';
      break;
    }
    if (!intent.budget) {
      const m = text.match(/([0-9,]+)\s*(?:thousand|k)/i);
      if (m) { intent.budget = parseInt(m[1].replace(/,/g, ''), 10) * 1000; intent.budget_currency = 'INR'; }
    }

    // Extract category (do NOT push the category name into keywords — the category is
    // tracked separately and would otherwise pollute keyword scoring)
    for (const [cat, keywords] of this.categoryKeywords) {
      if (keywords.some(kw => lower.includes(kw))) { intent.category = cat; break; }
    }

    // Extract use cases
    for (const [uc, keywords] of this.useCaseKeywords) {
      if (keywords.some(kw => lower.includes(kw)) && !intent.use_cases.includes(uc)) intent.use_cases.push(uc);
    }

    // Extract recipient
    for (const [rec, keywords] of this.recipientKeywords) {
      if (keywords.some(kw => lower.includes(kw))) { intent.recipient = rec; }
    }

    // Extract color
    for (const [color, keywords] of this.colorKeywords) {
      if (keywords.some(kw => lower.includes(kw))) { intent.color = color; break; }
    }

    // Extract brand
    const brandMatch = text.match(/brand\s+([a-zA-Z]+)|Apple|Samsung/i);
    if (brandMatch) intent.brand = brandMatch[1] || brandMatch[0];

    // Normalize compound specs so "1 tb" matches tags like "1tb", then extract specs
    const norm = lower.replace(/(\d+)\s*(tb|gb)\b/g, '$1$2');
    const specs: Record<string, string> = {};
    const ramM = norm.match(/(\d+)\s*gb\s*ram\b/);
    if (ramM) specs.ram = `${parseInt(ramM[1], 10)}gb`;
    const tbM = norm.match(/(\d+(?:\.\d+)?)\s*tb\b/);
    if (tbM) specs.storage = `${parseFloat(tbM[1])}tb`;
    else { const gbM = norm.match(/(\d{3,4})\s*gb\b(?!\s*ram)/); if (gbM) specs.storage = `${parseInt(gbM[1], 10)}gb`; }
    const scrM = norm.match(/(1[0-9](?:\.[0-9])?)\s*(?:-)?\s*(?:\.\s*)?(?:inch|in|\"|”)\b/);
    if (scrM || /(screen|display)\s*size/i.test(lower)) specs.screen = scrM ? `${scrM[1]}in` : 'any';
    const hzM = norm.match(/(120|144|165|240|360)\s*hz\b/);
    if (hzM) specs.refresh = `${hzM[1]}hz`;
    if (/\b(graphics|gpu|rtx|gtx|nvidia|amd)\b/.test(norm)) specs.gpu = 'dedicated';
    if (/\b(bluetooth|wireless)\b/.test(norm)) specs.wireless = 'true';
    if (Object.keys(specs).length > 0) intent.specs = specs;

    // Extract keywords (words + spec tokens like "1tb"; skip budget tokens like "70k")
    const stop = new Set(['the','a','an','i','need','want','require','looking','for','good','under','with','and','or','to','my','please','can','you','what','should','show','find','get','buy','suggest','recommend','display','search','list','give','some','any','best','top','have','has','there','here','options','option','products','product','items','item','something','anything','nice','new','ideas','idea','want','show','me']);
    // Light plural stemming: "laptops" -> "laptop", "ties" -> "tie" (preserve "ss" endings)
    const singular = (w: string): string =>
      /ies$/i.test(w) ? w.slice(0, -3) + 'y'
      : (/s$/i.test(w) && !/ss$/i.test(w) && w.length > 3 ? w.slice(0, -1) : w);
    const words = norm.match(/\b[a-z0-9]+\b/g) || [];
    for (const w of words) {
      if (stop.has(w) || w.length <= 2 || /^\d+$/.test(w) || /^\d+(?:k|l|cr|crore|crores|lakh|lakhs)?$/.test(w)) continue;
      const sw = singular(w);
      if (!intent.keywords.includes(sw)) intent.keywords.push(sw);
    }
    // Order product-type words first (e.g. "laptop") so ranking prioritizes the item type
    const typeWords = new Set(this.categoryKeywords.flatMap(([, kws]) => kws));
    intent.keywords.sort((a, b) => (typeWords.has(b) ? 1 : 0) - (typeWords.has(a) ? 1 : 0));

    // Confidence
    let conf = 0.5;
    if (intent.budget) conf += 0.15; if (intent.category) conf += 0.15;
    if (intent.use_cases?.length) conf += 0.1; if (intent.color) conf += 0.05;
    if (intent.keywords.length > 3) conf += 0.05;
    intent.confidence = Math.min(conf, 0.95);
    return intent;
  }
}

export const intentAgent = new IntentAgent();
