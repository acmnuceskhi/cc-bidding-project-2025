"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Phase = "before" | "active" | "after";

export default function LandingPage() {
  const [phase, setPhase] = useState<Phase>("before");
  const [timeLeft, setTimeLeft] = useState(0);

  // //fetching phase and countdown from backend
  // useEffect(() => {
  //   async function fetchPhase() {
  //     try {
  //       const res = await fetch("/api/"); //unsure about this rn
  //       const data = await res.json();
  //       setPhase(data.phase); //before/active/after
  //       setTimeLeft(data.timeLeft);
  //     } catch (err) {
  //       console.error("Failed to fetch landing status", err);
  //     }
  //   }
  //   fetchPhase();
  //   const interval = setInterval(fetchPhase, 1000); // refreshing every second
  //   return () => clearInterval(interval);
  // }, []);

  useEffect(() => {
    const updatePhase = () => {
      const now = Date.now(); // Use client device time
      const beforeEnd = new Date("2025-11-18T10:00:00").getTime();
      const activeEnd = new Date("2025-11-18T12:00:00").getTime();

      if (now < beforeEnd) {
        setPhase("before");
        setTimeLeft(Math.floor((beforeEnd - now) / 1000));
      } else if (now >= beforeEnd && now < activeEnd) {
        setPhase("active");
        setTimeLeft(Math.floor((activeEnd - now) / 1000));
      } else {
        setPhase("after");
        setTimeLeft(0);
      }
    };

    updatePhase(); //initial run
    const interval = setInterval(updatePhase, 1000); //updates every second
    return () => clearInterval(interval);
  }, []); // No dependencies needed - runs once on mount

  // Convert total seconds into days, hours, minutes, seconds (all padded to 2 digits)
  const getDHMS = (totalSeconds: number) => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");

    return {
      days: days.toString().padStart(2, "0"),
      hours: pad(hours),
      minutes: pad(minutes),
      seconds: pad(seconds),
    };
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex flex-col items-center justify-center text-center relative overflow-hidden"
      style={{ backgroundImage: "url('/arena-background.jpg')" }}
    >
      {/* Kungfu Video Layer - UNDER the dark overlay */}
      <video
        className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-0"
        id="kungfu-video"
        muted
        playsInline
        preload="auto"
      >
        <source src="/kungfu-fight.mp4" type="video/mp4" />
      </video>

      {/* Dark Overlay - stays persistent ABOVE video, BELOW content */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[1.5px]"></div>

      {/* Content - highest layer */}
      <div className="relative z-10 px-6">
        {/* Title */}
        <h1 className="text-6xl md:text-8xl font-extrabold mb-4 text-[#FFD700] drop-shadow-[0_0_20px_#B22222] tracking-wide">
          🏆 CODERS CUP 2025
        </h1>
        <p className="text-2xl md:text-3xl text-[#FFB800] mb-12 drop-shadow-[0_0_10px_#FF0000] font-semibold">
          Kung Fu Panda Bidding Arena
        </p>

        {/* Phase-dependent stuff */}
        {phase === "before" && (
          <div>
            <h2 className="text-4xl text-white mb-6 drop-shadow-[0_0_15px_#FFD700]">
              Bidding begins in
            </h2>

            {/* Days:Hours:Minutes:Seconds display with labels */}
            <div className="flex items-center justify-center gap-6 mb-6">
              {(() => {
                const t = getDHMS(timeLeft);
                const parts = [
                  { label: "DAYS", value: t.days },
                  { label: "HOURS", value: t.hours },
                  { label: "MINUTES", value: t.minutes },
                  { label: "SECONDS", value: t.seconds },
                ];

                return parts.map((p) => (
                  <div key={p.label} className="flex flex-col items-center">
                    <div className="text-xs text-gray-300 uppercase mb-2 tracking-widest">
                      {p.label}
                    </div>
                    <div className="text-7xl font-bold text-[#FFD700] mb-0 drop-shadow-[0_0_20px_#FF0000]">
                      {p.value}
                    </div>
                  </div>
                ));
              })()}
            </div>

            <p className="text-lg text-gray-300 italic">
              Get ready, warriors are assembling...
            </p>
          </div>
        )}

        {phase === "active" && (
          <div>
            <h2 className="text-5xl text-[#00FF88] mb-8 font-bold drop-shadow-[0_0_15px_#FFD700]">
              The Bidding Has Begun!
            </h2>
            <Link
              href="/projector"
              className="inline-block px-8 py-4 bg-linear-to-r from-[#FFD700] to-[#FF4500] text-black font-bold text-xl rounded-full hover:scale-105 transition-transform shadow-[0_0_25px_rgba(255,215,0,0.6)]"
            >
              ⚔️ Watch Live Bidding
            </Link>
          </div>
        )}

        {phase === "after" && (
          <div>
            <h2 className="text-5xl text-[#FF4444] mb-8 font-bold drop-shadow-[0_0_15px_#FFD700]">
              The Bidding Has Ended!
            </h2>
            <Link
              href="/results"
              className="inline-block px-8 py-4 bg-linear-to-r from-[#FFD700] to-[#B22222] text-black font-bold text-xl rounded-full hover:scale-105 transition-transform shadow-[0_0_25px_rgba(255,215,0,0.6)]"
            >
              🏁 View Final Results
            </Link>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-gray-400 text-sm z-10">
        Powered by{" "}
        <span className="text-[#FFD700] font-semibold">CC Tech Team</span>
      </div>

      {/* Video control script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const video = document.getElementById('kungfu-video');
              if (!video) return;
              
              function playVideo() {
                video.classList.add('animate-video-cycle');
                video.currentTime = 0;
                video.play().catch(() => {});
                
                setTimeout(() => {
                  video.classList.remove('animate-video-cycle');
                }, 4000);
              }
              
              // Start first play after 1 second
              setTimeout(playVideo, 1000);
              
              // Then play every 14 seconds (4s video + 10s wait)
              setInterval(playVideo, 14000);
            })();
          `,
        }}
      />
    </div>
  );
}
