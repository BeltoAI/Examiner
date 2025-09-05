export default function ExamPreview({ exam }) {
  return (
    <div>
      <h2 style={{marginBottom:"0.25rem"}}>{exam.title || "Generated Exam"}</h2>
      {exam.instructions && <p style={{opacity:0.8, whiteSpace:"pre-wrap"}}>{exam.instructions}</p>}
      <ol style={{paddingLeft:"1.25rem"}}>
        {exam.questions?.map((q, idx) => (
          <li key={q.id || idx} style={{marginBottom:"1rem"}}>
            <div style={{fontWeight:600, marginBottom:"0.25rem"}}>
              [{q.type.toUpperCase()}] {q.question}
            </div>
            {q.type === "mcq" && (
              <ul style={{listStyle:"upper-alpha", paddingLeft:"1.25rem"}}>
                {q.choices?.map((c, i) => (
                  <li key={i} style={{marginBottom:"0.125rem"}}>
                    {c}
                    {q.correct_choice === i ? "  ✓" : ""}
                  </li>
                ))}
              </ul>
            )}
            {q.type === "true_false" && (
              <ul style={{listStyle:"none", paddingLeft:0}}>
                <li>True {q.correct_choice === 0 ? "✓" : ""}</li>
                <li>False {q.correct_choice === 1 ? "✓" : ""}</li>
              </ul>
            )}
            {q.type === "essay" && (
              <em style={{opacity:0.8}}>Free-response. Suggested rubric: clarity, evidence, structure.</em>
            )}
            {q.explanation && (
              <div style={{marginTop:"0.25rem", fontSize:"0.95rem", opacity:0.8}}>
                Rationale: {q.explanation}
              </div>
            )}
            {typeof q.points === "number" && (
              <div style={{fontSize:"0.9rem", opacity:0.8}}>Points: {q.points}</div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
