"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type Offset = { x: number; y: number };

let sharedOffset: Offset = { x: 0, y: 0 };
let sharedDragged = false;

function clamp(value: number, min: number, max: number) {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.min(upper, Math.max(lower, value));
}

function placeDrag(x: number, y: number, panel: HTMLElement | null, applied: Offset) {
  if (!panel) return { x, y };
  const rect = panel.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewLeft = viewport?.offsetLeft ?? 0;
  const viewTop = viewport?.offsetTop ?? 0;
  const viewRight = viewLeft + (viewport?.width ?? window.innerWidth);
  const viewBottom = viewTop + (viewport?.height ?? window.innerHeight);
  const margin = 48;
  const baseLeft = rect.left - applied.x;
  const baseTop = rect.top - applied.y;
  const left = clamp(baseLeft + x, viewLeft + margin - rect.width, viewRight - margin);
  const top = clamp(baseTop + y, viewTop + margin - rect.height, viewBottom - margin);
  return { x: left - baseLeft, y: top - baseTop };
}

export const draggablePanelClassName =
  "flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col gap-3 overflow-hidden sm:max-w-lg";
export const dragHeaderClassName = "shrink-0 cursor-grab touch-none pr-8 select-none active:cursor-grabbing";
export const dragFooterClassName = "shrink-0 cursor-grab touch-none active:cursor-grabbing";

export function useDraggablePanel(open: boolean) {
  const [offset, setOffset] = useState<Offset>(sharedOffset);
  const panelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(sharedOffset);
  const dragRef = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const draggedRef = useRef(sharedDragged);

  useEffect(() => {
    if (!open) return;
    offsetRef.current = sharedOffset;
    draggedRef.current = sharedDragged;
    setOffset(sharedOffset);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let observer: ResizeObserver | null = null;
    const frame = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const fit = () => {
        if (draggedRef.current || sharedDragged) return;
        const current = panelRef.current;
        if (!current) return;
        const rect = current.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewTop = viewport?.offsetTop ?? 0;
        const viewBottom = viewTop + (viewport?.height ?? window.innerHeight);
        const margin = 8;
        let y = 0;
        if (rect.height >= viewBottom - viewTop - margin * 2) y = viewTop + margin - rect.top;
        else if (rect.top < viewTop + margin) y = viewTop + margin - rect.top;
        else if (rect.bottom > viewBottom - margin) y = viewBottom - margin - rect.bottom;
        if (Math.abs(y) < 1) return;
        const next = { x: offsetRef.current.x, y: offsetRef.current.y + y };
        offsetRef.current = next;
        sharedOffset = next;
        setOffset(next);
      };
      observer = new ResizeObserver(fit);
      observer.observe(panel);
      fit();
    }, 150);
    return () => {
      window.clearTimeout(frame);
      observer?.disconnect();
    };
  }, [open]);

  function remember(next: Offset) {
    offsetRef.current = next;
    sharedOffset = next;
    setOffset(next);
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, label")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const next = placeDrag(
      drag.ox + event.clientX - drag.x,
      drag.oy + event.clientY - drag.y,
      panelRef.current,
      offsetRef.current,
    );
    draggedRef.current = true;
    sharedDragged = true;
    remember(next);
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const dragHandle = {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  return {
    panelRef,
    style: { transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` },
    dragHandle,
  };
}
