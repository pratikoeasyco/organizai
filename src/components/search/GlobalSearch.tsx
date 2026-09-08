"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import { api } from "@/lib/api-client";
import { formatDueLabel } from "@/lib/utils/format";
import { PRIORITY_META, type Priority } from "@/types/domain";

interface SearchHit {
  id: string;
  title: string;
  kind: "TASK" | "EVENT";
  priority: Priority;
  dueDate: string | null;
  hasTime: boolean;
  done: boolean;
  columnName: string | null;
  projectId: string;
  projectName: string;
  projectColor: string;
  companyName: string;
}

/**
 * Busca de tarefas em todos os projetos, aberta de qualquer tela.
 *
 * A busca do quadro filtra o quadro que já está aberto. Esta responde outra
 * pergunta — "onde está aquela tarefa?" —, que é justamente quando não se sabe
 * em qual projeto procurar. Por isso cada resultado diz o projeto e a coluna:
 * achar sem dizer onde estava não resolveria o problema.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<SearchHit[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const listaRef = useRef<HTMLUListElement>(null);

  // Ctrl+K / Cmd+K — o atalho que quem usa ferramenta de trabalho já tenta.
  useEffect(() => {
    function atalho(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAberto(true);
      }
    }
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, []);

  /**
   * Busca enquanto digita.
   *
   * O debounce evita uma consulta por tecla. O `cancelado` resolve outro
   * problema: respostas podem chegar fora de ordem, e sem ele o resultado de
   * um termo já apagado sobrescreveria o resultado atual.
   */
  useEffect(() => {
    if (!aberto) return;

    const busca = termo.trim();
    if (busca.length < 2) {
      setResultados([]);
      setCarregando(false);
      return;
    }

    let cancelado = false;
    setCarregando(true);

    const timer = window.setTimeout(async () => {
      try {
        const data = await api.get<{ results: SearchHit[] }>(
          `/api/search?q=${encodeURIComponent(busca)}`,
        );
        if (cancelado) return;
        setResultados(data.results);
        setAtivo(0);
      } catch {
        if (!cancelado) setResultados([]);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }, 200);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [termo, aberto]);

  const abrir = useCallback(
    (hit: SearchHit) => {
      setAberto(false);
      setTermo("");
      // Compromisso vive no calendário; tarefa, no quadro. Abrir na visão
      // errada mostraria uma tela vazia.
      const vista = hit.kind === "EVENT" ? "&vista=calendario" : "";
      router.push(`/projetos/${hit.projectId}?tarefa=${hit.id}${vista}`);
    },
    [router],
  );

  function navegar(event: React.KeyboardEvent) {
    if (resultados.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setAtivo((i) => (i + 1) % resultados.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setAtivo((i) => (i - 1 + resultados.length) % resultados.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const escolhido = resultados[ativo];
      if (escolhido) abrir(escolhido);
    }
  }

  // Mantém o item destacado visível ao navegar pelo teclado.
  useEffect(() => {
    listaRef.current?.children[ativo]?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  const busca = termo.trim();

  return (
    <>
      <Tooltip content="Buscar tarefas (Ctrl K)">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Buscar tarefas"
          className="rounded-md p-2 text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <Search className="size-4.5" />
        </button>
      </Tooltip>

      <Modal open={aberto} onClose={() => setAberto(false)} size="md" ariaLabel="Buscar tarefas">
        <Input
          value={termo}
          onChange={(event) => setTermo(event.target.value)}
          onKeyDown={navegar}
          placeholder="Buscar tarefa por nome..."
          leftIcon={<Search />}
          rightSlot={
            carregando ? (
              <Loader2 className="size-4 animate-spin text-ink-faint" aria-hidden="true" />
            ) : undefined
          }
          data-autofocus
          aria-label="Buscar tarefa por nome"
        />

        {/* A lista muda sozinha enquanto se digita, sem nenhum aviso sonoro
            equivalente — isto anuncia a contagem para leitores de tela. */}
        <p aria-live="polite" className="sr-only">
          {busca.length >= 2 && !carregando
            ? `${resultados.length} resultado${resultados.length === 1 ? "" : "s"}`
            : ""}
        </p>

        <div className="mt-3 max-h-[46dvh] overflow-y-auto scrollbar-slim">
          {busca.length === 0 && (
            <p className="px-1 py-6 text-center text-[13px] leading-relaxed text-ink-faint">
              Procura em todos os seus projetos, por título e descrição.
            </p>
          )}

          {busca.length === 1 && (
            <p className="px-1 py-6 text-center text-[13px] text-ink-faint">
              Digite pelo menos 2 letras.
            </p>
          )}

          {busca.length >= 2 && !carregando && resultados.length === 0 && (
            <p className="px-1 py-6 text-center text-[13px] text-ink-faint">
              Nada encontrado para &ldquo;{busca}&rdquo;.
            </p>
          )}

          <ul ref={listaRef} className="space-y-1">
            {resultados.map((hit, index) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => abrir(hit)}
                  onMouseEnter={() => setAtivo(index)}
                  aria-current={index === ativo ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    index === ativo ? "bg-surface-sunken" : "hover:bg-surface-sunken",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: PRIORITY_META[hit.priority].dot }}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {hit.done && (
                        <Check className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                      )}
                      {hit.kind === "EVENT" && (
                        <CalendarClock
                          className="size-3.5 shrink-0 text-ink-faint"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={cn(
                          "truncate text-[13.5px] font-medium text-ink",
                          hit.done && "line-through decoration-1",
                        )}
                      >
                        {hit.title}
                      </span>
                    </span>

                    {/* Onde a tarefa está — o motivo desta busca existir. */}
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-ink-faint">
                      <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: hit.projectColor }}
                      />
                      <span className="truncate">{hit.projectName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">
                        {hit.kind === "EVENT" ? "Calendário" : (hit.columnName ?? "Sem coluna")}
                      </span>
                      {hit.dueDate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{formatDueLabel(hit.dueDate)}</span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </>
  );
}
