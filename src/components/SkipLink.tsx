"use client";

import { useEffect, useState } from "react";

export default function SkipLink() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <a
      className="skip-link"
      data-ready={ready || undefined}
      href="#main-content"
      onClick={() => {
        document.getElementById("main-content")?.focus();
      }}
    >
      Lewati ke konten utama
    </a>
  );
}
