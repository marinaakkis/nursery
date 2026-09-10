"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorState, Field, FileField, InlineSuccess, Select, Textarea } from "@/ui";
import styles from "./questions.module.css";

type GardenPlant = { plantId: number; nameRu: string };

/** Читает файл в data-URL. Вне компонента: обращается к внешнему миру. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("файл не прочитался"));
    reader.readAsDataURL(file);
  });
}

export function AskForm({ plants }: { plants: GardenPlant[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [plantId, setPlantId] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [sent, setSent] = useState<{ id: number; photoError?: string } | null>(null);

  async function submit() {
    setFieldError("");
    setError("");
    if (text.trim().length < 10) {
      setFieldError("Опишите, что происходит с растением, — хотя бы одним предложением.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/consult/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          plantId: plantId === "" ? undefined : Number(plantId),
          photo: photo ?? undefined,
        }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        setError(payload.error?.message ?? "Вопрос не отправился");
        return;
      }
      setSent({ id: payload.data.questionId, photoError: payload.data.photoError });
      setText("");
      setPhoto(null);
      setPhotoName("");
      router.refresh();
    } catch (cause) {
      console.error("вопрос не отправился", cause);
      setError("Не дозвонились до питомника. Попробуйте ещё раз — текст сохранён.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.form}>
        <InlineSuccess message={`Вопрос №${sent.id} отправлен агроному`} />
        {/* AC12: снимок мог не сохраниться, но вопрос ушёл — говорим об этом прямо. */}
        {sent.photoError ? (
          <ErrorState message={`Вопрос отправлен, а снимок — нет: ${sent.photoError}`} />
        ) : null}
        <Button variant="secondary" onClick={() => setSent(null)}>
          Задать ещё вопрос
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <h2>Задать вопрос агроному</h2>

      <Field
        id="question-text"
        label="Что происходит с растением"
        hint="Когда началось, что видно на листьях, как поливаете."
        error={fieldError}
        required
      >
        {(control) => (
          <Textarea
            {...control}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Листья желтеют снизу, поливаю через день…"
          />
        )}
      </Field>

      <Field id="question-plant" label="Растение из вашего сада" hint="Необязательно, но с ним ответ точнее">
        {(control) => (
          <Select
            {...control}
            value={plantId}
            onChange={(event) => setPlantId(event.target.value)}
          >
            <option value="">Не привязывать к растению</option>
            {plants.map((plant) => (
              <option key={plant.plantId} value={plant.plantId}>
                {plant.nameRu}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field id="question-photo" label="Фото">
        {(control) => (
          <FileField
            {...control}
            fileName={photoName}
            previewUrl={photo}
            onPick={async (file) => {
              if (!file) {
                setPhoto(null);
                setPhotoName("");
                return;
              }
              setPhotoName(file.name);
              try {
                setPhoto(await readAsDataUrl(file));
              } catch {
                setPhoto(null);
                setError("Снимок не прочитался. Вопрос можно отправить и без него.");
              }
            }}
            onClear={() => {
              setPhoto(null);
              setPhotoName("");
            }}
          />
        )}
      </Field>

      <p className={styles.stub}>
        Фото сохраняется как есть: ни сжатия, ни распознавания болезней в демо нет.
      </p>

      {error ? <ErrorState message={error} /> : null}

      <Button size="large" loading={sending} onClick={submit}>
        Отправить агроному
      </Button>
    </div>
  );
}
