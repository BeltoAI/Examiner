function esc(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

function letterFromIndex(i) {
  return String.fromCharCode("A".charCodeAt(0) + i);
}

export function buildQTI12(exam) {
  const title = exam.title || "Generated Exam";
  const itemsXml = (exam.questions || []).map((q, idx) => {
    const ident = q.id || `q${idx+1}`;
    if (q.type === "mcq" || q.type === "true_false") {
      const choices = q.type === "mcq" ? (q.choices || []) : ["True","False"];
      const correctIndex = (typeof q.correct_choice === "number" ? q.correct_choice : 0);
      const correctLabel = letterFromIndex(Math.max(0, Math.min(choices.length-1, correctIndex)));
      const renderChoices = choices.map((c, i) => `
          <response_label ident="${letterFromIndex(i)}">
            <material><mattext texttype="text/plain">${esc(c)}</mattext></material>
          </response_label>`).join("");

      return `
    <item ident="${esc(ident)}" title="${esc(q.question)}">
      <presentation>
        <material><mattext texttype="text/plain">${esc(q.question)}</mattext></material>
        <response_lid ident="resp" rcardinality="Single">
          <render_choice>${renderChoices}
          </render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes>
          <decvar varname="SCORE" vartype="Decimal" minvalue="0" maxvalue="${esc(q.points ?? 1)}" />
        </outcomes>
        <respcondition continue="No">
          <conditionvar>
            <varequal respident="resp">${correctLabel}</varequal>
          </conditionvar>
          <setvar varname="SCORE" action="Set">${esc(q.points ?? 1)}</setvar>
        </respcondition>
      </resprocessing>
    </item>`;
    } else {
      // Essay
      return `
    <item ident="${esc(q.id || `q${idx+1}`)}" title="${esc(q.question)}">
      <presentation>
        <material><mattext texttype="text/plain">${esc(q.question)}</mattext></material>
        <response_str ident="resp" rcardinality="Single">
          <render_fib fibtype="String" />
        </response_str>
      </presentation>
      <resprocessing>
        <outcomes>
          <decvar varname="SCORE" vartype="Decimal" minvalue="0" maxvalue="${esc(q.points ?? 5)}" />
        </outcomes>
      </resprocessing>
    </item>`;
    }
  }).join("\n");

  const assessment = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <assessment ident="asmt1" title="${esc(title)}">
    <section ident="root_section">
${itemsXml}
    </section>
  </assessment>
</questestinterop>`;

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="man1" version="1.1"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd">
  <organizations/>
  <resources>
    <resource identifier="res1" type="imsqti_xmlv1p2" href="assessment.xml">
      <file href="assessment.xml"/>
    </resource>
  </resources>
</manifest>`;

  return { assessmentXml: assessment, manifestXml: manifest };
}
