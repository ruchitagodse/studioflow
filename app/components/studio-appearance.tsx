"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { StudioAction, StudioIcon } from "./studio-icon";
import { ownerThemeAction } from "@/app/studio/theme-actions";
import { studioThemes, themeIds, resolveTheme } from "@/lib/theme";
import styles from "./studio-appearance.module.css";

type Palette = { id:string; name:string; background:string; surface:string; primary:string; accent:string; text:string; buttonText:string };
type Choice = { value:string; name:string; background:string; surface:string; primary:string; text:string; muted:string; buttonText:string; description:string };
export function StudioAppearance({theme,brandPaletteId,palettes}:{theme:string;brandPaletteId:string|null;palettes:Palette[]}) {
  const initialValue=theme==="custom-brand"?`custom-brand:${brandPaletteId}`:resolveTheme(theme);
  const [selected,setSelected]=useState(initialValue);
  const [saved,setSaved]=useState(initialValue);
  const choices:Choice[]=[...themeIds.map(id=>{const item=studioThemes[id];return {value:id,name:item.name,background:item.background,surface:item.surface,primary:item.primary,text:item.text,muted:item.textMuted,buttonText:item.buttonText,description:item.description};}),...palettes.map(item=>({value:`custom-brand:${item.id}`,name:item.name,background:item.background,surface:item.surface,primary:item.primary,text:item.text,muted:item.text,buttonText:item.buttonText,description:"Approved studio brand palette"}))];
  const preview=choices.find(item=>item.value===selected)??choices[0];
  const savedName=choices.find(item=>item.value===saved)?.name??"Previous brand palette";
  const [state,save,pending]=useActionState(async (_:{error:string|null;success:string},form:FormData)=>{
    const value=String(form.get("theme"));
    const result=await ownerThemeAction(form);
    if(result.error)return {error:result.error,success:""};
    setSaved(value);
    return {error:null,success:"Studio appearance saved."};
  },{error:null,success:""});
  const previewColors={"--sample-bg":preview.background,"--sample-surface":preview.surface,"--sample-primary":preview.primary,"--sample-text":preview.text,"--sample-muted":preview.muted,"--sample-button-text":preview.buttonText} as CSSProperties;
  return <section className={styles.page}>
    <header className={styles.header}><h1><StudioAction icon="palette">Appearance</StudioAction></h1><p>Saved theme: <strong>{savedName}</strong></p></header>
    <form action={save}>
      <div className={styles.workspace}><fieldset className={styles.options} disabled={pending}><legend>Choose a theme</legend>{choices.map(item=><label className={styles.option} key={item.value} data-selected={selected===item.value}>
        <input type="radio" name="theme" value={item.value} checked={selected===item.value} onChange={()=>setSelected(item.value)}/>
        <span className={styles.swatches} aria-hidden="true"><i style={{background:item.background}}/><i style={{background:item.primary}}/><i style={{background:item.surface}}/></span>
        <span className={styles.optionCopy}><strong>{item.name}</strong><small>{item.description}</small>{saved===item.value&&<span className={styles.saved}><StudioAction icon="check">Saved</StudioAction></span>}</span>
      </label>)}</fieldset>
      <aside className={styles.previewPanel} aria-label="Selected theme preview"><h2><StudioAction icon="eye">Sample preview</StudioAction></h2><p>{preview.name}</p><div className={styles.sample} style={previewColors}>
        <div className={styles.sampleHeading}><StudioIcon name="calendar"/><strong>Your studio</strong></div><div className={styles.sampleClass}><span>CLASS</span><h3>Reformer</h3><p><StudioAction icon="clock">50 min</StudioAction></p><span className={styles.sampleAction}>View session <StudioIcon name="arrow"/></span></div>
      </div><p className={styles.previewNote}>Preview only. Save to apply across your studio.</p></aside></div>
      <footer className={styles.footer}><div aria-live="polite">{state.error?<p role="alert" className={styles.error}>{state.error}</p>:selected!==saved?<p><StudioAction icon="edit">Unsaved selection</StudioAction></p>:state.success?<p role="status"><StudioAction icon="check">{state.success}</StudioAction></p>:<p><StudioAction icon="check">Current appearance</StudioAction></p>}</div><div className={styles.actions}>{selected!==saved&&<button type="button" disabled={pending} onClick={()=>setSelected(saved)}>Reset</button>}<button type="submit" disabled={pending||selected===saved}><StudioAction icon="save">{pending?"Saving…":"Save appearance"}</StudioAction></button></div></footer>
    </form>
  </section>;
}
