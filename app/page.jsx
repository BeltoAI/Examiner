"use client";

import { useState } from "react";
import ExamPreview from "../components/ExamPreview";

export default function Page() {
  const [lecture, setLecture] = useState("");
  const [loading, setLoading] = useState(false);
  const [exam, setExam] = useState(null);
  const [title, setTitle] = useState("Midterm: Generated from Lecture");

  async function generateExam() {
    if (!lecture.trim()) {
      alert("Paste lecture material first.");
      return;
    }
    setLoading(true);
    setExam(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lecture, options: { title } })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setExam(data);
    } catch (err) {
      console.error(err);
      alert("Generation failed. Check server logs or your LLM endpoint.");
    } finally {
      setLoading(false);
    }
  }

  async function exportQTI() {
    if (!exam) { alert("Generate an exam first."); return; }
    try {
      const res = await fetch("/api/export-qti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exam)
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "canvas-qti.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("QTI export failed.");
    }
  }

  return (
    <section>
      <h1 style={{marginBottom:"0.25rem"}}>Exam Forge</h1>
      <p style={{marginTop:0}}>Paste lecture text, then generate a balanced exam (MCQ / True–False / Essay). Export to Canvas (QTI) in one click.</p>

      <article>
        <label htmlFor="title">Exam title</label>
        <input id="title" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Midterm: Generated from Lecture" />

        <label htmlFor="lecture">Lecture material</label>
        <textarea id="lecture" rows={12} value={lecture} onChange={(e)=>setLecture(e.target.value)} placeholder="Paste raw lecture notes, slides text, transcript..."></textarea>

        <div style={{display:"flex", gap:"1rem", marginTop:"1rem"}}>
          <button onClick={generateExam} aria-busy={loading}>{loading ? "Generating…" : "Generate Exam"}</button>
          <button onClick={exportQTI} className="secondary" disabled={!exam}>Export Canvas QTI (.zip)</button>
        </div>
      </article>

      {exam && (
        <article style={{marginTop:"2rem"}}>
          <ExamPreview exam={exam}/>
        </article>
      )}
    </section>
  );
}
