import { useEffect, useRef } from "react";
import { BookOpen, ExternalLink, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { TheoryArticle } from "./types";

export function TheoryPanel({
  article,
  onClose,
  fullHref,
  onOpenFull,
}: {
  article: TheoryArticle;
  onClose: () => void;
  fullHref: string;
  onOpenFull?: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div
      className="theory-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="theory-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theory-title"
      >
        <header>
          <span>
            <BookOpen /> Теория
          </span>
          <button
            ref={closeRef}
            className="icon-btn"
            onClick={onClose}
            aria-label="Закрыть теорию"
          >
            <X />
          </button>
        </header>
        <div className="theory-scroll">
          <h2 id="theory-title">{article.title}</h2>
          <p>{article.introduction}</p>
          {article.methods.map((method, index) => (
            <section className="theory-method" key={`${method.name}-${index}`}>
              <h3>{method.name}</h3>
              <p>{method.description}</p>
              <h4>Синтаксис</h4>
              <pre>
                <code>{method.syntax}</code>
              </pre>
              {method.keyParameters.length > 0 && (
                <>
                  <h4>Ключевые параметры</h4>
                  <dl>
                    {method.keyParameters.map((parameter) => (
                      <div key={parameter.name}>
                        <dt>
                          <code>{parameter.name}</code>
                        </dt>
                        <dd>{parameter.description}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
              <p>{method.parameterGuide}</p>
              <h4>Пример на других данных</h4>
              <pre>
                <code>{method.example}</code>
              </pre>
              <h4>Важно</h4>
              <ul>
                {method.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <a
                href={method.documentationUrl}
                target="_blank"
                rel="noreferrer"
              >
                {method.documentationLabel}
                <ExternalLink />
              </a>
            </section>
          ))}
          <Link
            className="theory-full-link"
            to={fullHref}
            onClick={onOpenFull ?? onClose}
          >
            Открыть полностью в Базе знаний
          </Link>
        </div>
      </aside>
    </div>
  );
}
