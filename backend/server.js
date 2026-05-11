require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "https://pdf-quiz-generator-with-gemini-ai.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
}));
app.use(express.json());

// ── Multer — store uploads in /uploads temporarily ────────────────────────────
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

// ── Gemini Client ─────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Helper: build the Gemini prompt ──────────────────────────────────────────
function buildPrompt(difficulty = "medium") {
  const difficultyMap = {
    easy: "simple recall and basic understanding",
    medium: "application and comprehension",
    hard: "analysis, evaluation, and critical thinking",
  };
  const level = difficultyMap[difficulty] || difficultyMap.medium;

  return `You are an expert quiz creator. Analyze the provided PDF document and generate exactly 10 multiple-choice questions.

Difficulty level: ${difficulty.toUpperCase()} — focus on ${level}.

Rules:
- Questions must test UNDERSTANDING, not just direct copy of text.
- Each question must have exactly 4 options labeled A, B, C, D.
- One option must be clearly correct.
- Include a concise explanation (1-2 sentences) for why the answer is correct.
- Questions should cover different sections/topics from the document.
- Vary the question types (what, why, how, which, etc.).

Return ONLY a valid JSON array with this exact structure (no markdown, no code fences, no extra text):
[
  {
    "question": "Question text here?",
    "options": ["A. Option text", "B. Option text", "C. Option text", "D. Option text"],
    "answer": "A",
    "explanation": "Explanation why A is correct."
  }
]`;
}

// ── Helper: validate and extract JSON from Gemini response ───────────────────
function extractJSON(text) {
  // Remove markdown code fences if present
  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Find the first [ and last ] to extract the array
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found in response");

  const jsonStr = cleaned.slice(start, end + 1);
  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Response is not a valid array");
  }

  // Validate each question object
  const validated = parsed.map((item, index) => {
    if (!item.question) throw new Error(`Question ${index + 1} missing "question" field`);
    if (!Array.isArray(item.options) || item.options.length !== 4)
      throw new Error(`Question ${index + 1} must have exactly 4 options`);
    if (!item.answer) throw new Error(`Question ${index + 1} missing "answer" field`);
    if (!item.explanation) throw new Error(`Question ${index + 1} missing "explanation" field`);
    return {
      question: String(item.question).trim(),
      options: item.options.map((o) => String(o).trim()),
      answer: String(item.answer).trim().toUpperCase(),
      explanation: String(item.explanation).trim(),
    };
  });

  return validated;
}

// ── POST /api/upload ──────────────────────────────────────────────────────────
app.post("/api/upload", upload.single("pdf"), async (req, res) => {
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded. Please attach a PDF." });
    }

    const difficulty = req.body.difficulty || "medium";

    // Read PDF and convert to base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");

    // Call Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      buildPrompt(difficulty),
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data,
        },
      },
    ]);

    const responseText = result.response.text();
    const questions = extractJSON(responseText);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    return res.json({
      success: true,
      difficulty,
      count: questions.length,
      questions,
    });
  } catch (err) {
    // Clean up file on error
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);

    console.error("Error generating questions:", err.message);

    if (err.message?.includes("API_KEY") || err.message?.includes("API key")) {
      return res.status(401).json({ error: "Invalid Gemini API key. Check your .env file." });
    }
    if (err.message?.includes("Only PDF")) {
      return res.status(400).json({ error: "Only PDF files are accepted." });
    }
    if (err.message?.includes("JSON") || err.message?.includes("array")) {
      return res.status(500).json({
        error: "Gemini returned an unexpected format. Please try again.",
      });
    }

    return res.status(500).json({
      error: err.message || "Something went wrong. Please try again.",
    });
  }
});

// ── Multer error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Maximum size is 20 MB." });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`✅ PDF Quiz Generator backend running on port ${PORT}`);
  console.log(
    `Gemini API key: ${
      process.env.GEMINI_API_KEY ? "✓ Found" : "✗ MISSING — add to Render env"
    }`
  );
});
