"use client";

import { ArrowUpRight, Mic, MicOff, MoonStar } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useJournal } from "@/components/data-provider";
import { MOODS, type Mood } from "@/lib/types";

type SpeechRecognitionEventLike = { results: ArrayLike<{ 0: { transcript: string } }> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export default function CapturePage() {
  const { addEntry } = useJournal();
  const [content, setContent] = useState("");
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  async function saveEntry(input: { content: string; mood: Mood | null }) {
    setSaving(true);
    setMessage(null);
    try {
      await addEntry(input);
      setContent("");
      setSelectedMood(null);
      setMessage(input.mood && !input.content ? `已记下此刻的 ${input.mood}` : input.mood ? "这一刻和心情都收好了。" : "这一刻已经收好了。");
      setTimeout(() => setMessage(null), 2200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "暂时没有保存成功。");
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    await saveEntry({ content: content.trim(), mood: selectedMood });
  }

  async function saveMood(mood: Mood) {
    if (content.trim()) {
      setSelectedMood(mood);
      setMessage(`已选择 ${mood}，点“收进星空”后一起保存。`);
      setTimeout(() => setMessage(null), 2200);
      return;
    }
    await saveEntry({ content: "", mood });
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("这个浏览器暂不支持语音输入，可以继续使用文字记录。");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join("");
      setContent((current) => `${current}${current ? " " : ""}${transcript}`);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setMessage("没有听清，再试一次或直接打字吧。");
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setMessage("正在听。想到什么，就说什么。");
  }

  return (
    <div className="page capture-page">
      <div className="constellation" aria-hidden="true"><span /><span /><span /><span /><span /></div>
      <p className="eyebrow"><MoonStar size={13} /> 此刻记录</p>
      <h1>接住脑海里<br />刚刚闪过的光。</h1>
      <p className="lede">一句话、一个念头，或者只是一个心情。无需整理，也不用解释。</p>

      <form className="capture-card" onSubmit={submit}>
        <textarea
          aria-label="写下此刻的想法"
          className="capture-area"
          maxLength={5000}
          onChange={(event) => setContent(event.target.value)}
          placeholder="写下此刻想到的……"
          value={content}
        />
        <div className="capture-tools">
          <button aria-label={listening ? "停止语音输入" : "开始语音输入"} className={`voice-button ${listening ? "listening" : ""}`} onClick={toggleVoice} type="button">
            {listening ? <MicOff size={19} /> : <Mic size={19} />}
            <span>{listening ? "停止" : "语音输入"}</span>
          </button>
          <span className="hint">{content.length}/5000</span>
          <button className="primary capture-submit" disabled={saving || !content.trim()} type="submit">
            {saving ? "保存中" : "收进星空"}<ArrowUpRight size={16} />
          </button>
        </div>
      </form>

      <section className="mood-strip">
        <div><p className="eyebrow">可单独记录，也可配合文字</p><h2>此刻心情如何？</h2></div>
        <div className="mood-buttons">
          {MOODS.map((mood) => (
            <button
              aria-label={`记录心情 ${mood}`}
              aria-pressed={selectedMood === mood}
              className={selectedMood === mood ? "active" : ""}
              disabled={saving}
              key={mood}
              onClick={() => saveMood(mood)}
              type="button"
            >
              {mood}
            </button>
          ))}
        </div>
      </section>

      {message ? <p className="capture-message">{message}</p> : null}

    </div>
  );
}
