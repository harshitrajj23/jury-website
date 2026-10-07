"use client";

import React, { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, X, Image as ImageIcon, Link as LinkIcon, CheckCircle2, AlertCircle } from "lucide-react";
import CyberButton from "./CyberButton";

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  aspect?: "logo" | "banner";
  helperText?: string;
  themeColor?: "cyan" | "magenta" | "green";
  disabled?: boolean;
}

/**
 * Resizes and optimizes an image file client-side into a compact data URL.
 * SVGs are preserved as crisp vector data URLs.
 * Bitmaps (PNG/JPG/WebP) are resized to suitable dimensions:
 * - Logo: max 500x500px
 * - Banner: max 1400x700px
 */
async function processImageFile(file: File, aspect: "logo" | "banner"): Promise<string> {
  return new Promise((resolve, reject) => {
    // If SVG, read directly as data URL to keep vector fidelity
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read SVG file."));
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxDim = aspect === "banner" ? 1400 : 500;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback to direct file reader
        const fallbackReader = new FileReader();
        fallbackReader.onload = () => resolve(fallbackReader.result as string);
        fallbackReader.onerror = () => reject(new Error("Failed to process image."));
        fallbackReader.readAsDataURL(file);
        return;
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP with fallback to JPEG for compact database storage
      try {
        const quality = aspect === "banner" ? 0.82 : 0.85;
        const webpData = canvas.toDataURL("image/webp", quality);
        if (webpData.startsWith("data:image/webp")) {
          resolve(webpData);
          return;
        }
      } catch (_) {
        // Ignore and fallback
      }

      // Fallback to JPEG
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Invalid image format or corrupted file."));
    };

    img.src = objectUrl;
  });
}

export default function ImageUpload({
  label,
  value,
  onChange,
  aspect = "logo",
  helperText,
  themeColor = "cyan",
  disabled = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const colors = {
    cyan: {
      border: "border-cyber-cyan/40 hover:border-cyber-cyan",
      activeBorder: "border-cyber-cyan",
      bg: "bg-cyber-cyan/5",
      activeBg: "bg-cyber-cyan/15",
      accentText: "text-cyber-cyan",
      badge: "bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
    },
    magenta: {
      border: "border-cyber-magenta/40 hover:border-cyber-magenta",
      activeBorder: "border-cyber-magenta",
      bg: "bg-cyber-magenta/5",
      activeBg: "bg-cyber-magenta/15",
      accentText: "text-cyber-magenta",
      badge: "bg-cyber-magenta/20 border-cyber-magenta text-cyber-magenta",
      glow: "shadow-[0_0_20px_rgba(217,70,239,0.15)]",
    },
    green: {
      border: "border-cyber-green/40 hover:border-cyber-green",
      activeBorder: "border-cyber-green",
      bg: "bg-cyber-green/5",
      activeBg: "bg-cyber-green/15",
      accentText: "text-cyber-green",
      badge: "bg-cyber-green/20 border-cyber-green text-cyber-green",
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    },
  }[themeColor];

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPG, SVG, WebP, GIF).");
      return;
    }

    // Guard max 10MB input file
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Image file exceeds 10MB. Please choose a smaller image.");
      return;
    }

    setErrorMessage("");
    setIsProcessing(true);
    try {
      const dataUrl = await processImageFile(file, aspect);
      onChange(dataUrl);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to process image file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClear = () => {
    onChange("");
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isBase64 = value?.startsWith("data:image");

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-mono tracking-wider text-gray-300 uppercase font-bold flex items-center gap-1.5">
          <ImageIcon className={`w-3.5 h-3.5 ${colors.accentText}`} />
          {label}
        </label>
        {value && (
          <span className={`text-[9px] font-mono px-1.5 py-0.2 border uppercase font-bold ${colors.badge}`}>
            {isBase64 ? "✓ UPLOADED" : "✓ LINKED"}
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || isProcessing}
      />

      {value ? (
        /* Image Preview Box */
        <div className={`relative border ${colors.border} bg-black/60 p-2.5 flex flex-col gap-2 ${colors.glow}`}>
          <div
            className={`w-full overflow-hidden flex items-center justify-center bg-cyber-bg-darker border border-gray-800 ${
              aspect === "banner" ? "h-32 sm:h-40 rounded" : "h-24 sm:h-28"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              className={`max-w-full max-h-full object-contain ${aspect === "banner" ? "w-full object-cover" : ""}`}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[10px] font-mono text-gray-400 truncate max-w-[200px]">
              {isBase64 ? "Custom Upload (Optimized)" : value}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isProcessing}
                className={`text-[10px] font-mono px-2 py-1 bg-black/50 border border-gray-700 hover:border-white text-gray-300 hover:text-white uppercase transition-colors`}
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled || isProcessing}
                className="text-[10px] font-mono px-2 py-1 bg-cyber-red/20 border border-cyber-red/50 hover:bg-cyber-red text-cyber-red hover:text-white uppercase transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Dropzone / Upload Box */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
          className={`border-2 border-dashed p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center select-none ${
            isDragging
              ? `${colors.activeBorder} ${colors.activeBg} scale-[1.01]`
              : `${colors.border} ${colors.bg} hover:border-white/60 hover:bg-black/40`
          } ${aspect === "banner" ? "h-28 sm:h-32" : "h-24"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className={`p-2 rounded-full bg-black/50 border ${colors.border}`}>
            <Upload className={`w-4 h-4 ${colors.accentText} ${isProcessing ? "animate-bounce" : ""}`} />
          </div>

          <div className="flex flex-col gap-0.5">
            <p className="font-mono text-xs text-white font-bold uppercase tracking-wider">
              {isProcessing
                ? "OPTIMIZING IMAGE..."
                : isDragging
                ? "DROP IMAGE HERE"
                : `CLICK OR DRAG TO UPLOAD ${aspect === "banner" ? "BANNER" : "LOGO"}`}
            </p>
            <p className="font-mono text-[10px] text-gray-400">
              {aspect === "banner" ? "Recommended 1200×400 (PNG, JPG, WebP)" : "PNG, SVG, JPG, WebP (Max 10MB)"}
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-cyber-red font-mono text-[11px] mt-0.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* URL Input toggle alternative */}
      <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 pt-0.5">
        <span>{helperText || (aspect === "banner" ? "Displayed as event hero backdrop." : "Displayed across badges & headers.")}</span>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-gray-400 hover:text-white uppercase flex items-center gap-1 transition-colors underline"
        >
          <LinkIcon className="w-2.5 h-2.5" /> {showUrlInput ? "Hide URL Field" : "Enter Image URL"}
        </button>
      </div>

      {showUrlInput && (
        <div className="mt-1 flex items-center gap-2 bg-cyber-bg-darker border border-gray-800 p-1.5">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://... or /logos/example.svg"
            disabled={disabled}
            className="w-full bg-transparent font-mono text-xs text-white outline-none px-1"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-500 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
