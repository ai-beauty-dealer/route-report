const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// Multi-part form data for audio uploads
const upload = multer({ dest: 'uploads/' });

// Paths
const CUSTOMERS_PATH = path.join(__dirname, 'customers.json');
// VPS Path: Adjust to match ubuntu home
const REPORT_HISTORY_PATH = '/home/ubuntu/99_Sbox/ルート日報/Report_Sync.md';

// GAS & Gemini Configuration
const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    global.model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
}

// Ensure directories exist
fs.ensureDirSync(path.dirname(REPORT_HISTORY_PATH));
fs.ensureDirSync(path.join(__dirname, 'uploads'));

// API: Get Customers
app.get('/api/customers', async (req, res) => {
    try {
        const data = await fs.readJson(CUSTOMERS_PATH);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load customers' });
    }
});

// API: Voice Process (Extract customer and comment from audio)
app.post('/api/voice-process', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No audio file' });
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    try {
        const filePath = req.file.path;
        const audioBuffer = await fs.readFile(filePath);

        // Load customer list for Gemini context
        const customerMap = await fs.readJson(CUSTOMERS_PATH);
        const customersList = Object.values(customerMap).flat().join(', ');

        const prompt = `
あなたは「営業マンの自分用メモ」を整理する専用アシスタントです。
以下の音声入力を解析し、活動内容のみを抽出してJSON形式で出力してください。

【プロンプトの最優先事項：トーンの完全な変更】
このメモは「報告」ではなく「自分のための備忘録」です。
丁寧語（です・ます・いたします等）は「絶対に」使用しないでください。
すべて「タメ口」「常体」「〜した」「〜だ」というフランクな口調に変換してください。

表現の変換ルール：
- ✕「〜しました」「〜です」 → ○「〜した」「〜だ」
- ✕「〜させていただきます」 → ○「〜した」「〜やる」
- ✕「ご興味を持っていただけました」 → ○「興味持ってくれた」
- ✕「お伺いしました」 → ○「行った」「訪問した」
- ✕「ご提案」 → ○「提案」

出力は以下のJSON形式のみとし、余計な解説は一切含めないでください。
{
  "comment": "（ここにタメ口・常体で変換した活動内容を入れる）"
}
`;

        const result = await global.model.generateContent([
            prompt,
            {
                inlineData: {
                    data: audioBuffer.toString('base64'),
                    mimeType: req.file.mimetype || 'audio/webm' // Default to webm as browsers typically send this
                }
            }
        ]);

        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{.*?\}/s);
        if (jsonMatch) {
            const extractedData = JSON.parse(jsonMatch[0]);
            res.json(extractedData);
        } else {
            res.status(500).json({ error: 'Failed to parse Gemini response' });
        }

        // Cleanup temporary file
        await fs.remove(filePath);

    } catch (error) {
        console.error('Voice processing failed:', error);
        res.status(500).json({ error: 'Failed to process voice: ' + error.message });
        if (req.file) await fs.remove(req.file.path);
    }
});

// API: Submit Report
app.post('/api/report', async (req, res) => {
    const { day, customer, comment, date, action } = req.body;
    // Fix: Explicitly use Asia/Tokyo timezone
    const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    try {
        if (action === 'exportReport') {
            if (GAS_WEBHOOK_URL) {
                // Fix: Explicitly use Asia/Tokyo timezone for fallback
                const dateStr = date || new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
                await axios.post(GAS_WEBHOOK_URL, {
                    action: 'exportReport',
                    day,
                    customer: customer || '',
                    comment: comment || '',
                    date: dateStr
                });
                return res.json({ status: 'export_success' });
            } else {
                return res.status(400).json({ error: 'GAS_WEBHOOK_URL is not set' });
            }
        }

        let reportEntry;
        if (customer === '1日の総評') {
            reportEntry = `
# 📝 ${timestamp} 【1日の総評】 (${day})
${comment}
---
`;
        } else {
            reportEntry = `
## ${timestamp} (${day})
- **得意先**: ${customer}
- **内容**: ${comment}
---
`;
        }
        await fs.appendFile(REPORT_HISTORY_PATH, reportEntry);

        if (GAS_WEBHOOK_URL) {
            await axios.post(GAS_WEBHOOK_URL, {
                day,
                customer,
                comment,
                // Fix: Explicitly use Asia/Tokyo timezone
                date: new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
            });
        }

        res.json({ status: 'success' });
    } catch (error) {
        console.error('Report submission failed:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
