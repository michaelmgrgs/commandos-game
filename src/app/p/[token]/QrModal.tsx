"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Full-screen display of the player's own QR code — this is what they
// show the winner's camera during combat (architecture doc §5).
export default function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 320, margin: 1 }).then((d) => {
      if (!cancelled) setDataUrl(d);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="cc-qr-modal" onClick={onClose}>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="Your QR code" width={320} height={320} />
      ) : (
        <p>Generating your code…</p>
      )}
      <p style={{ color: "white" }}>Hold this up for the winner to scan. Tap anywhere to close.</p>
    </div>
  );
}
