"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

// Opens the phone camera and continuously scans for a QR code. Calls
// onScan(rawText) the moment it finds one and stops the camera. Visibility
// is driven by a URL query param (see PlayerProfileClient) rather than
// local state, so the phone's back button closes it via normal Next.js
// routing instead of leaving the page entirely.
export default function ScanModal({
  onScan,
  onClose,
}: {
  onScan: (raw: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState("");
  const scannedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch (err) {
        setError("Couldn't access the camera. Check your browser's camera permission.");
      }
    }

    function tick() {
      if (cancelled || scannedRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            scannedRef.current = true;
            stopCamera();
            onScan(code.data);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function stopCamera() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="cc-scan-overlay">
      <video ref={videoRef} className="cc-scan-video" playsInline muted />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {error && <p className="cc-error">{error}</p>}
      <p style={{ color: "white", marginTop: 12 }}>Point your camera at the target's QR code.</p>
      <button className="cc-btn" style={{ marginTop: 12 }} onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}
