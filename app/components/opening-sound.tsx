"use client";

import { useEffect,useRef,useState } from "react";
import { StudioAction } from "./studio-icon";
import styles from "./opening-sound.module.css";

/** The OS splash has no JavaScript; play once the installed app has loaded. */
export function OpeningSound() {
  const player=useRef<HTMLAudioElement|null>(null);
  const [status,setStatus]=useState<"hidden"|"ready"|"playing">("hidden");
  useEffect(()=>{
    const installed=window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
    if(!installed)return;
    let active=true;
    const audio=new Audio("/audio/studio-opening.mp4");audio.volume=.35;audio.preload="auto";player.current=audio;
    audio.onplay=()=>{if(active)setStatus("playing");};audio.onended=()=>{if(active)setStatus("hidden");};audio.onerror=()=>{if(active)setStatus("hidden");};
    void audio.play().catch((error:unknown)=>{if(active)setStatus(error instanceof DOMException&&error.name==="NotAllowedError"?"ready":"hidden");});
    return ()=>{active=false;audio.onplay=null;audio.onended=null;audio.onerror=null;audio.pause();player.current=null;};
  },[]);
  const stop=()=>{player.current?.pause();setStatus("hidden");};
  const play=()=>{void player.current?.play().catch(()=>setStatus("ready"));};
  if(status==="hidden")return null;
  return <aside className={styles.control} aria-label="Opening sound">{status==="ready"?<><button type="button" onClick={play}><StudioAction icon="sound">Play opening sound</StudioAction></button><button type="button" onClick={stop} className={styles.secondary}>Skip</button></>:<button type="button" onClick={stop} className={styles.secondary}><StudioAction icon="soundOff">Stop opening sound</StudioAction></button>}</aside>;
}
