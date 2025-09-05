import { NextResponse } from "next/server";
import JSZip from "jszip";
import { buildQTI12 } from "../../../lib/qti";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const exam = await req.json();
    if (!exam || !Array.isArray(exam.questions) || exam.questions.length === 0) {
      return NextResponse.json({ error: "No exam data." }, { status: 400 });
    }

    const { assessmentXml, manifestXml } = buildQTI12(exam);

    const zip = new JSZip();
    zip.file("assessment.xml", assessmentXml);
    zip.file("imsmanifest.xml", manifestXml);

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="canvas-qti.zip"'
      }
    });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
