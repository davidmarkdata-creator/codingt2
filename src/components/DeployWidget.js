"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const CHAVE_POSICAO = "deploy-widget-posicao";
const TAMANHO = 96;
const MARGEM = 24;
const LIMIAR_ARRASTO = 5;
const INTERVALO_ESTADO = 15000;
const MENSAGEM_INICIAL = "WIP: sessão em curso";

function limitar(pos) {
  return {
    x: Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - TAMANHO)),
    y: Math.min(Math.max(0, pos.y), Math.max(0, window.innerHeight - TAMANHO)),
  };
}

function lerPosicaoGuardada() {
  try {
    const bruto = window.localStorage.getItem(CHAVE_POSICAO);
    if (bruto) {
      const { x, y } = JSON.parse(bruto);
      if (Number.isFinite(x) && Number.isFinite(y)) return limitar({ x, y });
    }
  } catch {
    // localStorage indisponível: usa a posição por omissão
  }
  return null;
}

const semSubscricao = () => () => {};

// Só renderiza no cliente, depois da hidratação (usa window e localStorage).
export default function DeployWidget() {
  const montado = useSyncExternalStore(
    semSubscricao,
    () => true,
    () => false
  );
  return montado ? <Widget /> : null;
}

async function lerEstado() {
  try {
    const resposta = await fetch("/api/deploy", { cache: "no-store" });
    const dados = await resposta.json();
    return resposta.ok && typeof dados.pendente === "boolean"
      ? dados.pendente
      : true;
  } catch {
    return true;
  }
}

function Widget() {
  const [pos, setPos] = useState(
    () =>
      lerPosicaoGuardada() ??
      limitar({
        x: window.innerWidth - TAMANHO - MARGEM,
        y: window.innerHeight - TAMANHO - MARGEM,
      })
  );
  const [pendente, setPendente] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState(MENSAGEM_INICIAL);
  const [estado, setEstado] = useState({ tipo: "parado", texto: "" });
  const arrasto = useRef(null);

  useEffect(() => {
    const onResize = () => setPos((p) => limitar(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const atualizar = () => lerEstado().then(setPendente);
    atualizar();
    const id = setInterval(atualizar, INTERVALO_ESTADO);
    return () => clearInterval(id);
  }, []);
  function aoPremir(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = {
      inicioX: e.clientX,
      inicioY: e.clientY,
      origem: pos,
      moveu: false,
    };
  }

  function aoMover(e) {
    const a = arrasto.current;
    if (!a) return;
    const dx = e.clientX - a.inicioX;
    const dy = e.clientY - a.inicioY;
    if (!a.moveu && Math.hypot(dx, dy) < LIMIAR_ARRASTO) return;
    a.moveu = true;
    setPos(limitar({ x: a.origem.x + dx, y: a.origem.y + dy }));
  }

  function aoSoltar(e) {
    const a = arrasto.current;
    arrasto.current = null;
    if (!a) return;
    if (a.moveu) {
      const final = limitar({
        x: a.origem.x + e.clientX - a.inicioX,
        y: a.origem.y + e.clientY - a.inicioY,
      });
      try {
        window.localStorage.setItem(CHAVE_POSICAO, JSON.stringify(final));
      } catch {
        // sem persistência: a posição vale só até recarregar
      }
    } else {
      setAberto((v) => !v);
    }
  }

  async function enviar() {
    setEstado({ tipo: "a-correr", texto: "A correr…" });
    try {
      const resposta = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (resposta.ok) {
        setEstado({ tipo: "sucesso", texto: "Sucesso" });
      } else {
        setEstado({ tipo: "erro", texto: dados.error || "Erro desconhecido" });
      }
    } catch {
      setEstado({ tipo: "erro", texto: "Falha na ligação ao servidor" });
    }
    lerEstado().then(setPendente);
  }

  const painelEmCima = pos.y > 260;
  const painelAEsquerda = pos.x > window.innerWidth / 2;
  const corEstado = {
    parado: "text-gray-500",
    "a-correr": "text-amber-600",
    sucesso: "text-green-600",
    erro: "text-red-600",
  }[estado.tipo];

  return (
    <div
      className="fixed z-50"
      style={{ left: pos.x, top: pos.y, width: TAMANHO, height: TAMANHO }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Deploy ONLINE"
        onPointerDown={aoPremir}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={() => {
          arrasto.current = null;
        }}
        className={`relative flex h-full w-full cursor-grab touch-none select-none items-center justify-center rounded-full text-center text-sm font-semibold leading-tight text-white shadow-lg active:cursor-grabbing ${
          pendente === false ? "bg-green-600" : "bg-gray-500"
        }`}
      >
        {pendente !== false && (
          <span className="absolute right-2 top-2 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
          </span>
        )}
        <span className="px-2">Deploy ONLINE</span>
      </div>

      {aberto && (
        <div
          className={`absolute w-72 rounded-lg bg-white p-3 text-sm text-gray-900 shadow-lg ring-1 ring-black/10 ${
            painelEmCima ? "bottom-full mb-2" : "top-full mt-2"
          } ${painelAEsquerda ? "right-0" : "left-0"}`}
        >
          <label className="mb-1 block font-medium" htmlFor="deploy-mensagem">
            Mensagem do commit
          </label>
          <input
            id="deploy-mensagem"
            type="text"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className="mb-2 w-full rounded border border-gray-300 px-2 py-1"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={estado.tipo === "a-correr"}
            className="w-full rounded bg-gray-800 px-3 py-1.5 font-medium text-white disabled:opacity-50"
          >
            Commit + Push
          </button>
          {estado.tipo !== "parado" && (
            <p className={`mt-2 break-words ${corEstado}`}>{estado.texto}</p>
          )}
        </div>
      )}
    </div>
  );
}
