import type { Reflection, ReflectionDraft } from "@/lib/types";

export function ReflectionView({ reflection }: { reflection: Reflection | ReflectionDraft }) {
  return (
    <div>
      <h2 className="reflection-title">{reflection.title}</h2>
      <div className="reflection-grid">
        <section className="reflection-block wide diary"><h3>今天的日记</h3><p>{reflection.what_happened}</p></section>
        <section className="reflection-block"><h3>主要心情</h3><p>{reflection.main_emotions.join(" · ")}</p></section>
        <section className="reflection-block"><h3>反复出现的念头</h3><p>{reflection.repeated_worries.join(" · ") || "没有明显重复"}</p></section>
        <section className="reflection-block"><h3>可以确认的事实</h3><ul>{reflection.known_facts.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className="reflection-block"><h3>脑海里的推测</h3><ul>{reflection.guesses.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className="reflection-block wide analysis"><h3>心里可能在发生什么</h3><p>{reflection.anxiety_story}</p>{reflection.fear_meaning ? <p>{reflection.fear_meaning}</p> : null}</section>
        <section className="reflection-block wide accent"><h3>另一个温柔的角度</h3><p>{reflection.kinder_interpretation}</p></section>
        {reflection.companion_note ? <section className="reflection-block wide companion"><h3>像朋友一样跟你说</h3><p>{reflection.companion_note}</p></section> : null}
        <section className="reflection-block wide"><h3>一个小建议</h3><p>{reflection.next_step}</p></section>
      </div>
    </div>
  );
}
