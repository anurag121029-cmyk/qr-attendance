"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ClassRow { id: string; name: string; department: string; join_code: string; teacher_id: string; }
interface SubjectRow { id: string; class_id: string; name: string; code: string; }

export default function ClassesPage() {
  const sb = createClient();
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectClassId, setSubjectClassId] = useState("");
  const [joinCode, setJoinCode] = useState("");

  async function load() {
    if (!sb) { setError("Supabase is not configured. Add keys to .env.local (see README)."); return; }
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return;
    setUserId(auth.user.id);
    const { data: prof } = await sb.from("profiles").select("role").eq("id", auth.user.id).single();
    setRole((prof as { role: string } | null)?.role ?? "");
    const { data: cls } = await sb.from("classes").select("id, name, department, join_code, teacher_id").order("created_at", { ascending: false });
    setClasses((cls ?? []) as ClassRow[]);
    const { data: sub } = await sb.from("subjects").select("id, class_id, name, code").order("created_at", { ascending: false });
    setSubjects((sub ?? []) as SubjectRow[]);
  }
  useEffect(() => { load(); }, []);

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMsg("");
    if (!sb) return;
    const { error } = await sb.from("classes").insert({ name, department: dept, teacher_id: userId });
    if (error) setError(error.message);
    else { setMsg("Class created. Share its join code with students."); setName(""); setDept(""); load(); }
  }

  async function createSubject(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMsg("");
    if (!sb) return;
    const { error } = await sb.from("subjects").insert({ class_id: subjectClassId, name: subjectName, code: subjectCode });
    if (error) setError(error.message);
    else { setMsg("Subject added."); setSubjectName(""); setSubjectCode(""); load(); }
  }

  async function joinClass(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMsg("");
    if (!sb) return;
    const { data: cls, error } = await sb.from("classes").select("id").eq("join_code", joinCode.trim()).single();
    if (error || !cls) { setError("No class found with that join code."); return; }
    const { error: insErr } = await sb.from("class_enrollments").insert({ class_id: (cls as { id: string }).id, student_id: userId });
    if (insErr) setError(insErr.message);
    else { setMsg("Joined the class. Its sessions now show on your dashboard."); setJoinCode(""); load(); }
  }

  if (!sb) return <div className="notice"><strong>Supabase is not configured.</strong> Add keys to .env.local (see README).</div>;

  return (
    <div>
      <h1>Classes</h1>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}
      {role === "student" && (
        <div className="card">
          <h2>Join a class</h2>
          <p className="muted">Ask your teacher for the class join code (6 letters).</p>
          <form onSubmit={joinClass}>
            <label htmlFor="join_code">Join code</label>
            <input id="join_code" className="input" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} required />
            <div style={{ marginTop: "1rem" }}><button className="btn" type="submit">Join class</button></div>
          </form>
        </div>
      )}
      {(role === "teacher" || role === "admin") && (
        <>
          <div className="card">
            <h2>Create a class</h2>
            <form onSubmit={createClass}>
              <label htmlFor="class_name">Class name</label>
              <input id="class_name" className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CSE 3rd Sem — Section A" />
              <label htmlFor="dept">Department</label>
              <input id="dept" className="input" value={dept} onChange={(e) => setDept(e.target.value)} placeholder="e.g. CSE" />
              <div style={{ marginTop: "1rem" }}><button className="btn" type="submit">Create class</button></div>
            </form>
          </div>
          <div className="card">
            <h2>Add a subject</h2>
            <form onSubmit={createSubject}>
              <label htmlFor="subject_class">Class</label>
              <select id="subject_class" className="input" value={subjectClassId} onChange={(e) => setSubjectClassId(e.target.value)} required>
                <option value="">Select a class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label htmlFor="subject_name">Subject name</label>
              <input id="subject_name" className="input" required value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="e.g. Data Structures" />
              <label htmlFor="subject_code">Subject code (optional)</label>
              <input id="subject_code" className="input" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="e.g. CS-301" />
              <div style={{ marginTop: "1rem" }}><button className="btn" type="submit">Add subject</button></div>
            </form>
          </div>
        </>
      )}
      <div className="card">
        <h2>All classes</h2>
        {classes.length === 0 ? <p className="muted">No classes yet.</p> : (
          <table className="data">
            <thead><tr><th>Class</th><th>Department</th><th>Join code</th><th>Subjects</th></tr></thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.department}</td>
                  <td><code>{c.join_code}</code></td>
                  <td>{subjects.filter((s) => s.class_id === c.id).map((s) => s.name).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
