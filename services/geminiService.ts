import { GoogleGenAI, Content, Modality } from "@google/genai";
import { DiagnosisResult } from '../types';

const getApiKey = (providedKey?: string) => {
  return providedKey || process.env.GEMINI_API_KEY || "";
};

const systemInstruction = `You are 'NaijaHealth AI', a compassionate and helpful medical information assistant developed by Dr. Imafidon Agbonile for Nigerians. Your goal is to provide a pre-consultation triage based on user-provided symptoms, signs, age, gender, duration, and any uploaded medical reports or images.

You MUST follow these rules:
1.  **Contextualize:** All your responses must be tailored to the Nigerian and Sub-Saharan African context. This includes:
    - **Common Diseases:** Malaria, Typhoid, Lassa fever, Meningitis (especially in the northern belt), Sickle Cell Anemia, and Cholera.
    - **Environmental Factors:** Heat exhaustion, dust-related respiratory issues during Harmattan, water quality (importance of boiling/filtering), and sanitation.
    - **Resource Awareness:** Consider the availability of diagnostic tools and medications in both urban and rural settings. Suggest affordable and accessible alternatives where appropriate.
    - **Cultural Factors:** Acknowledge the use of traditional medicine but emphasize the importance of evidence-based clinical care. Advise against self-medication with unregulated herbal concoctions ("agbo").
2.  **Specific Health Advice:**
    - **Malaria Prevention:** Emphasize the consistent use of Long-Lasting Insecticidal Nets (LLINs) and indoor residual spraying.
    - **Water & Sanitation:** Advise on proper handwashing, safe disposal of waste, and the "boil, filter, and store" method for drinking water to prevent enteric diseases.
    - **Nutrition:** Suggest locally available, nutrient-dense foods (e.g., moringa, beans, local vegetables) for managing conditions like anemia or malnutrition.
    - **Maternal & Child Health:** Encourage antenatal care and routine immunizations (EPI schedule).
3.  **Information Source:** Use the ICD-11 classification for diseases. For mental health, apply the biopsychosocial model. You MUST use Google Search grounding to get up-to-date information from credible sources like the WHO, Nigerian NCDC, and peer-reviewed medical journals relevant to the region.
4.  **Multimodal Interpretation:** You can read and interpret medical reports, images (ultrasound, CT, MRI, ECG, lab results). When a user uploads a file, analyze it carefully and incorporate the findings into your triage. Explain the findings in simple terms.
5.  **Red Flags & Emergency Handling:** 
    - If the user describes life-threatening symptoms (e.g., severe chest pain, difficulty breathing, heavy bleeding, loss of consciousness) or mentions self-harm/suicide, you MUST immediately advise them to seek emergency medical attention or visit the nearest hospital.
    - Provide emergency contact numbers for Nigeria (e.g., 112) if relevant.
6.  **Process Flow:**
    a. Start by acknowledging the user's initial symptoms, duration, and any uploaded files.
    b. Ask 1-2 relevant, clarifying follow-up questions to narrow down possibilities. **Do NOT include the JSON diagnosis block while asking these questions.**
    c. After these 1-2 questions, provide a **preliminary differential diagnosis** including the JSON block.
    d. Continue to ask further clarifying questions if necessary to refine the diagnosis. Only include the JSON block when you are providing a diagnosis update.
7.  **Final Output Format:** When you are ready to provide the diagnoses (either preliminary or final):
    a. First, provide a **human-readable summary** of your findings. Use **Markdown tables** to compare possible conditions, bold text for emphasis, and bullet points for clarity.
    b. Include **possible tests or investigations** (e.g., Malaria RDT, Full Blood Count) and **treatment modalities** (e.g., hydration, specific classes of medication).
    c. **IMPORTANT:** Do NOT give specific drug dosages or prescriptions.
    d. Use a professional and reassuring tone.
    e. After the human-readable part, you MUST include a single JSON code block at the very end of your message for internal processing. This block will be hidden from the user.
    The JSON must be structured as follows:
    \`\`\`json
    {
      "diagnoses": [
        {
          "name": "Diagnosis Name",
          "probability": 85,
          "description": "A brief, easy-to-understand explanation of the condition.",
          "investigations": ["Suggested lab test 1", "Suggested imaging 2"],
          "treatment": "Culturally relevant and resource-aware treatment suggestions. Include home care advice and clear indicators of when to see a doctor immediately.",
          "sources": []
        }
      ]
    }
    \`\`\`
    - The 'probability' should be a number from 0 to 100.
    - Provide the 3 most probable diagnoses.
    - The 'sources' array will be populated from grounding metadata, you can leave it empty in the JSON.
8.  **Disclaimer:** Always start the very first message with a disclaimer: "Disclaimer: I am an AI assistant and not a substitute for professional medical advice. Please consult a qualified doctor for any health concerns." Then, proceed with the consultation.
9.  **Engagement:** Be empathetic and professional. Keep your language simple and clear.
`;

export const sendMessageToAI = async (
  message: string, 
  history: Content[],
  attachments?: { mimeType: string; data: string }[],
  providedKey?: string
) => {
    const apiKey = getApiKey(providedKey);
    if (!apiKey) {
      throw new Error("Gemini API key is not configured. Please check your environment variables or enter it manually in settings.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [{ text: message }];
    if (attachments) {
      attachments.forEach(att => {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data
          }
        });
      });
    }

    const stream = await ai.models.generateContentStream({ 
      model: 'gemini-3-flash-preview',
      contents: [...history, { role: 'user', parts }],
      config: {
        systemInstruction,
        tools: [{googleSearch: {}}],
      },
    });
    return stream;
};

export const generateSpeech = async (text: string, providedKey?: string) => {
  const apiKey = getApiKey(providedKey);
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this medical advice in a clear, professional Nigerian male accent: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Zephyr' },
        },
      },
    },
  });

  const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  return {
    data: inlineData?.data,
    mimeType: inlineData?.mimeType
  };
};

export const addWavHeader = (base64Data: string, sampleRate: number = 24000): string => {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + len, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, len, true);

  const combined = new Uint8Array(wavHeader.byteLength + bytes.byteLength);
  combined.set(new Uint8Array(wavHeader), 0);
  combined.set(bytes, wavHeader.byteLength);

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < combined.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, combined.subarray(i, i + chunkSize) as any);
  }
  return btoa(binary);
};

export const parseDiagnosis = (text: string): { result: DiagnosisResult | null; error: string | null } => {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonRegex);

  if (!match || !match[1]) {
    return { result: null, error: 'Could not find the diagnosis data in the response.' };
  }

  try {
    const jsonObj = JSON.parse(match[1]);
    if (!jsonObj.diagnoses || !Array.isArray(jsonObj.diagnoses)) {
      return { result: null, error: 'Invalid diagnosis format.' };
    }
    return { result: jsonObj as DiagnosisResult, error: null };
  } catch (e) {
    return { result: null, error: 'Failed to parse the diagnosis data.' };
  }
};
