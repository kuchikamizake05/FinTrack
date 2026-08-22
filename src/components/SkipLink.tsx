"use client";

export default function SkipLink() {
  return (
    <a
      className="skip-link"
      ref={(node) => {
        if (node) node.dataset.ready = "true";
      }}
      href="#main-content"
      onClick={() => {
        document.getElementById("main-content")?.focus();
      }}
    >
      Lewati ke konten utama
    </a>
  );
}
