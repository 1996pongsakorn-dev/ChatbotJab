 HEAD
# Toyota AI Sales Agent POC

POC สำหรับ AI Sales Agent (ขายรถ Toyota) บน GCP โดยใช้ Orchestrator Flow + Vertex AI และสามารถสลับโมเดลได้จากหน้าบ้าน (`gemini_flash`, `claude_haiku`).

## 1) Prerequisites

- Node.js 20+
- GCP Project พร้อมเปิดบริการ: Vertex AI, Firestore, Cloud Run, Secret Manager
- สิทธิ์ Service Account สำหรับ Vertex AI และ Firestore

เครื่องมือแนะนำ:

- Google Cloud SDK (`gcloud`)
- สิทธิ์ IAM สำหรับ deploy: Cloud Run Admin, Artifact Registry Writer, Cloud Build Editor, Service Account User

## 2) ตั้งค่า Environment

1. คัดลอก `.env.example` เป็น `.env`
2. แก้ค่าให้ตรงกับโปรเจกต์ของคุณ

```bash
cp .env.example .env
```

ค่าหลักที่ต้องมี:

- `GCP_PROJECT_ID`
- `GCP_LOCATION` (เช่น `us-central1`)
- `GEMINI_MODEL` (ค่าเริ่มต้น `gemini-2.5-flash`)
- `CLAUDE_MODEL` (ถ้า region/สิทธิ์รองรับ)

## 3) Run Local

```bash
npm install
npm start
```

เปิดหน้าเดโมที่ `http://localhost:8080` แล้วลองส่งข้อความพร้อมเลือกโมเดลจาก dropdown

ทดสอบ flow แบบ script:

```bash
npm test
```

## 4) API Contract

`POST /chat`

Request body:

```json
{
  "sessionId": "demo-user-001",
  "modelKey": "gemini_flash",
  "message": "งบ 900000 บาท"
}
```

Response body:

```json
{
  "ok": true,
  "reply": "...",
  "stage": "ask_usage",
  "leadScore": "COLD",
  "modelKey": "gemini_flash",
  "lead": {
    "phone": "demo-user-001",
    "budget": 900000
  }
}
```

## 5) Orchestrator Stage (MVP)

- `ask_budget`
- `ask_usage`
- `ask_seats`
- `recommend_model`
- `ask_test_drive`

## 5.1 Toyota Web Knowledge (MVP)

ระบบรองรับการ sync ความรู้จากเว็บ Toyota ลงไฟล์ `data/toyota-knowledge.json` แล้วนำไปใช้ตอบรายละเอียดรุ่นรถในแชท

รันคำสั่ง:

```bash
npm run sync:toyota
```

ถ้าต้องการระบุหลายหน้าเอง:

```bash
TOYOTA_SOURCE_URLS="https://www.toyota.co.th/,https://www.toyota.co.th/..." npm run sync:toyota
```

หมายเหตุ: ควรดึงเฉพาะหน้าที่ได้รับอนุญาตและตรวจเงื่อนไขการใช้งานเว็บไซต์ก่อน

## 6) เตรียม GCP ก่อน Deploy

### 6.1 Login และตั้งค่า Project

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 6.2 เปิด API ที่ต้องใช้

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com
```

### 6.3 สร้าง Artifact Registry (ครั้งแรกครั้งเดียว)

```bash
gcloud artifacts repositories create toyota-poc \
  --repository-format=docker \
  --location=us-central1 \
  --description="Toyota Sales Agent images"
```

## 7) Deploy Cloud Run

มี 2 วิธีให้เลือก

### วิธี A: ใช้ PowerShell helper script (แนะนำบน Windows)

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy-cloudrun.ps1 -ProjectId YOUR_PROJECT_ID
```

หรือ

```bash
npm run deploy:cloudrun -- -ProjectId YOUR_PROJECT_ID
```

### วิธี B: Deploy ด้วยคำสั่งตรง

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _REGION=us-central1,_SERVICE_NAME=toyota-sales-agent,_REPOSITORY=toyota-poc,_IMAGE_NAME=sales-agent
```

หลัง deploy เสร็จ ตรวจ URL:

```bash
gcloud run services describe toyota-sales-agent \
  --region us-central1 \
  --format='value(status.url)'
```

## 8) ตรวจสุขภาพหลังขึ้นระบบ

- เปิด URL ที่ได้จาก Cloud Run แล้วทดสอบหน้าเว็บเดโม
- ยิง API ผ่านไฟล์ `curl` เพื่อทดสอบ model switch
- ตรวจ log ด้วย:

```bash
gcloud run services logs read toyota-sales-agent --region us-central1
```

## 9) หมายเหตุเรื่อง Claude บน Vertex Model Garden

- ต้องตรวจ availability รุ่นใน region ที่ใช้งานจริง
- ต้องมีสิทธิ์เข้าถึง partner model ในโปรเจกต์
- ถ้าเรียกไม่ได้ ระบบจะ fallback message กลับมา และควรใช้ `gemini_flash` เป็น default

# ChatbotJab
 711725a5b7c37906e3042da6675703bc482af8da
