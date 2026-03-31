import { Firestore } from "@google-cloud/firestore";
import { callModel } from "./modelRouter.js";
import { getModelKnowledge } from "./knowledgeBase.js";

const GCP_PROJECT_ID =
  process.env.GCP_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "toyota-ai-sales-agent-poc";

// In-memory fallback for local development without Firestore
const inMemorySessions = new Map();
let db = null;

try {
  db = new Firestore({ projectId: GCP_PROJECT_ID });
  console.log(`Firestore initialized (project: ${GCP_PROJECT_ID})`);
} catch (e) {
  console.warn("Firestore init failed — using in-memory session store:", e.message);
}

const MODEL_CATALOG = {
  Yaris: {
    startingPrice: 550000,
    topPrice: 740000,
    highlights: ["คล่องตัวในเมือง", "ประหยัดน้ำมัน", "ค่าบำรุงรักษาไม่สูง"],
    fit: "เหมาะกับคนใช้งานในเมืองทุกวันและต้องการรถคันแรก",
  },
  Ativ: {
    startingPrice: 550000,
    topPrice: 700000,
    highlights: ["ห้องโดยสารใช้งานง่าย", "นุ่มนวลขับสบาย", "ความคุ้มค่าดี"],
    fit: "เหมาะกับการใช้งานทั่วไปทั้งทำงานและครอบครัวเล็ก",
  },
  "Corolla Cross": {
    startingPrice: 1000000,
    topPrice: 1250000,
    highlights: ["ท่านั่งขับสูง", "พื้นที่เก็บของดี", "เหมาะกับครอบครัว"],
    fit: "เหมาะกับลูกค้าที่อยากได้ Crossover ใช้ได้ทั้งเมืองและทริปต่างจังหวัด",
  },
  Camry: {
    startingPrice: 1450000,
    topPrice: 1900000,
    highlights: ["นั่งสบาย", "ภาพลักษณ์พรีเมียม", "ห้องโดยสารกว้าง"],
    fit: "เหมาะกับผู้บริหารหรือผู้ที่ต้องการความหรูหราและความสบาย",
  },
  Fortuner: {
    startingPrice: 1450000,
    topPrice: 1900000,
    highlights: ["7 ที่นั่ง", "ช่วงล่างแน่น", "เดินทางไกลมั่นใจ"],
    fit: "เหมาะกับครอบครัวใหญ่และคนเดินทางต่างจังหวัดบ่อย",
  },
  Hilux: {
    startingPrice: 900000,
    topPrice: 1300000,
    highlights: ["ทนทาน", "บรรทุกได้", "เหมาะกับงานหนัก"],
    fit: "เหมาะกับงานธุรกิจหรือใช้งานกึ่งพาณิชย์",
  },
  Veloz: {
    startingPrice: 850000,
    topPrice: 930000,
    highlights: ["7 ที่นั่งอเนกประสงค์", "ขึ้นลงสะดวก", "ห้องโดยสารยืดหยุ่น"],
    fit: "เหมาะกับครอบครัวที่ต้องการ 7 ที่นั่งในงบไม่สูงเกินไป",
  },
};

/* ===============================
   RULE-BASED EXTRACTION
=================================*/

function extractBudget(text) {
  if (!text) return null;

  const thaiDigitMap = {
    "๐": "0",
    "๑": "1",
    "๒": "2",
    "๓": "3",
    "๔": "4",
    "๕": "5",
    "๖": "6",
    "๗": "7",
    "๘": "8",
    "๙": "9",
  };

  const normalizedText = text
    .replace(/[๐-๙]/g, (digit) => thaiDigitMap[digit] || digit)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const numericMatch = normalizedText.match(/(\d[\d,]*)\s*(ล้าน|แสน|หมื่น|พัน)?/);
  if (numericMatch) {
    const baseValue = parseInt(numericMatch[1].replace(/,/g, ""), 10);
    const unit = numericMatch[2];

    let parsed = baseValue;
    if (unit === "ล้าน") parsed = baseValue * 1_000_000;
    if (unit === "แสน") parsed = baseValue * 100_000;
    if (unit === "หมื่น") parsed = baseValue * 10_000;
    if (unit === "พัน") parsed = baseValue * 1_000;

    if (parsed >= 300000) return parsed;
  }

  const thaiWordBudgetMap = {
    "หนึ่งล้าน": 1_000_000,
    "1ล้าน": 1_000_000,
    "สองล้าน": 2_000_000,
    "สามล้าน": 3_000_000,
    "ครึ่งล้าน": 500_000,
    "ห้าแสน": 500_000,
    "หกแสน": 600_000,
    "เจ็ดแสน": 700_000,
    "แปดแสน": 800_000,
    "เก้าแสน": 900_000,
  };

  for (const [word, value] of Object.entries(thaiWordBudgetMap)) {
    if (normalizedText.includes(word)) {
      return value;
    }
  }

  return null;
}

function extractUsage(text) {
  if (!text) return null;

  const keywords = ["ครอบครัว", "family", "ในเมือง", "ธุรกิจ", "เดินทางไกล"];
  for (let word of keywords) {
    if (text.includes(word)) return text;
  }
  return null;
}

function extractModel(text) {
  if (!text) return null;

  const models = [
    "Corolla Cross",
    "Yaris",
    "Camry",
    "Fortuner",
    "Hilux",
    "Veloz",
    "Ativ"
  ];

  for (let model of models) {
    if (text.toLowerCase().includes(model.toLowerCase())) {
      return model;
    }
  }

  return null;
}

function extractSeats(text) {
  if (!text) return null;

  if (text.includes("7")) return 7;
  if (text.includes("5")) return 5;
  return null;
}

function normalizeModelKey(modelKey) {
  if (modelKey === "claude_haiku") return "claude_haiku";
  return "gemini_flash";
}

function recommendModels(lead) {
  const seatCandidates = lead?.seats === 7
    ? ["Veloz", "Fortuner", "Hilux"]
    : ["Yaris", "Ativ", "Corolla Cross", "Camry"];

  const budget = lead?.budget || 0;
  const withinBudget = seatCandidates.filter((model) => {
    const price = MODEL_CATALOG[model]?.startingPrice || 0;
    return budget >= Math.floor(price * 0.85);
  });

  return withinBudget.length > 0 ? withinBudget.slice(0, 3) : seatCandidates.slice(0, 3);
}

function getModelExplanation(modelName, lead) {
  const externalKnowledge = getModelKnowledge(modelName);
  const modelData = MODEL_CATALOG[modelName];
  const budgetText = lead?.budget
    ? `ในงบประมาณประมาณ ${lead.budget.toLocaleString("th-TH")} บาท`
    : "ในงบประมาณที่คุณแจ้ง";

  if (externalKnowledge) {
    const highlights = (externalKnowledge.highlights || []).slice(0, 3).join(", ");
    const summary = externalKnowledge.summary || `${modelName} เป็นรุ่นที่น่าสนใจ`;
    const priceNote = externalKnowledge.priceNote || "โปรดตรวจสอบราคาและรุ่นย่อยล่าสุดกับโชว์รูม";

    return `${summary} ${priceNote}${highlights ? ` จุดเด่น: ${highlights}` : ""} ${budgetText}`;
  }

  if (!modelData) {
    return `${modelName} เป็นรุ่นที่เหมาะกับการใช้งานของคุณ ${budgetText} ครับ`;
  }

  const priceRange = `${modelData.startingPrice.toLocaleString("th-TH")} - ${modelData.topPrice.toLocaleString("th-TH")} บาท`;
  const highlights = modelData.highlights.join(", ");

  return `${modelName} ช่วงราคาโดยประมาณ ${priceRange} ครับ จุดเด่นคือ ${highlights} และ ${modelData.fit} ${budgetText}`;
}

/* ===============================
   SESSION
=================================*/

const DEFAULT_SESSION = (userId) => ({
  stage: "ask_budget",
  messages: [],
  lead: { phone: userId },
  score: "COLD",
});

async function getSession(userId) {
  if (!userId) throw new Error("Invalid userId");

  if (!db) {
    return inMemorySessions.get(String(userId)) ?? DEFAULT_SESSION(userId);
  }

  try {
    const doc = await db.collection("sessions").doc(String(userId)).get();
    return doc.exists ? doc.data() : DEFAULT_SESSION(userId);
  } catch (e) {
    console.warn("Firestore getSession failed, using in-memory:", e.message);
    return inMemorySessions.get(String(userId)) ?? DEFAULT_SESSION(userId);
  }
}

async function saveSession(userId, data) {
  if (!userId) throw new Error("Invalid userId for saveSession");

  const payload = { ...data, updatedAt: new Date() };
  inMemorySessions.set(String(userId), payload);

  if (!db) return;

  try {
    await db.collection("sessions").doc(String(userId)).set(payload);
  } catch (e) {
    console.warn("Firestore saveSession failed, session kept in memory:", e.message);
  }
}

/* ===============================
   LEAD SCORING
=================================*/

function calculateLeadScore(lead) {
  if (lead.budget && lead.usage && lead.preferred_model) {
    return "HOT";
  }
  if (lead.budget && lead.usage) {
    return "WARM";
  }
  return "COLD";
}

/* ===============================
   MAIN AGENT
=================================*/

async function runAgent(input) {
  const userId = input?.userId;
  const userMessage = input?.userMessage;
  const modelKey = normalizeModelKey(input?.modelKey);

  if (!userId) {
    throw new Error("userId is required");
  }

  if (!userMessage) {
    throw new Error("userMessage is required");
  }

  let session = await getSession(userId);

  if (!session.messages) session.messages = [];
  if (!session.lead) session.lead = { phone: userId };

  session.messages.push({
    role: "user",
    content: userMessage,
  });

  /* ===== RULE FIRST ===== */

  const budget = extractBudget(userMessage);
  const usage = extractUsage(userMessage);
  const modelName = extractModel(userMessage);
  const seats = extractSeats(userMessage);

  if (budget) session.lead.budget = budget;
  if (usage) session.lead.usage = usage;
  if (modelName) session.lead.preferred_model = modelName;
  if (seats) session.lead.seats = seats;

  /* ===== FORCE STAGE ===== */

  if (!session.lead.budget) {
    session.stage = "ask_budget";
  } else if (!session.lead.usage) {
    session.stage = "ask_usage";
  } else if (!session.lead.seats) {
    session.stage = "ask_seats";
  } else if (!session.lead.preferred_model) {
    session.stage = "recommend_model";
  } else {
    session.stage = "ask_test_drive";
  }

  /* ===== BUILD CONTEXT FOR LLM ===== */

  // Prepare extra context depending on stage
  let stageContext = "";

  if (session.stage === "ask_budget") {
    stageContext = `เป้าหมาย: ถามงบประมาณของลูกค้าอย่างเป็นธรรมชาติ ยังไม่ทราบงบ`;
  } else if (session.stage === "ask_usage") {
    stageContext = `เป้าหมาย: ถามลักษณะการใช้งานรถ เช่น ในเมือง ครอบครัว เดินทางไกล งานธุรกิจ
งบประมาณที่แจ้ง: ${session.lead.budget?.toLocaleString("th-TH")} บาท`;
  } else if (session.stage === "ask_seats") {
    stageContext = `เป้าหมาย: ถามจำนวนที่นั่งที่ต้องการ (5 หรือ 7 ที่นั่ง)
งบประมาณ: ${session.lead.budget?.toLocaleString("th-TH")} บาท
การใช้งาน: ${session.lead.usage}`;
  } else if (session.stage === "recommend_model") {
    const choices = recommendModels(session.lead);
    const modelDetails = choices.map((m) => {
      const d = MODEL_CATALOG[m];
      return `${m} (ราคาเริ่ม ${d?.startingPrice?.toLocaleString("th-TH")} บาท — ${d?.fit})`;
    }).join("\n- ");
    stageContext = `เป้าหมาย: แนะนำรุ่นรถที่เหมาะกับลูกค้าและถามว่าสนใจรุ่นไหน
งบประมาณ: ${session.lead.budget?.toLocaleString("th-TH")} บาท
การใช้งาน: ${session.lead.usage}
จำนวนที่นั่ง: ${session.lead.seats} ที่นั่ง
รุ่นที่แนะนำ:
- ${modelDetails}`;
  } else if (session.stage === "ask_test_drive") {
    const preferredModel = session.lead?.preferred_model || "รุ่นที่สนใจ";
    const knowledge = getModelExplanation(preferredModel, session.lead);
    stageContext = `เป้าหมาย: อธิบายข้อมูลรุ่น ${preferredModel} และชวนนัดทดลองขับ
ข้อมูลรุ่น: ${knowledge}
สิ่งที่ทราบแล้ว — งบ: ${session.lead.budget?.toLocaleString("th-TH")} บาท | การใช้งาน: ${session.lead.usage} | ที่นั่ง: ${session.lead.seats}`;
  }

  /* ===== SYSTEM PROMPT ===== */

  const systemPrompt = `คุณคือที่ปรึกษาขายรถยนต์ Toyota มืออาชีพในประเทศไทย ชื่อ "โต้" พูดเป็นกันเองแบบมืออาชีพ ไม่เป็นทางการจนเกินไป

บุคลิก:
- อบอุ่น เป็นมิตร ให้ความรู้สึกเหมือนคุยกับเพื่อนที่รู้จักรถดี
- ตอบสนองต่อสิ่งที่ลูกค้าพูดก่อน อย่าเพิกเฉย แล้วค่อยนำไปสู่คำถามถัดไป
- ใช้ภาษาไทยที่เป็นธรรมชาติ หลีกเลี่ยงประโยคสำเร็จรูป เช่น "ขอทราบ..." หรือ "สวัสดีครับ ยินดีต้อนรับ..."
- ตอบสั้น กระชับ 1–3 ประโยค ไม่ยาวเกิน

Stage ปัจจุบัน: ${session.stage}
${stageContext}

กฎ:
- ถามทีละคำถาม อย่าถามหลายอย่างในครั้งเดียว
- ถ้าลูกค้าถามนอกเรื่อง ตอบสั้นๆ แล้วนำกลับมา
- ห้ามแนะนำรถนอกเหนือจาก Toyota

ตอบกลับเฉพาะข้อความที่จะส่งให้ลูกค้า ไม่ต้องมีคำอธิบายอื่น`;

  const contents = session.messages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const reply = await callModel(modelKey, {
    systemPrompt,
    messages: contents,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 1500,
    },
  });

  session.messages.push({
    role: "assistant",
    content: reply,
  });

  if (session.messages.length > 40) {
    session.messages = session.messages.slice(-40);
  }

  session.score = calculateLeadScore(session.lead);

  await saveSession(userId, session);

  return {
    reply,
    stage: session.stage,
    leadScore: session.score,
    modelKey,
    lead: session.lead,
  };
}

export { runAgent };