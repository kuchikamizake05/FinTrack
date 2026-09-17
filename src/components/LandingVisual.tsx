"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import styles from "@/app/landing.module.css";

export default function LandingVisual() {
  const target = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { language } = useLanguage();
  const id = language === "id";
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], [-28, 28]);
  const cardY = useTransform(scrollYProgress, [0, 1], [45, -45]);
  const rotate = useTransform(scrollYProgress, [0, 1], [-5, 3]);
  return <div ref={target} className={styles.visualStage}>
    <motion.div className={styles.visualImage} style={reduced ? undefined : { y: imageY }}>
      <Image src="/landing/growth-editorial.webp" alt={id ? "Tanaman tumbuh di antara tangga kaca hijau, ilustrasi pertumbuhan rencana keuangan." : "A sapling growing among green glass steps, illustrating financial progress."} fill sizes="(max-width: 760px) 100vw, 1100px" />
    </motion.div>
    <motion.div className={styles.visualOverlay} style={reduced ? undefined : { y: cardY, rotate }}>
      <span className={styles.visualEyebrow}>{id ? "RUANG UNTUK RENCANAMU" : "ROOM FOR YOUR PLANS"}</span>
      <strong>{id ? "Sedikit demi sedikit.\nSemakin dekat." : "Little by little.\nCloser every day."}</strong>
      <div className={styles.visualStats}><span><ArrowUpRight size={18} />{id ? "Tabungan bertumbuh" : "Savings grow"}</span><span><ArrowDownRight size={18} />{id ? "Pengeluaran terarah" : "Spending with purpose"}</span></div>
    </motion.div>
    <span className={styles.visualCaption}>{id ? "Rencana besar dimulai dari kebiasaan kecil." : "Big plans start with small habits."}</span>
  </div>;
}
