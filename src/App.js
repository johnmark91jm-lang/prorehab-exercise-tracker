import { useState, useEffect } from "react";

const S = {
  green: "#1D9E75", greenLight: "#E1F5EE", greenDark: "#0F6E56",
  red: "#E24B4A", redLight: "#FCEBEB",
  amber: "#BA7517", gray: "#888",
  border: "#e0e0d8", bg: "#f9f9f7", card: "#ffffff", surface: "#f1f0eb",
  text: "#1a1a1a", muted: "#777",
};

const inp = { width: "100%", padding: "8px 10px", borderRadius: 8, border: `0.5px solid ${S.border}`, fontSize: 14, background: S.card, color: S.text, boxSizing: "border-box", marginBottom: 8, fontFamily: "inherit" };
const btn = (bg, color = "#fff") => ({ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: bg, color, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" });

const compress = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
const decompress = (str) => JSON.parse(decodeURIComponent(escape(atob(str))));
const formatDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
const generateDays = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().split("T")[0]; });
const pillColor = (p) => p >= 80 ? S.green : p >= 50 ? S.amber : S.red;
const STORAGE_KEY = (id) => `exclog_${id}`;

const buildSummary = (patientName, exercises, days, getLog) => {
  let txt = `Exercise Compliance Report\nPatient: ${patientName}\nPeriod: ${formatDate(days[0])} to ${formatDate(days[days.length - 1])}\n\n`;
  exercises.forEach(ex => {
    const done = days.filter(d => getLog(d, ex.id).done === true).length;
    const pct = Math.round((done / days.length) * 100);
    const pains = days.map(d => parseFloat(getLog(d, ex.id).pain)).filter(v => !isNaN(v) && v > 0);
    const diffs = days.map(d => parseFloat(getLog(d, ex.id).difficulty)).filter(v => !isNaN(v) && v > 0);
    const notes = days.map(d => getLog(d, ex.id).notes).filter(Boolean);
    txt += `${ex.name} (${ex.sets}x${ex.reps})\n`;
    txt += `  Compliance: ${pct}% (${done}/${days.length} days)\n`;
    if (pains.length) txt += `  Avg pain: ${(pains.reduce((a, b) => a + b, 0) / pains.length).toFixed(1)}/10\n`;
    if (diffs.length) txt += `  Avg difficulty: ${(diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1)}/10\n`;
    if (notes.length) txt += `  Notes: ${notes.join("; ")}\n`;
    txt += "\n";
  });
  return txt.trim();
};

const ScaleSlider = ({ label, field, value, onChange }) => {
  const num = parseInt(value) || 0;
  const isPain = field === "pain";
  const emoji = num === 0 ? "" : num <= 3 ? "🙂" : num <= 6 ? "😐" : num <= 8 ? "😟" : "😢";
  const color = num === 0 ? S.muted : num <= 3 ? "#639922" : num <= 6 ? S.amber : num <= 8 ? "#D85A30" : S.red;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: S.muted }}>{label}</span>
        <span style={{ fontSize: 20 }}>{emoji}</span>
      </div>
      <input type="range" min={0} max={10} step={1} value={num}
        onChange={e => onChange(field, e.target.value === "0" ? "" : e.target.value)}
        style={{ width: "100%", accentColor: S.green }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontSize: 24 }}>😊</span>
          <span style={{ fontSize: 10, color: S.muted }}>{isPain ? "No pain" : "No effort"}</span>
        </div>
        {num > 0 && <span style={{ fontSize: 14, fontWeight: 500, color }}>{num}/10</span>}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontSize: 24 }}>😢</span>
          <span style={{ fontSize: 10, color: S.muted }}>{isPain ? "Worst pain" : "Max effort"}</span>
        </div>
      </div>
    </div>
  );
};

const ExerciseForm = ({ value, onChange, onSave, onCancel, saveLabel = "Save" }) => (
  <div style={{ background: S.surface, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
    <input style={inp} placeholder="Exercise name *" value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
      {[["sets", "Sets"], ["reps", "Reps"], ["freq", "Per day"]].map(([k, l]) => (
        <div key={k}>
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{l}</div>
          <input type="number" min={1} value={value[k]} onChange={e => onChange({ ...value, [k]: parseInt(e.target.value) || 1 })}
            style={{ ...inp, marginBottom: 0, padding: "6px 8px" }} />
        </div>
      ))}
    </div>
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={onSave} style={{ ...btn(S.green), flex: 1 }}>{saveLabel}</button>
      {onCancel && <button onClick={onCancel} style={{ ...btn("transparent", S.text), flex: 1, border: `0.5px solid ${S.border}` }}>Cancel</button>}
    </div>
  </div>
);

// ── SETUP VIEW ──
const SetupView = () => {
  const [patientName, setPatientName] = useState("");
  const [therapistName, setTherapistName] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [email, setEmail] = useState("");
  const [sessionDays, setSessionDays] = useState(7);
  const [exercises, setExercises] = useState([
    { id: 1, name: "Clamshells", sets: 3, reps: 15, freq: 1 },
    { id: 2, name: "Single-leg deadlift", sets: 3, reps: 10, freq: 1 },
  ]);
  const [newEx, setNewEx] = useState({ name: "", sets: 3, reps: 10, freq: 1 });
  const [editingId, setEditingId] = useState(null);
  const [editEx, setEditEx] = useState(null);
  const [nextId, setNextId] = useState(3);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  const addEx = () => {
    if (!newEx.name.trim()) return;
    setExercises(p => [...p, { ...newEx, id: nextId }]);
    setNextId(n => n + 1);
    setNewEx({ name: "", sets: 3, reps: 10, freq: 1 });
  };

  const generateLink = () => {
    if (!patientName.trim() || exercises.length === 0) return;
    const sessionId = Math.random().toString(36).slice(2, 9);
    const payload = { patientName, therapistName, waNumber, email, sessionDays, exercises, sessionId, createdAt: new Date().toISOString().split("T")[0] };
    const encoded = compress(payload);
    const link = `${window.location.origin}${window.location.pathname}?session=${encoded}`;
    setGeneratedLink(link);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div style={{ padding: "1rem", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: S.text, marginBottom: 4 }}>New patient session</h1>
        <p style={{ fontSize: 13, color: S.muted }}>Fill in the details, then generate a link to send to your patient.</p>
      </div>

      <div style={{ fontSize: 13, fontWeight: 500, color: S.text, marginBottom: 8 }}>Patient & therapist details</div>
      <input style={inp} placeholder="Patient name *" value={patientName} onChange={e => setPatientName(e.target.value)} />
      <input style={inp} placeholder="Your name (therapist)" value={therapistName} onChange={e => setTherapistName(e.target.value)} />
      <input style={inp} placeholder="Your WhatsApp number (e.g. 6591234567)" value={waNumber} onChange={e => setWaNumber(e.target.value)} />
      <input style={inp} placeholder="Your email address" value={email} onChange={e => setEmail(e.target.value)} />

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>Session length (days)</label>
        <input type="number" min={1} max={30} value={sessionDays} onChange={e => setSessionDays(parseInt(e.target.value) || 7)}
          style={{ width: 80, padding: "6px 10px", borderRadius: 8, border: `0.5px solid ${S.border}`, fontSize: 14, background: S.card, color: S.text }} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 500, color: S.text, marginBottom: 8 }}>Prescribed exercises</div>
      {exercises.map(ex => (
        <div key={ex.id}>
          {editingId === ex.id
            ? <ExerciseForm value={editEx} onChange={setEditEx}
                onSave={() => { setExercises(p => p.map(e => e.id === editingId ? { ...editEx } : e)); setEditingId(null); }}
                onCancel={() => setEditingId(null)} />
            : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: S.surface, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: S.text }}>{ex.name}</div>
                  <div style={{ fontSize: 12, color: S.muted }}>{ex.sets} sets × {ex.reps} reps · {ex.freq}× per day</div>
                </div>
                <button onClick={() => { setEditingId(ex.id); setEditEx({ ...ex }); }}
                  style={{ background: "none", border: `0.5px solid ${S.border}`, borderRadius: 6, color: S.muted, cursor: "pointer", fontSize: 12, padding: "3px 8px" }}>Edit</button>
                <button onClick={() => setExercises(p => p.filter(e => e.id !== ex.id))}
                  style={{ background: "none", border: "none", color: S.muted, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 2px" }}>×</button>
              </div>
            )}
        </div>
      ))}

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: S.text, marginBottom: 8 }}>Add exercise</div>
        <ExerciseForm value={newEx} onChange={setNewEx} onSave={addEx} saveLabel="+ Add exercise" />
      </div>

      <button onClick={generateLink} disabled={!patientName.trim() || exercises.length === 0}
        style={{ ...btn(!patientName.trim() || exercises.length === 0 ? "#ccc" : S.green), marginBottom: 12 }}>
        Generate patient link →
      </button>

      {generatedLink && (
        <div style={{ background: S.greenLight, borderRadius: 12, padding: "14px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: S.greenDark, marginBottom: 8 }}>Ready to send to {patientName}</div>
          <div style={{ fontSize: 11, color: S.greenDark, wordBreak: "break-all", background: "#fff", borderRadius: 8, padding: "8px 10px", marginBottom: 10, border: `0.5px solid #9FE1CB` }}>{generatedLink}</div>
          <button onClick={copyLink} style={{ ...btn(copied ? "#0F6E56" : S.green) }}>
            {copied ? "Copied! ✓" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
};

// ── PATIENT VIEW ──
const PatientView = ({ session }) => {
  const { patientName, therapistName, waNumber, email, sessionDays, exercises, sessionId } = session;
  const days = generateDays(sessionDays);
  const [logs, setLogs] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY(sessionId)) || "{}"); } catch { return {}; } });
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const [submitView, setSubmitView] = useState(false);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY(sessionId), JSON.stringify(logs)); } catch {} }, [logs, sessionId]);

  const getLog = (day, exId) => logs[day]?.[exId] || { done: null, sets: "", reps: "", pain: "", difficulty: "", notes: "" };
  const setLog = (day, exId, field, val) => setLogs(prev => ({ ...prev, [day]: { ...(prev[day] || {}), [exId]: { ...getLog(day, exId), [field]: val } } }));

  const allDone = exercises.every(ex => getLog(selectedDay, ex.id).done !== null);
  const totalDone = exercises.reduce((acc, ex) => acc + days.filter(d => getLog(d, ex.id).done === true).length, 0);
  const totalPossible = exercises.length * days.length;
  const overallPct = Math.round((totalDone / totalPossible) * 100);
  const summaryText = buildSummary(patientName, exercises, days, getLog);

  const sendWhatsApp = () => {
    const num = waNumber.replace(/\D/g, "");
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(summaryText)}`, "_blank");
  };
  const sendEmail = () => {
    window.open(`mailto:${email}?subject=${encodeURIComponent(`Exercise Compliance Report – ${patientName}`)}&body=${encodeURIComponent(summaryText)}`, "_blank");
  };

  if (submitView) return (
    <div style={{ padding: "1rem", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: S.text }}>Send to therapist</h2>
        <button onClick={() => setSubmitView(false)} style={{ fontSize: 13, color: S.green, background: "none", border: "none", cursor: "pointer" }}>← Back</button>
      </div>
      <div style={{ background: S.surface, borderRadius: 12, padding: "16px", marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: S.muted, marginBottom: 4 }}>Your overall compliance</div>
        <div style={{ fontSize: 40, fontWeight: 600, color: pillColor(overallPct) }}>{overallPct}%</div>
        <div style={{ fontSize: 12, color: S.muted }}>{totalDone} of {totalPossible} sessions completed</div>
      </div>
      <div style={{ background: S.card, border: `0.5px solid ${S.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>Summary preview</div>
        <pre style={{ fontSize: 11, color: S.text, whiteSpace: "pre-wrap", margin: 0, fontFamily: "monospace", lineHeight: 1.6 }}>{summaryText}</pre>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: waNumber && email ? "1fr 1fr" : "1fr", gap: 10 }}>
        {waNumber && <button onClick={sendWhatsApp} style={{ ...btn("#25D366"), padding: "13px 8px" }}>Send via WhatsApp</button>}
        {email && <button onClick={sendEmail} style={{ ...btn(S.green), padding: "13px 8px" }}>Send via Email</button>}
      </div>
    </div>
  );

  return (
    <div style={{ padding: "1rem", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: S.text }}>Hi {patientName} 👋</h2>
          {therapistName && <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>From {therapistName}</div>}
        </div>
        <button onClick={() => setSubmitView(true)}
          style={{ fontSize: 12, color: S.green, background: "none", border: `0.5px solid ${S.green}`, borderRadius: 8, padding: "5px 11px", cursor: "pointer" }}>
          Submit report
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        {days.map(d => {
          const logged = exercises.every(ex => getLog(d, ex.id).done !== null);
          const partial = exercises.some(ex => getLog(d, ex.id).done !== null) && !logged;
          const isToday = d === new Date().toISOString().split("T")[0];
          const selected = selectedDay === d;
          return (
            <button key={d} onClick={() => setSelectedDay(d)}
              style={{ minWidth: 52, padding: "8px 4px", borderRadius: 10, border: selected ? `2px solid ${S.green}` : `0.5px solid ${S.border}`, background: selected ? S.greenLight : S.card, cursor: "pointer", textAlign: "center", position: "relative", flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: S.muted }}>{new Date(d + "T00:00:00").toLocaleDateString("en-SG", { weekday: "short" })}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: selected ? S.greenDark : S.text }}>{new Date(d + "T00:00:00").getDate()}</div>
              {isToday && <div style={{ fontSize: 9, color: S.green }}>today</div>}
              {logged && <div style={{ width: 6, height: 6, borderRadius: 3, background: S.green, position: "absolute", top: 4, right: 5 }} />}
              {partial && <div style={{ width: 6, height: 6, borderRadius: 3, background: S.amber, position: "absolute", top: 4, right: 5 }} />}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 13, fontWeight: 500, color: S.muted, marginBottom: 14 }}>{formatDate(selectedDay)}</div>

      {exercises.map(ex => {
        const l = getLog(selectedDay, ex.id);
        return (
          <div key={ex.id} style={{ background: S.card, border: `0.5px solid ${S.border}`, borderRadius: 12, padding: "14px", marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: S.text, marginBottom: 2 }}>{ex.name}</div>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 12 }}>{ex.sets} sets × {ex.reps} reps · {ex.freq}× today</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[true, false].map(val => (
                <button key={String(val)} onClick={() => setLog(selectedDay, ex.id, "done", l.done === val ? null : val)}
                  style={{ padding: "11px", borderRadius: 10, border: l.done === val ? `2px solid ${val ? S.green : S.red}` : `0.5px solid ${S.border}`, background: l.done === val ? (val ? S.greenLight : S.redLight) : S.surface, color: l.done === val ? (val ? S.greenDark : "#A32D2D") : S.muted, cursor: "pointer", fontSize: 14, fontWeight: 500, fontFamily: "inherit" }}>
                  {val ? "✓ Done" : "✗ Missed"}
                </button>
              ))}
            </div>
            <div style={{ borderTop: `0.5px solid ${S.border}`, paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>Optional details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[["sets", "Sets done"], ["reps", "Reps done"]].map(([k, label]) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{label}</div>
                    <input type="number" min={0} placeholder={String(ex[k])} value={l[k]}
                      onChange={e => setLog(selectedDay, ex.id, k, e.target.value)}
                      style={{ ...inp, marginBottom: 0 }} />
                  </div>
                ))}
              </div>
              <ScaleSlider label="Pain level" field="pain" value={l.pain} onChange={(f, v) => setLog(selectedDay, ex.id, f, v)} />
              <ScaleSlider label="Difficulty" field="difficulty" value={l.difficulty} onChange={(f, v) => setLog(selectedDay, ex.id, f, v)} />
              <textarea placeholder="Notes…" value={l.notes} onChange={e => setLog(selectedDay, ex.id, "notes", e.target.value)}
                style={{ ...inp, marginBottom: 0, minHeight: 56, resize: "vertical" }} />
            </div>
          </div>
        );
      })}
      {allDone && (
        <div style={{ background: S.greenLight, borderRadius: 10, padding: "10px 14px", textAlign: "center", fontSize: 13, color: S.greenDark, marginBottom: 8 }}>
          All exercises logged for today ✓
        </div>
      )}
    </div>
  );
};

// ── ROOT ──
export default function App() {
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState("setup");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("session");
    if (s) {
      try { setSession(decompress(s)); setMode("patient"); } catch {}
    }
  }, []);

  if (mode === "patient" && session) return <PatientView session={session} />;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, padding: "1rem 1rem 0", maxWidth: 480, margin: "0 auto" }}>
        {["setup", "demo"].map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ padding: "6px 14px", borderRadius: 8, border: mode === m ? `2px solid ${S.green}` : `0.5px solid ${S.border}`, background: mode === m ? S.greenLight : S.card, color: mode === m ? S.greenDark : S.muted, cursor: "pointer", fontSize: 13, fontWeight: mode === m ? 500 : 400, fontFamily: "inherit" }}>
            {m === "setup" ? "Setup" : "Preview patient view"}
          </button>
        ))}
      </div>
      {mode === "setup"
        ? <SetupView />
        : <PatientView session={{ patientName: "Ahmad", therapistName: "John Mark", waNumber: "6591234567", email: "jm@prorehab.sg", sessionDays: 7, exercises: [{ id: 1, name: "Clamshells", sets: 3, reps: 15, freq: 1 }, { id: 2, name: "Single-leg deadlift", sets: 3, reps: 10, freq: 1 }], sessionId: "demo001", createdAt: new Date().toISOString().split("T")[0] }} />}
    </div>
  );
}
