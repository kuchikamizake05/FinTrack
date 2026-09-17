"use client";
import { useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowLeft, ArrowRight, WalletCards } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import styles from "@/app/landing.module.css";

export default function HeroDeck() {
  const { language } = useLanguage();
  const id = language === "id";
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const tilt = useTransform(scrollYProgress, [0, 1], [12, -8]);
  const y = useTransform(scrollYProgress, [0, 1], [25, -25]);
  const cards = [
    { title: id ? "Saldo bersih" : "Net balance", value: "Rp24.860.000", caption: id ? "Semua rekening. Satu pandangan." : "All your accounts. One clear picture.", bars: [25,40,32,56,49,76,88] },
    { title: id ? "Investasi" : "Investments", value: "Rp18.750.000", caption: id ? "Pantau perjalanan asetmu." : "Follow your assets over time.", bars: [20,35,42,38,62,75,95] },
    { title: id ? "Dana darurat" : "Emergency fund", value: "78%", caption: id ? "Rp15.600.000 dari Rp20.000.000" : "Rp15,600,000 of Rp20,000,000", bars: [18,28,38,48,58,68,78] },
  ];
  const move = (step: number) => setActive(current => (current + step + 3) % 3);
  return <div ref={ref} className={styles.heroDeck} role="region" aria-label={id ? "Preview interaktif FinTrack" : "Interactive FinTrack preview"}>
    <motion.div className={styles.deckStage} style={reduced ? undefined : { rotateX: tilt, y }}>
      {cards.map((card,index) => {
        const position = (index - active + 3) % 3;
        return <motion.div key={index} className={styles.deckCard} data-tone={index} aria-hidden={position !== 0} style={{zIndex:3-position,touchAction:"pan-y"}}
          animate={{x:position*16,y:position*-16,rotate:position*6,scale:1-position*.055,opacity:position===0 ? 1 : .72}}
          transition={reduced ? {duration:0} : {type:"spring",stiffness:220,damping:25}}
          drag={position === 0 ? "x" : false} dragConstraints={{left:0,right:0}} dragElastic={.65}
          onDragEnd={(_,info) => {if(info.offset.x < -45) move(1); else if(info.offset.x > 45) move(-1);}}>
          <div className={styles.deckTop}><span>FinTrack</span><WalletCards size={23} aria-hidden="true" /></div>
          <p>{card.title}</p><strong>{card.value}</strong>
          <div className={styles.deckChart} aria-hidden="true">{card.bars.map((height,i) => <i key={i} style={{height:`${height}%`}} />)}</div>
          <small>{card.caption}</small>
        </motion.div>;
      })}
    </motion.div>
    <div className={styles.deckControls}>
      <button type="button" onClick={() => move(-1)} aria-label={id ? "Kartu sebelumnya" : "Previous card"}><ArrowLeft size={18} /></button>
      <span aria-live="polite">{cards[active].title}<small>{id ? "Geser untuk jelajahi · Data ilustrasi" : "Swipe to explore · Illustrative data"}</small></span>
      <button type="button" onClick={() => move(1)} aria-label={id ? "Kartu berikutnya" : "Next card"}><ArrowRight size={18} /></button>
    </div>
  </div>;
}
