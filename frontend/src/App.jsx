import { useState, useCallback, useEffect } from 'react'
import axios from 'axios'

/* ── Views ── */
const VIEW_UPLOAD  = 'upload'
const VIEW_LOADING = 'loading'
const VIEW_QUIZ    = 'quiz'
const VIEW_RESULTS = 'results'

/* ── Theme Toggle ── */
function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system')

  useEffect(() => {
    localStorage.setItem('theme', theme)
    const applyTheme = (t) => {
      let isDark = false
      if (t === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      } else {
        isDark = t === 'dark'
      }
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    }

    applyTheme(theme)

    if (theme === 'system') {
      const matcher = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => applyTheme('system')
      matcher.addEventListener('change', onChange)
      return () => matcher.removeEventListener('change', onChange)
    }
  }, [theme])

  const modes = [
    { id: 'light', icon: '☀️', label: 'Light' },
    { id: 'system', icon: '💻', label: 'System' },
    { id: 'dark', icon: '🌙', label: 'Dark' },
  ]

  return (
    <div className="theme-toggle">
      {modes.map(m => (
        <button
          key={m.id}
          className={`theme-btn ${theme === m.id ? 'active' : ''}`}
          onClick={() => setTheme(m.id)}
          title={`${m.label} Mode`}
        >
          {m.icon}
        </button>
      ))}
    </div>
  )
}

/* ── Score ring helpers ── */
const RING_R   = 68
const RING_C   = 2 * Math.PI * RING_R

function ScoreRing({ score, total }) {
  const pct      = total > 0 ? Math.round((score / total) * 100) : 0
  const offset   = RING_C - (pct / 100) * RING_C
  const emoji    = pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : pct >= 50 ? '👍' : '💪'
  const color    = pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="score-ring-wrap">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r={RING_R} fill="none" strokeWidth="8" className="score-ring-bg" />
        <circle
          cx="80" cy="80" r={RING_R}
          fill="none" strokeWidth="8"
          className="score-ring-fill"
          stroke={color}
          strokeDasharray={RING_C}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="score-center-text">
        <span className="score-percent">{pct}%</span>
        <span style={{ fontSize: '1.4rem' }}>{emoji}</span>
      </div>
    </div>
  )
}

/* ── Upload View ── */
function UploadView({ onGenerate }) {
  const [file, setFile]           = useState(null)
  const [difficulty, setDifficulty] = useState('medium')
  const [dragging, setDragging]   = useState(false)
  const [error, setError]         = useState('')

  const handleFile = (f) => {
    if (!f) return
    if (f.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      setFile(null)
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File is too large (max 20 MB).')
      setFile(null)
      return
    }
    setError('')
    setFile(f)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }, [])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const difficulties = [
    { key: 'easy',   label: '😊 Easy' },
    { key: 'medium', label: '🧠 Medium' },
    { key: 'hard',   label: '🔥 Hard' },
  ]

  return (
    <div className="upload-view">
      <div className="upload-hero">
        <h2>Turn any PDF into<br />an Instant Quiz</h2>
        <p>Upload a PDF document and Quiz Generator will generate 10 tailored multiple-choice questions automatically.</p>
      </div>

      <div className="card">
        {/* Drop Zone */}
        <div
          className={`drop-zone ${dragging ? 'drag-over' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          <input
            type="file"
            accept=".pdf,application/pdf"
            id="pdf-input"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <span className="drop-icon">📄</span>
          <h3>{file ? 'PDF selected' : 'Drop your PDF here'}</h3>
          <p>{file ? '' : 'or click to browse · Max 20 MB'}</p>
          {file && (
            <div className="file-selected">
              <span>📎</span>
              <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
          )}
        </div>

        {/* Difficulty */}
        <div className="difficulty-section" style={{ marginTop: 24 }}>
          <h3>Difficulty Level</h3>
          <div className="difficulty-pills">
            {difficulties.map(d => (
              <button
                key={d.key}
                className={`pill pill-${d.key} ${difficulty === d.key ? 'active' : ''}`}
                onClick={() => setDifficulty(d.key)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="error-banner" style={{ marginTop: 16 }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Generate button */}
        <button
          id="generate-btn"
          className="btn btn-primary"
          style={{ marginTop: 24 }}
          disabled={!file}
          onClick={() => onGenerate(file, difficulty)}
        >
          ✨ Generate Questions
        </button>
      </div>
    </div>
  )
}

/* ── Loading View ── */
function LoadingView() {
  return (
    <div className="loading-view">
      <div className="spinner-ring" />
      <div>
        <h3>Analysing your PDF…</h3>
        <p>Quiz Generator is reading the document and Crafting 10 Thoughtful Questions for you.</p>
        <div className="loading-dots" style={{ marginTop: 12 }}>
          <span /><span /><span />
        </div>
      </div>
    </div>
  )
}

/* ── Quiz View ── */
function QuizView({ questions, difficulty, onFinish }) {
  const [current,  setCurrent]  = useState(0)
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [score,    setScore]    = useState(0)
  const [results,  setResults]  = useState([])

  const q = questions[current]
  const progress = ((current) / questions.length) * 100

  const handleSelect = (optionLabel) => {
    if (answered) return
    setSelected(optionLabel)
    setAnswered(true)
    const correct = optionLabel === q.answer
    if (correct) setScore(s => s + 1)
    setResults(prev => [...prev, {
      question:    q.question,
      selected:    optionLabel,
      answer:      q.answer,
      correct,
      explanation: q.explanation,
    }])
  }

  const handleNext = () => {
    if (current + 1 < questions.length) {
      setCurrent(c => c + 1)
      setSelected(null)
      setAnswered(false)
    } else {
      onFinish(score + (selected === q.answer ? 0 : 0), results) // pass through
    }
  }

  // Extract just the letter from option strings like "A. Some text"
  const getLabel = (option) => option.charAt(0).toUpperCase()

  const badgeClass = { easy: 'badge-easy', medium: 'badge-medium', hard: 'badge-hard' }

  return (
    <div className="quiz-view">
      {/* Header */}
      <div className="quiz-header">
        <div className="quiz-meta">
          <span className="q-counter">Question {current + 1} of {questions.length}</span>
          <span className={`difficulty-badge ${badgeClass[difficulty] || 'badge-medium'}`}>
            {difficulty}
          </span>
        </div>
        <div className="score-live">
          Score: <strong>{score}</strong> / {current + (answered ? 1 : 0)}
        </div>
      </div>

      {/* Progress */}
      <div className="progress-bar-wrap">
        <div
          className="progress-bar-fill"
          style={{ width: `${answered ? ((current + 1) / questions.length) * 100 : progress}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="card question-card" key={current}>
        <div className="question-number">Question {current + 1}</div>
        <p className="question-text">{q.question}</p>

        <ul className="options-list">
          {q.options.map((option) => {
            const label = getLabel(option)
            let className = 'option-btn'
            if (answered) {
              if (label === q.answer)           className += ' reveal-correct'
              if (label === selected && label === q.answer) className = 'option-btn selected-correct'
              if (label === selected && label !== q.answer) className = 'option-btn selected-wrong'
            }
            return (
              <li key={label}>
                <button
                  className={className}
                  disabled={answered}
                  onClick={() => handleSelect(label)}
                >
                  <span className="option-label">{label}</span>
                  <span>{option.slice(2).trim() || option}</span>
                </button>
              </li>
            )
          })}
        </ul>

        {/* Explanation */}
        {answered && (
          <div className="explanation-box">
            <span className="icon">💡</span>
            <p>
              <strong>Explanation</strong>
              {q.explanation}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="quiz-footer">
        <button className="btn btn-ghost" onClick={() => onFinish(score, results)}>
          End Quiz
        </button>
        {answered && (
          <button id="next-btn" className="btn btn-primary" style={{ width: 'auto' }} onClick={handleNext}>
            {current + 1 < questions.length ? 'Next Question →' : 'See Results 🎯'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Results View ── */
function ResultsView({ score, total, results, difficulty, onRestart, onNewPDF }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const message =
    pct >= 90 ? "Outstanding! You've Mastered This Material." :
    pct >= 70 ? "Great Job! You have Solid Understanding."    :
    pct >= 50 ? "Good Effort! Review the Explanations Below." :
                "Keep Studying — You'll Nail it Next Time!"

  return (
    <div className="results-view">
      <ScoreRing score={score} total={total} />

      <div>
        <h2 className="result-title">
          {pct >= 70 ? '🎉 ' : '💪 '}Quiz Complete!
        </h2>
        <p className="result-subtitle">{message}</p>
      </div>

      <div className="score-stats">
        <div className="stat-chip correct">✅ {score} Correct</div>
        <div className="stat-chip wrong">❌ {total - score} Wrong</div>
        <div className="stat-chip total">📝 {total} Total</div>
      </div>

      <div className="result-actions">
        <button className="btn btn-secondary" onClick={onRestart}>🔄 Retry Quiz</button>
        <button id="new-pdf-btn" className="btn btn-primary" onClick={onNewPDF}>📄 New PDF</button>
      </div>

      {/* Summary */}
      {results.length > 0 && (
        <div className="summary-section card" style={{ textAlign: 'left' }}>
          <h3>Answer Summary</h3>
          {results.map((r, i) => (
            <div key={i} className="summary-item">
              <span className="s-icon">{r.correct ? '✅' : '❌'}</span>
              <div>
                <div className="s-q">{r.question}</div>
                {r.correct
                  ? <div className="s-ans-correct">Your answer: {r.selected} — Correct!</div>
                  : <div className="s-ans-wrong">Your answer: {r.selected} · Correct: {r.answer}</div>
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main App ── */
export default function App() {
  const [view,       setView]       = useState(VIEW_UPLOAD)
  const [questions,  setQuestions]  = useState([])
  const [difficulty, setDifficulty] = useState('medium')
  const [error,      setError]      = useState('')
  const [quizResults,setQuizResults]= useState([])
  const [quizScore,  setQuizScore]  = useState(0)

  const handleGenerate = async (file, diff) => {
    setError('')
    setDifficulty(diff)
    setView(VIEW_LOADING)

    const formData = new FormData()
    formData.append('pdf', file)
    formData.append('difficulty', diff)

    // Use environment variable for backend URL (fallback to empty string for relative path / proxy in dev)
    const API_URL = import.meta.env.VITE_API_URL || ''

    try {
      const { data } = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      })
      setQuestions(data.questions)
      setView(VIEW_QUIZ)
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to generate questions. Please try again.'
      setError(msg)
      setView(VIEW_UPLOAD)
    }
  }

  const handleFinish = (score, results) => {
    setQuizScore(score)
    setQuizResults(results)
    setView(VIEW_RESULTS)
  }

  const handleRestart = () => {
    setView(VIEW_QUIZ)
  }

  const handleNewPDF = () => {
    setQuestions([])
    setQuizResults([])
    setQuizScore(0)
    setError('')
    setView(VIEW_UPLOAD)
  }

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <div className="container">
          <div className="header-inner">
            <div className="logo-icon">🧠</div>
            <div className="logo-text">
              <h1>PDF Quiz Generator</h1>
              <p>Powered by AI</p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <a href="https://digital-dynamo-hub-ddh.lovable.app/" className="home-link" title="Go to Home">
                <span className="home-icon">🏠</span>
                <span className="home-text">Home</span>
              </a>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          {error && view === VIEW_UPLOAD && (
            <div className="error-banner" style={{ marginBottom: 20 }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {view === VIEW_UPLOAD  && <UploadView onGenerate={handleGenerate} />}
          {view === VIEW_LOADING && <LoadingView />}
          {view === VIEW_QUIZ    && (
            <QuizView
              questions={questions}
              difficulty={difficulty}
              onFinish={handleFinish}
            />
          )}
          {view === VIEW_RESULTS && (
            <ResultsView
              score={quizScore}
              total={questions.length}
              results={quizResults}
              difficulty={difficulty}
              onRestart={handleRestart}
              onNewPDF={handleNewPDF}
            />
          )}
        </div>
      </main>

      <footer className="app-footer">
        <div className="container">
          PDF Quiz Generator · Built with love for learners
        </div>
      </footer>
    </div>
  )
}
