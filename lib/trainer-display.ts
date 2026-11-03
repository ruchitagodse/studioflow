import { trainerSessionStatus, type TrainerSlot } from "./trainer-schedule-logic";

export function trainerDateKey(date:Date,timezone:string) {
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const get=(type:string)=>parts.find(part=>part.type===type)?.value??"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function trainerDisplayDate(key:string) {
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if(!match)return key;
  return new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",weekday:"short",day:"numeric",month:"short"}).format(new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]))));
}
export function trainerSessionLabel(slot:Pick<TrainerSlot,"status"|"startsAt"|"endsAt">,now:Date) {
  const status=trainerSessionStatus(slot,now);
  return {status,label:status==="in-progress"?"In progress":status==="completed"?"Ended":status==="draft"?"Draft":"Upcoming"};
}
