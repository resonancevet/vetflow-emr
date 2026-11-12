"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type IntakeSignatureValue = {
  method: "typed" | "drawn";
  typedName?: string;
  signatureData?: string;
};

type Props = {
  label: string;
  value: IntakeSignatureValue | null;
  onChange: (value: IntakeSignatureValue | null) => void;
  requireAgreementCheckbox?: boolean;
  agreed?: boolean;
  onAgreedChange?: (agreed: boolean) => void;
  agreementLabel?: string;
};

export function IntakeSignaturePad({
  label,
  value,
  onChange,
  requireAgreementCheckbox,
  agreed,
  onAgreedChange,
  agreementLabel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [method, setMethod] = useState<"typed" | "drawn">(
    value?.method ?? "typed"
  );
  const [typedName, setTypedName] = useState(value?.typedName ?? "");

  useEffect(() => {
    if (method !== "drawn") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (value?.method === "drawn" && value.signatureData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value.signatureData;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init canvas once when switching to drawn
  }, [method]);

  const emitTyped = (name: string) => {
    setTypedName(name);
    if (!name.trim()) {
      onChange(null);
      return;
    }
    onChange({ method: "typed", typedName: name.trim() });
  };

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const finishStroke = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      onChange(null);
      return;
    }
    onChange({ method: "drawn", signatureData: canvas.toDataURL("image/png") });
  };

  const clearDrawn = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    onChange(null);
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {requireAgreementCheckbox ? (
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(agreed)}
            onChange={(e) => onAgreedChange?.(e.target.checked)}
          />
          <span>{agreementLabel ?? "I have read and agree to the above."}</span>
        </label>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={method === "typed" ? "default" : "outline"}
          onClick={() => {
            setMethod("typed");
            onChange(
              typedName.trim()
                ? { method: "typed", typedName: typedName.trim() }
                : null
            );
          }}
        >
          Type name
        </Button>
        <Button
          type="button"
          size="sm"
          variant={method === "drawn" ? "default" : "outline"}
          onClick={() => {
            setMethod("drawn");
            onChange(null);
          }}
        >
          Draw signature
        </Button>
      </div>
      {method === "typed" ? (
        <div>
          <label className="mb-1 block text-xs text-gray-500">
            Full legal name
          </label>
          <Input
            value={typedName}
            onChange={(e) => emitTyped(e.target.value)}
            placeholder="Type your full name"
          />
        </div>
      ) : (
        <div>
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            className="h-40 w-full touch-none rounded-md border border-gray-300 bg-white"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={clearDrawn}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
