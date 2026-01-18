import { GoogleGenAI, Type } from "@google/genai";
import { Video } from "../types";

// Helper to extract video ID from URL
export const extractVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Create AI instance with provided API key
const createAI = (apiKey: string) => new GoogleGenAI({ apiKey });

export const getAiChatResponse = async (
  history: { role: string; text: string }[],
  currentVideoTitle: string,
  apiKey: string
): Promise<string> => {
  if (!apiKey) {
    return "API 키가 설정되지 않았어. 방을 만들 때 API 키를 입력해줘! 🔑";
  }

  try {
    const ai = createAI(apiKey);
    const model = "gemini-2.0-flash";

    const context = `
      당신은 'TubeParty'라는 유튜브 같이 보기 서비스의 AI 봇입니다.
      현재 사용자들이 보고 있는 영상 제목은 "${currentVideoTitle}"입니다.
      짧고 재치있게 대답하세요. 한국어로 대답하세요.
      친구처럼 친근하게 반말로 대답하세요. 이모지를 적절히 사용하세요.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: [
        { role: 'user', parts: [{ text: context }] },
        ...history.map(h => ({
          role: h.role === 'ai' ? 'model' : 'user',
          parts: [{ text: h.text }]
        }))
      ],
    });

    return response.text || "미안, 지금은 대답하기 좀 곤란해 😅";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "지금 AI 서버가 좀 바쁜가봐 ㅠㅠ 잠시 후에 다시 말해줄래?";
  }
};

export const getVideoRecommendations = async (
  currentVideoTitle: string,
  userPrompt: string,
  apiKey: string
): Promise<Video[]> => {
  if (!apiKey) {
    console.error("No API key provided");
    return [];
  }

  try {
    const ai = createAI(apiKey);
    const model = "gemini-2.0-flash";

    const prompt = `
      현재 사용자가 보고 있는 영상: "${currentVideoTitle}"
      사용자의 요청: "${userPrompt}"
      
      이와 관련되거나 사용자가 요청한 분위기에 맞는 유튜브 영상 3~4개를 추천해줘.
      실제 존재하는 영상 제목과 채널명을 그럴듯하게 지어내거나(실제 유튜브 데이터를 조회할 수 없으므로),
      유명한 영상들을 추천해줘.
      
      반드시 JSON 형식으로 반환해야 해.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "YouTube Video ID (11 chars)" },
              title: { type: Type.STRING },
              channelTitle: { type: Type.STRING },
            },
            required: ["id", "title", "channelTitle"]
          }
        }
      }
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) return [];

    const rawVideos = JSON.parse(jsonStr);

    return rawVideos.map((v: any) => ({
      id: v.id || "dQw4w9WgXcQ",
      title: v.title,
      channelTitle: v.channelTitle,
      thumbnail: `https://picsum.photos/seed/${v.id}/320/180`
    }));

  } catch (error) {
    console.error("Gemini Recommendation Error:", error);
    return [];
  }
};

// Genre-based real-time recommendations
export const getGenreRecommendations = async (
  genre: string,
  apiKey: string
): Promise<Video[]> => {
  if (!apiKey) {
    console.error("No API key provided");
    return [];
  }

  const genrePrompts: Record<string, string> = {
    lofi: "Lofi hip hop, 공부할 때 듣는 음악, chill beats, relaxing music",
    kpop: "최신 K-POP 히트곡, 인기 아이돌 뮤직비디오, BTS, BLACKPINK, NewJeans, aespa",
    ballad: "한국 발라드, 감성적인 노래, 아이유, 성시경, 폴킴, 멜로망스",
    pop: "글로벌 팝송 히트곡, Billboard Hot 100, The Weeknd, Ed Sheeran, Taylor Swift",
    random: "인기 유튜브 음악 영상, 다양한 장르 혼합, 트렌딩 뮤직비디오"
  };

  try {
    const ai = createAI(apiKey);
    const model = "gemini-2.0-flash";

    const prompt = `
      사용자가 "${genre}" 장르의 음악을 원합니다.
      키워드: ${genrePrompts[genre] || genre}
      
      실제 유튜브에 있는 유명한 영상 3~4개를 추천해줘.
      반드시 실제 존재하는 유튜브 영상 ID(11자리)를 사용해야 해.
      한국 음악인 경우 한글 제목을 사용하고, 팝송인 경우 영어 제목을 사용해.
      
      반드시 JSON 형식으로 반환해.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "Real YouTube Video ID (11 chars)" },
              title: { type: Type.STRING },
              channelTitle: { type: Type.STRING },
            },
            required: ["id", "title", "channelTitle"]
          }
        }
      }
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) return [];

    const rawVideos = JSON.parse(jsonStr);

    return rawVideos.map((v: any) => ({
      id: v.id || "dQw4w9WgXcQ",
      title: v.title,
      channelTitle: v.channelTitle,
      thumbnail: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`
    }));

  } catch (error) {
    console.error("Gemini Genre Recommendation Error:", error);
    return [];
  }
};