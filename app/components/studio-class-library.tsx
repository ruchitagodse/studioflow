"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createClassAction, updateClassAction, type ScheduleState } from "@/app/studio/schedule-actions";
import { StudioAction, StudioIcon } from "./studio-icon";
import styles from "./studio-class-library.module.css";

type ClassItem = { id: string; name: string; description: string; durationMinutes: number; status: string };
const initial: ScheduleState = {};

function ClassForm({ item, onClose }: { item: ClassItem | null; onClose: () => void }) {
  const [state, action, pending] = useActionState(item ? updateClassAction : createClassAction, initial);
  const [operationId] = useState(() => crypto.randomUUID());
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; if (element && !element.open) element.showModal(); }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="class-form-title" onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <header><h2 id="class-form-title"><StudioAction icon={item ? "edit" : "add"}>{item ? "Edit class" : "New class"}</StudioAction></h2><button type="button" className={styles.button} disabled={pending} onClick={onClose} aria-label="Close class form"><StudioIcon name="close" /></button></header>
    <div className={styles.body}><form id="studio-class-form" action={action} className={styles.form}>
      {item ? <input type="hidden" name="classId" value={item.id} /> : <input type="hidden" name="operationId" value={operationId} />}
      <label>Class name<input name="name" defaultValue={item?.name} required minLength={2} maxLength={80} disabled={pending} /></label>
      <label>Description (optional)<textarea name="description" defaultValue={item?.description} maxLength={400} disabled={pending} /></label>
      <label>Duration (minutes)<input name="durationMinutes" type="number" min={15} max={240} defaultValue={item?.durationMinutes ?? 50} required disabled={pending} /></label>
      <label>Status<select name="status" defaultValue={item?.status ?? "active"} disabled={pending}><option value="active">Active</option><option value="draft">Draft</option>{item && <option value="retired">Retired</option>}</select></label>
      {item && <p className={styles.note}>Existing sessions keep their details. Retiring prevents new sessions.</p>}
      {state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status"><StudioAction icon="check">{state.success}</StudioAction></p>}
    </form></div>
    <footer><button type="button" className={styles.button} disabled={pending} onClick={onClose}>{state.success ? "Done" : "Close"}</button><button className={`${styles.button} ${styles.primary}`} type="submit" form="studio-class-form" disabled={pending || (!item && !!state.success)}><StudioAction icon={item ? "save" : "add"}>{pending ? "Saving…" : item ? "Save changes" : "Create class"}</StudioAction></button></footer>
  </dialog>;
}

export function StudioClassLibrary({ classes }: { classes: ClassItem[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState<{ item: ClassItem | null } | null>(null);
  const visible = classes.filter(item => (status === "all" || item.status === status) && `${item.name} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className={styles.page}><header className={styles.header}><h1><StudioAction icon="list">Classes</StudioAction></h1><button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => setEditor({item:null})}><StudioAction icon="add">New class</StudioAction></button></header>
    <section className={styles.panel} aria-label="Class library"><div className={styles.tools}><label className={styles.search}><StudioIcon name="search" /><span className="sr-only">Search classes</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search classes…" /></label><div className={styles.filters} role="group" aria-label="Class status">{["all","active","draft","retired"].map(value => <button key={value} type="button" aria-pressed={value===status} onClick={()=>setStatus(value)}>{value[0].toUpperCase()+value.slice(1)} ({classes.filter(item=>value==="all"||item.status===value).length})</button>)}</div></div>
      <p className={styles.count} aria-live="polite">{visible.length} of {classes.length} classes on this page</p>
      {visible.map(item=><article key={item.id} className={styles.row}><span className={styles.icon}><StudioIcon name="list" /></span><div><h2>{item.name}</h2>{item.description && <p>{item.description}</p>}<div className={styles.meta}><StudioAction icon="clock">{item.durationMinutes} min</StudioAction></div></div><span className={styles.status} data-status={item.status}><StudioIcon name={item.status==="active"?"check":item.status==="retired"?"lock":"edit"} />{item.status}</span><button type="button" className={styles.button} onClick={()=>setEditor({item})} aria-label={`Edit ${item.name}`}><StudioAction icon="edit">Edit class</StudioAction></button></article>)}
      {!visible.length && <div className={styles.empty}><StudioIcon name="list" /><h2>{classes.length?"No matching classes":"No classes yet"}</h2>{classes.length?<button type="button" className={styles.button} onClick={()=>{setQuery("");setStatus("all");}}>Clear filters</button>:<p>Create a class to start scheduling sessions.</p>}</div>}
    </section>{editor && <ClassForm item={editor.item} onClose={()=>setEditor(null)} />}
  </main>;
}
