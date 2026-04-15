"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useSession } from "next-auth/react";

interface QuestionOption {
  content: string;
  isCorrect: boolean;
}

interface Question {
  type: "multiple_choice" | "fill_in_blank" | "word_order";
  audioIndex: number | null;
  content: string;
  correctAnswer: string;
  explanation: string;
  options: QuestionOption[];
}

interface AudioEntry {
  title: string;
  audioUrl: string;
  ttsText: string;
  ttsType: string;
  uploading: boolean;
}

interface Vocabulary {
  word: string;
  meaning: string;
  pronunciation: string;
  exampleSentence: string;
}

export default function CreateExercisePage() {
  const { t } = useI18n();
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Basic info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hasQuiz, setHasQuiz] = useState(true);
  const [hasListening, setHasListening] = useState(false);
  const [audios, setAudios] = useState<AudioEntry[]>([
    { title: "", audioUrl: "", ttsText: "", ttsType: "paragraph", uploading: false },
  ]);

  // Step 2: Questions
  const [questions, setQuestions] = useState<Question[]>([
    {
      type: "multiple_choice",
      audioIndex: null,
      content: "",
      correctAnswer: "",
      explanation: "",
      options: [
        { content: "", isCorrect: true },
        { content: "", isCorrect: false },
        { content: "", isCorrect: false },
        { content: "", isCorrect: false },
      ],
    },
  ]);
  const [questionInputMode, setQuestionInputMode] = useState<"manual" | "import">("manual");
  const [questionImportText, setQuestionImportText] = useState("");

  const [audioInputMode, setAudioInputMode] = useState<"manual" | "import">("manual");
  const [audioImportText, setAudioImportText] = useState("");

  useEffect(() => {
    if (!hasListening) {
      setQuestions((prev) => prev.map((q) => ({ ...q, audioIndex: null })));
    }
  }, [hasListening]);

  // Step 3: Vocabulary
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([
    { word: "", meaning: "", pronunciation: "", exampleSentence: "" },
  ]);
  const [vocabInputMode, setVocabInputMode] = useState<"manual" | "import">("manual");
  const [vocabImportText, setVocabImportText] = useState("");

  // Compute exercise type
  const getExerciseType = (): "quiz" | "listening" | "mixed" => {
    if (hasQuiz && hasListening) return "mixed";
    if (hasListening) return "listening";
    return "quiz";
  };

  // --- Audio helpers ---
  const addAudio = () => {
    setAudios([...audios, { title: "", audioUrl: "", ttsText: "", ttsType: "paragraph", uploading: false }]);
  };

  const removeAudio = (index: number) => {
    if (audios.length > 1) {
      setAudios(audios.filter((_, i) => i !== index));
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.audioIndex == null) return q;
          if (q.audioIndex === index) {
            return { ...q, audioIndex: null };
          }
          if (q.audioIndex > index) {
            return { ...q, audioIndex: q.audioIndex - 1 };
          }
          return q;
        })
      );
    }
  };

  const handleImportAudios = () => {
    if (!audioImportText.trim()) return;
    
    // Split by [AUDIO*] tag
    const blocks = audioImportText.split(/(?=\[\s*AUDIO\b.*?\])/i).filter((b) => b.trim());
    const newAudios: AudioEntry[] = [];

    for (const block of blocks) {
      let ttsText = block.trim();
      let ttsType = "paragraph";
      
      const match = ttsText.match(/^\[\s*AUDIO\b(?::(conversation|paragraph))?\s*\]/i);
      if (match) {
        if (match[1]) ttsType = match[1].toLowerCase();
        ttsText = ttsText.substring(match[0].length).trim();
      }

      newAudios.push({
        title: "",
        audioUrl: "",
        ttsText,
        ttsType,
        uploading: false,
      });
    }

    if (newAudios.length > 0) {
      setAudios((prev) => {
        // If there's only one empty audio, replace it, else append
        if (prev.length === 1 && !prev[0].audioUrl && !prev[0].ttsText) {
          return newAudios;
        }
        return [...prev, ...newAudios];
      });
      setAudioInputMode("manual");
      setAudioImportText("");
    }
  };

  const updateAudio = (index: number, field: keyof AudioEntry, value: string | boolean) => {
    const updated = [...audios];
    updated[index] = { ...updated[index], [field]: value };
    setAudios(updated);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>, audioIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    updateAudio(audioIndex, "uploading", true);
    const formData = new FormData();
    formData.append("audio", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const updated = [...audios];
        updated[audioIndex] = { ...updated[audioIndex], audioUrl: data.url, uploading: false };
        setAudios(updated);
      } else {
        setError("Failed to upload audio");
        updateAudio(audioIndex, "uploading", false);
      }
    } catch {
      setError("Failed to upload audio");
      updateAudio(audioIndex, "uploading", false);
    }
  };

  // --- Question helpers ---
  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        type: "multiple_choice",
        audioIndex: null,
        content: "",
        correctAnswer: "",
        explanation: "",
        options: [
          { content: "", isCorrect: true },
          { content: "", isCorrect: false },
          { content: "", isCorrect: false },
          { content: "", isCorrect: false },
        ],
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, field: keyof Question, value: string) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "type" && (value === "fill_in_blank" || value === "word_order")) {
      updated[index].options = [];
    } else if (field === "type" && value === "multiple_choice") {
      updated[index].options = [
        { content: "", isCorrect: true },
        { content: "", isCorrect: false },
        { content: "", isCorrect: false },
        { content: "", isCorrect: false },
      ];
    }
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, field: keyof QuestionOption, value: string | boolean) => {
    const updated = [...questions];
    if (field === "isCorrect" && value === true) {
      updated[qIndex].options = updated[qIndex].options.map((o, i) => ({
        ...o,
        isCorrect: i === oIndex,
      }));
    } else {
      updated[qIndex].options[oIndex] = { ...updated[qIndex].options[oIndex], [field]: value };
    }
    setQuestions(updated);
  };

  const addOption = (qIndex: number) => {
    const updated = [...questions];
    updated[qIndex].options.push({ content: "", isCorrect: false });
    setQuestions(updated);
  };

  // --- Import questions from text ---
  const handleImportQuestions = () => {
    if (!questionImportText.trim()) return;

    const parsed: Question[] = [];
    let maxAudioIndex = -1;
    
    // Split text into blocks starting with "Q:"
    const blocks = questionImportText
      .split(/(?=(?:^|\n)\s*Q:)/i)
      .map((b) => b.trim())
      .filter((b) => b.toUpperCase().startsWith("Q:"));

    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.trim()).filter((l) => l !== "");
      if (lines.length === 0) continue;

      const questionLine = lines[0];

      const qContent = questionLine.slice(2).trim();
      const isFill = /\(fill\)/i.test(qContent);
      const isOrder = /\(order\)/i.test(qContent);
      const audioMatch = qContent.match(/\((audio|listen)\s*:\s*(\d+)\)/i);
      const audioIndex = audioMatch ? Math.max(0, Number(audioMatch[2]) - 1) : null;
      const cleanContent = qContent
        .replace(/\(fill\)/gi, "")
        .replace(/\(order\)/gi, "")
        .replace(/\((audio|listen)\s*:\s*\d+\)/gi, "")
        .trim();

      if (audioIndex != null) {
        maxAudioIndex = Math.max(maxAudioIndex, audioIndex);
      }

      const answers = lines.slice(1).filter((l) => l.trim().startsWith("A:"));

      // Note: order has priority. If it's a fill_in_blank or just 1 answer without (order), defaults to fill_in_blank
      if (isOrder) {
        const correctAnswer = answers.length > 0 ? answers[0].slice(2).replace("*", "").trim() : "";
        parsed.push({
          type: "word_order",
          audioIndex,
          content: cleanContent,
          correctAnswer,
          explanation: "",
          options: [],
        });
      } else if (isFill || answers.length <= 1) {
        // Fill in blank
        const correctAnswer = answers.length > 0 ? answers[0].slice(2).replace("*", "").trim() : "";
        parsed.push({
          type: "fill_in_blank",
          audioIndex,
          content: cleanContent,
          correctAnswer,
          explanation: "",
          options: [],
        });
      } else {
        // Multiple choice
        const options = answers.map((a) => {
          const raw = a.slice(2).trim();
          const isCorrect = raw.includes("*");
          const content = raw.replace("*", "").trim();
          return { content, isCorrect };
        });
        // Ensure at least one correct
        if (!options.some((o) => o.isCorrect) && options.length > 0) {
          options[0].isCorrect = true;
        }
        parsed.push({
          type: "multiple_choice",
          audioIndex,
          content: cleanContent,
          correctAnswer: "",
          explanation: "",
          options,
        });
      }
    }

    if (parsed.length > 0) {
      setQuestions(parsed);
      if (maxAudioIndex >= 0) {
        setHasListening(true);
        setAudios((prev) => {
          if (prev.length > maxAudioIndex) return prev;
          const next = [...prev];
          while (next.length <= maxAudioIndex) {
            next.push({
              title: "",
              audioUrl: "",
              ttsText: "",
              ttsType: "paragraph",
              uploading: false,
            });
          }
          return next;
        });
      }
      setQuestionInputMode("manual");
      setQuestionImportText("");
    }
  };

  // --- Vocabulary helpers ---
  const addVocabulary = () => {
    setVocabularies([
      ...vocabularies,
      { word: "", meaning: "", pronunciation: "", exampleSentence: "" },
    ]);
  };

  const removeVocabulary = (index: number) => {
    setVocabularies(vocabularies.filter((_, i) => i !== index));
  };

  const updateVocabulary = (index: number, field: keyof Vocabulary, value: string) => {
    const updated = [...vocabularies];
    updated[index] = { ...updated[index], [field]: value };
    setVocabularies(updated);
  };

  // --- Import vocabulary from text ---
  const handleImportVocab = () => {
    if (!vocabImportText.trim()) return;

    const parsed: Vocabulary[] = [];
    const lines = vocabImportText.trim().split("\n").filter((l) => l.trim());

    for (const line of lines) {
      const parts = line.split(" - ").map((p) => p.trim());
      if (parts.length < 2) continue;

      parsed.push({
        word: parts[0],
        meaning: parts[1],
        pronunciation: parts[2] || "",
        exampleSentence: parts[3] || "",
      });
    }

    if (parsed.length > 0) {
      setVocabularies(parsed);
      setVocabInputMode("manual");
      setVocabImportText("");
    }
  };

  const handleSubmit = async (isPublished: boolean) => {
    setLoading(true);
    setError("");

    try {
      const filteredVocabularies = vocabularies.filter(
        (v) => v.word.trim() && v.meaning.trim()
      );

      const filteredAudios = audios
        .filter((a) => a.audioUrl || a.ttsText)
        .map(({ title, audioUrl, ttsText, ttsType }) => ({ title, audioUrl, ttsText, ttsType }));
      const audioIndexMap = new Map<number, number>();
      let nextAudioIndex = 0;
      audios.forEach((audio, originalIndex) => {
        if (audio.audioUrl || audio.ttsText) {
          audioIndexMap.set(originalIndex, nextAudioIndex);
          nextAudioIndex += 1;
        }
      });

      const hasInvalidListeningQuestion = questions.some(
        (q) => q.audioIndex != null && !audioIndexMap.has(q.audioIndex)
      );
      if (hasInvalidListeningQuestion) {
        setError("Có câu hỏi nghe đang gắn với bài nghe chưa có audio/TTS.");
        setLoading(false);
        return;
      }

      const preparedQuestions = questions.map((q) => ({
        ...q,
        audioIndex:
          q.audioIndex != null ? (audioIndexMap.get(q.audioIndex) ?? null) : null,
      }));

      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          type: getExerciseType(),
          audios: filteredAudios.length > 0 ? filteredAudios : undefined,
          isPublished,
          questions: preparedQuestions,
          vocabularies: filteredVocabularies.length > 0 ? filteredVocabularies : undefined,
        }),
      });

      if (res.ok) {
        const exercise = await res.json();
        router.push(`/exercises/${exercise.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create exercise");
      }
    } catch {
      setError("Failed to create exercise");
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold gradient-text mb-2">{t.exercise.create}</h1>
      <p className="text-muted mb-8">Tạo bài tập mới cho cộng đồng</p>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => setStep(s)}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                step === s
                  ? "bg-primary text-white glow"
                  : step > s
                  ? "bg-success/20 text-success border border-success/30"
                  : "bg-surface text-muted border border-border"
              }`}
            >
              {step > s ? "✓" : s}
            </button>
            {s < 3 && (
              <div className={`flex-1 h-0.5 rounded ${step > s ? "bg-success/50" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="glass p-6 animate-fade-in-up space-y-5">
          <h2 className="text-xl font-semibold mb-4">
            {t.common.step} 1: Thông tin cơ bản
          </h2>
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">{t.exercise.title} *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full"
              placeholder="e.g., English Vocabulary - Travel"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">{t.exercise.description}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full !min-h-[80px]"
              placeholder="Mô tả ngắn về bài tập..."
            />
          </div>

          {/* Type: Checkboxes */}
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">{t.exercise.type}</label>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setHasQuiz(!hasQuiz);
                  if (!hasQuiz === false && !hasListening) setHasListening(true);
                }}
                className={`flex-1 p-4 rounded-xl border text-center transition-all ${
                  hasQuiz
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted hover:border-primary/40"
                }`}
              >
                <div className="text-2xl mb-1">📝</div>
                <div className="text-sm font-medium">{t.exercise.quiz}</div>
                {hasQuiz && (
                  <svg className="w-5 h-5 mx-auto mt-1 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => {
                  setHasListening(!hasListening);
                  if (!hasListening === false && !hasQuiz) setHasQuiz(true);
                }}
                className={`flex-1 p-4 rounded-xl border text-center transition-all ${
                  hasListening
                    ? "border-secondary bg-secondary/10 text-secondary"
                    : "border-border bg-surface text-muted hover:border-secondary/40"
                }`}
              >
                <div className="text-2xl mb-1">🎧</div>
                <div className="text-sm font-medium">{t.exercise.listening}</div>
                {hasListening && (
                  <svg className="w-5 h-5 mx-auto mt-1 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </div>
            {hasQuiz && hasListening && (
              <p className="text-xs text-secondary mt-2 flex items-center gap-1">
                <span>✨</span> {t.exercise.mixed} - Bài tập kết hợp trắc nghiệm và luyện nghe
              </p>
            )}
          </div>

          {/* Listening: Multiple Audio entries */}
          {hasListening && (
            <div className="space-y-3 animate-slide-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">🎧 Bài nghe ({audios.length})</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAudioInputMode(audioInputMode === "manual" ? "import" : "manual")}
                    className="btn-secondary text-xs bg-surface"
                  >
                    {audioInputMode === "manual" ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Import từ văn bản
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Nhập thủ công
                      </>
                    )}
                  </button>
                  {audioInputMode === "manual" && (
                    <button onClick={addAudio} className="btn-secondary text-xs">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Thêm bài nghe
                    </button>
                  )}
                </div>
              </div>

              {/* Audio Import Mode */}
              {audioInputMode === "import" && (
                <div className="glass p-5 space-y-3 mb-4">
                  <p className="text-xs text-muted">Dán kịch bản bài nghe của bạn vào đây. Có thể sử dụng thẻ <code>[AUDIO:conversation]</code> hoặc <code>[AUDIO:paragraph]</code> để phân tách và định dạng nhiều bài nghe cùng lúc.</p>
                  <textarea
                    value={audioImportText}
                    onChange={(e) => setAudioImportText(e.target.value)}
                    className="w-full !min-h-[150px] font-mono text-sm"
                    placeholder="[AUDIO:conversation]\nA: Hello!\nB: Hi there!\n\n[AUDIO:paragraph]\nThis is a long passage..."
                  />
                  <button
                    onClick={handleImportAudios}
                    disabled={!audioImportText.trim()}
                    className="btn-primary text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import bài nghe
                  </button>
                </div>
              )}

              {audioInputMode === "manual" && audios.map((audio, aIndex) => (
                <div key={aIndex} className="p-4 rounded-xl border border-border bg-surface/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-secondary">Bài nghe {aIndex + 1}</span>
                    {audios.length > 1 && (
                      <button
                        onClick={() => removeAudio(aIndex)}
                        className="text-error/70 hover:text-error text-xs transition-colors"
                      >
                        Xóa
                      </button>
                    )}
                  </div>

                  {/* Title */}
                  <input
                    type="text"
                    value={audio.title}
                    onChange={(e) => updateAudio(aIndex, "title", e.target.value)}
                    className="w-full"
                    placeholder="Tiêu đề bài nghe (tùy chọn)"
                  />

                  {/* Upload Audio */}
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">{t.exercise.uploadAudio}</label>
                    <input
                      id={`audio-upload-${aIndex}`}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => handleAudioUpload(e, aIndex)}
                      className="hidden"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => document.getElementById(`audio-upload-${aIndex}`)?.click()}
                        className="btn-secondary text-xs"
                        disabled={audio.uploading}
                      >
                        {audio.uploading ? (
                          <div className="spinner !w-3.5 !h-3.5 !border-2" />
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            {t.exercise.uploadAudio}
                          </>
                        )}
                      </button>
                      {audio.audioUrl && (
                        <span className="text-xs text-success flex items-center gap-1">✓ Đã tải lên</span>
                      )}
                    </div>
                  </div>

                  <div className="text-center text-xs text-muted">— hoặc —</div>

                  {/* TTS */}
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">{t.exercise.ttsText}</label>
                    <div className="flex gap-2 mb-2">
                      {(["paragraph", "conversation"] as const).map((tp) => (
                        <button
                          key={tp}
                          onClick={() => updateAudio(aIndex, "ttsType", tp)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                            audio.ttsType === tp
                              ? "bg-secondary/20 text-secondary border border-secondary/30"
                              : "bg-surface border border-border text-muted"
                          }`}
                        >
                          {tp === "paragraph" ? t.exercise.paragraph : t.exercise.conversation}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={audio.ttsText}
                      onChange={(e) => updateAudio(aIndex, "ttsText", e.target.value)}
                      className="w-full !min-h-[80px]"
                      placeholder={
                        audio.ttsType === "conversation"
                          ? "A: Hello, how are you?\nB: I'm fine, thanks."
                          : "The weather today is sunny and warm..."
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="btn-primary" disabled={!title.trim()}>
              {t.common.next} →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Questions */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {t.common.step} 2: {t.exercise.questions}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setQuestionInputMode(questionInputMode === "manual" ? "import" : "manual")}
                className="btn-secondary text-xs"
              >
                {questionInputMode === "manual" ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {t.exercise.importText}
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {t.exercise.importManual}
                  </>
                )}
              </button>
              {questionInputMode === "manual" && (
                <button onClick={addQuestion} className="btn-secondary text-xs">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t.exercise.addQuestion}
                </button>
              )}
            </div>
          </div>

          {/* Import mode */}
          {questionInputMode === "import" && (
            <div className="glass p-5 space-y-3">
              <p className="text-xs text-muted">{t.exercise.importQuestionsFormat}</p>
              <p className="text-xs text-muted">
                Có thể thêm <code>(audio:1)</code> hoặc <code>(listen:1)</code> sau Q: để gắn câu hỏi vào bài nghe số 1. Dùng <code>(fill)</code> cho điền khuyết, <code>(order)</code> cho sắp xếp từ.
              </p>
              <textarea
                value={questionImportText}
                onChange={(e) => setQuestionImportText(e.target.value)}
                className="w-full !min-h-[200px] font-mono text-sm"
                placeholder={t.exercise.importQuestionsPlaceholder}
              />
              <button
                onClick={handleImportQuestions}
                disabled={!questionImportText.trim()}
                className="btn-primary text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {t.exercise.importBtn} ({questionImportText.split(/\nQ:/g).length - (questionImportText.startsWith("Q:") ? 0 : 1)} câu hỏi)
              </button>
            </div>
          )}

          {/* Manual mode */}
          {questionInputMode === "manual" && questions.map((q, qIndex) => (
            <div key={qIndex} className="glass p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm text-primary">
                  {t.exercise.question} {qIndex + 1}
                </h3>
                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(qIndex)}
                    className="text-error/70 hover:text-error text-xs font-medium transition-colors"
                  >
                    {t.exercise.removeQuestion}
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {(["multiple_choice", "fill_in_blank", "word_order"] as const).map((tp) => (
                  <button
                    key={tp}
                    onClick={() => updateQuestion(qIndex, "type", tp)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      q.type === tp
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-surface border border-border text-muted"
                    }`}
                  >
                    {tp === "multiple_choice" ? t.exercise.multipleChoice : tp === "fill_in_blank" ? t.exercise.fillInBlank : t.exercise.wordOrder}
                  </button>
                ))}
              </div>

              {hasListening && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted">Nhóm câu hỏi</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const updated = [...questions];
                        updated[qIndex] = { ...updated[qIndex], audioIndex: null };
                        setQuestions(updated);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        q.audioIndex == null
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-surface border border-border text-muted"
                      }`}
                    >
                      Câu hỏi thường
                    </button>
                    <button
                      onClick={() => {
                        const updated = [...questions];
                        updated[qIndex] = { ...updated[qIndex], audioIndex: 0 };
                        setQuestions(updated);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        q.audioIndex != null
                          ? "bg-secondary/20 text-secondary border border-secondary/30"
                          : "bg-surface border border-border text-muted"
                      }`}
                    >
                      Câu hỏi nghe
                    </button>
                  </div>
                  {q.audioIndex != null && (
                    <select
                      value={q.audioIndex}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[qIndex] = {
                          ...updated[qIndex],
                          audioIndex: Number(e.target.value),
                        };
                        setQuestions(updated);
                      }}
                      className="w-full"
                    >
                      {audios.map((audio, aIndex) => (
                        <option key={aIndex} value={aIndex}>
                          {audio.title?.trim() || `Bài nghe ${aIndex + 1}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t.exercise.question} *</label>
                <textarea
                  value={q.content}
                  onChange={(e) => updateQuestion(qIndex, "content", e.target.value)}
                  className="w-full !min-h-[60px]"
                  placeholder={
                    q.type === "fill_in_blank"
                      ? "I ___ to school every day. (go)"
                      : q.type === "word_order"
                      ? "Sắp xếp để tạo thành câu đúng: 'Đó là một dự án lớn.'"
                      : "Which is the correct answer?"
                  }
                />
              </div>

              {/* Answers */}
              {q.type === "multiple_choice" && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted">{t.exercise.option}</label>
                  {q.options.map((opt, oIndex) => (
                    <div key={oIndex} className="flex items-center gap-2">
                      <button
                        onClick={() => updateOption(qIndex, oIndex, "isCorrect", true)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          opt.isCorrect
                            ? "border-success bg-success text-white"
                            : "border-border hover:border-muted"
                        }`}
                      >
                        {opt.isCorrect && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <input
                        type="text"
                        value={opt.content}
                        onChange={(e) => updateOption(qIndex, oIndex, "content", e.target.value)}
                        className="flex-1"
                        placeholder={`${t.exercise.option} ${String.fromCharCode(65 + oIndex)}`}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => addOption(qIndex)}
                    className="text-xs text-primary hover:text-primary-light transition-colors font-medium"
                  >
                    + {t.exercise.addOption}
                  </button>
                </div>
              )}

              {/* Correct Answer Input for non-multiple-choice */}
              {(q.type === "fill_in_blank" || q.type === "word_order") && (
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">{t.exercise.correctAnswer} *</label>
                  <input
                    type="text"
                    value={q.correctAnswer}
                    onChange={(e) => updateQuestion(qIndex, "correctAnswer", e.target.value)}
                    className="w-full font-mono text-sm"
                    placeholder={
                      q.type === "word_order"
                        ? "That is a great project."
                        : "go"
                    }
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t.exercise.explanation}</label>
                <input
                  type="text"
                  value={q.explanation}
                  onChange={(e) => updateQuestion(qIndex, "explanation", e.target.value)}
                  className="w-full"
                  placeholder="Giải thích đáp án..."
                />
              </div>
            </div>
          ))}

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary">
              ← {t.common.previous}
            </button>
            <button onClick={() => setStep(3)} className="btn-primary">
              {t.common.next} →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Vocabulary */}
      {step === 3 && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {t.common.step} 3: {t.exercise.vocabulary}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setVocabInputMode(vocabInputMode === "manual" ? "import" : "manual")}
                className="btn-secondary text-xs"
              >
                {vocabInputMode === "manual" ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {t.exercise.importText}
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {t.exercise.importManual}
                  </>
                )}
              </button>
              {vocabInputMode === "manual" && (
                <button onClick={addVocabulary} className="btn-secondary text-xs">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t.exercise.addVocabulary}
                </button>
              )}
            </div>
          </div>

          {/* Import mode */}
          {vocabInputMode === "import" && (
            <div className="glass p-5 space-y-3">
              <p className="text-xs text-muted">{t.exercise.importVocabFormat}</p>
              <textarea
                value={vocabImportText}
                onChange={(e) => setVocabImportText(e.target.value)}
                className="w-full !min-h-[200px] font-mono text-sm"
                placeholder={t.exercise.importVocabPlaceholder}
              />
              <button
                onClick={handleImportVocab}
                disabled={!vocabImportText.trim()}
                className="btn-primary text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {t.exercise.importBtn} ({vocabImportText.trim().split("\n").filter((l) => l.includes(" - ")).length} từ)
              </button>
            </div>
          )}

          {/* Manual mode */}
          {vocabInputMode === "manual" && vocabularies.map((v, vIndex) => (
            <div key={vIndex} className="glass p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-primary">
                  {t.exercise.vocabulary} {vIndex + 1}
                </h3>
                {vocabularies.length > 1 && (
                  <button
                    onClick={() => removeVocabulary(vIndex)}
                    className="text-error/70 hover:text-error text-xs transition-colors"
                  >
                    {t.common.delete}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">{t.exercise.word} *</label>
                  <input
                    type="text"
                    value={v.word}
                    onChange={(e) => updateVocabulary(vIndex, "word", e.target.value)}
                    className="w-full"
                    placeholder="apple"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">{t.exercise.meaning} *</label>
                  <input
                    type="text"
                    value={v.meaning}
                    onChange={(e) => updateVocabulary(vIndex, "meaning", e.target.value)}
                    className="w-full"
                    placeholder="quả táo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">{t.exercise.pronunciation}</label>
                  <input
                    type="text"
                    value={v.pronunciation}
                    onChange={(e) => updateVocabulary(vIndex, "pronunciation", e.target.value)}
                    className="w-full"
                    placeholder="/ˈæp.əl/"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">{t.exercise.exampleSentence}</label>
                  <input
                    type="text"
                    value={v.exampleSentence}
                    onChange={(e) => updateVocabulary(vIndex, "exampleSentence", e.target.value)}
                    className="w-full"
                    placeholder="I eat an apple every day."
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Submit */}
          <div className="glass p-6 space-y-4">
            <h2 className="text-lg font-semibold">Xác nhận và xuất bản</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-surface border border-border">
                <div className="text-muted text-xs mb-1">{t.exercise.title}</div>
                <div className="font-medium">{title || "—"}</div>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border">
                <div className="text-muted text-xs mb-1">{t.exercise.type}</div>
                <div className="font-medium">
                  {getExerciseType() === "mixed"
                    ? t.exercise.mixed
                    : getExerciseType() === "quiz"
                    ? t.exercise.quiz
                    : t.exercise.listening}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border">
                <div className="text-muted text-xs mb-1">{t.exercise.questions}</div>
                <div className="font-medium">{questions.length}</div>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border">
                <div className="text-muted text-xs mb-1">{t.exercise.vocabulary}</div>
                <div className="font-medium">{vocabularies.filter((v) => v.word).length}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">
              <button onClick={() => setStep(2)} className="btn-secondary">
                ← {t.common.previous}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                  className="btn-secondary"
                >
                  {t.exercise.saveDraft}
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? (
                    <div className="spinner !w-5 !h-5 !border-2 !border-white/30 !border-t-white" />
                  ) : (
                    <>
                      {t.exercise.publish}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
