"use client";
import { useEffect,useRef,useState } from "react";
import { StudioIcon,type StudioIconName } from "./studio-icon";
import styles from "./customer-section-picker.module.css";

const sections=[['Overview','home'],['Bookings','calendar'],['Membership','membership'],['Credits','credits'],['Attendance','check'],['Activity','history']] as const satisfies readonly (readonly [string,StudioIconName])[];
type Section=(typeof sections)[number][0];
function SectionDialog({value,onSelect,onClose}:{value:Section;onSelect:(value:Section)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const node=dialog.current;if(node&&!node.open){node.showModal();node.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();}},[]);
  const close=()=>{dialog.current?.close();onClose();};
  return <dialog ref={dialog} id="customer-profile-sections" className={styles.dialog} aria-labelledby="profile-section-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target!==event.currentTarget)return;const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close();}}><header><div><p>Customer profile</p><h2 id="profile-section-title">Go to section</h2></div><button type="button" onClick={close} aria-label="Close profile sections"><StudioIcon name="close"/></button></header><div className={styles.options}>{sections.map(([label,icon])=><button key={label} type="button" data-section={label} aria-pressed={value===label} onClick={()=>{dialog.current?.close();onSelect(label);}}><span className={styles.sectionIcon}><StudioIcon name={icon}/></span><span>{label}</span>{value===label?<span className={styles.selectedIcon}><StudioIcon name="check"/></span>:<StudioIcon name="arrow"/>}</button>)}</div></dialog>;
}
export function CustomerSectionPicker({value,onChange}:{value:Section;onChange:(value:Section)=>void}) {
  const [open,setOpen]=useState(false);
  const icon=sections.find(([label])=>label===value)![1];
  return <div className={styles.picker}><button type="button" className={styles.trigger} data-section={value} onClick={()=>setOpen(true)} aria-label={`Profile section: ${value}. Change section`} aria-haspopup="dialog" aria-controls={open?"customer-profile-sections":undefined} aria-expanded={open}><span className={styles.sectionIcon}><StudioIcon name={icon}/></span><span className={styles.triggerCopy}><small>Viewing</small><strong>{value}</strong></span><StudioIcon name="chevronDown"/></button>{open&&<SectionDialog value={value} onClose={()=>setOpen(false)} onSelect={section=>{onChange(section);setOpen(false);}}/>}</div>;
}
