import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FindParty — поиск тиммейтов для онлайн-игр";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Фоновые декоративные круги */}
        <div
          style={{
            position: "absolute",
            top: -100,
            left: -100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            right: -100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Логотип/бейдж */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: "10px 24px",
          }}
        >
          <span style={{ color: "#a1a1aa", fontSize: 20, letterSpacing: 2 }}>
            findparty.online
          </span>
        </div>

        {/* Заголовок */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            background: "linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6)",
            backgroundClip: "text",
            color: "transparent",
            textAlign: "center",
            lineHeight: 1.1,
            marginBottom: 24,
            padding: "0 80px",
          }}
        >
          Найди тиммейтов
        </div>

        {/* Подзаголовок */}
        <div
          style={{
            fontSize: 28,
            color: "#a1a1aa",
            textAlign: "center",
            padding: "0 120px",
          }}
        >
          Пати для Dota 2, CS2, Rust, Valorant, Minecraft и других игр
        </div>

        {/* Нижний блок */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            display: "flex",
            gap: 24,
          }}
        >
          {["Без регистрации", "Живой чат", "Бесплатно"].map((label) => (
            <div
              key={label}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 100,
                padding: "8px 20px",
                color: "#e4e4e7",
                fontSize: 18,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
