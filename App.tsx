
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppState, Gender, Message, Sender, DiagnosisResult, Diagnosis, Source } from './types';
import { sendMessageToAI, parseDiagnosis, generateSpeech, addWavHeader } from './services/geminiService';
import { Content, GenerateContentResponse } from '@google/genai';
import { jsPDF } from "jspdf";
import Header from './components/Header';
import Footer from './components/Footer';
import ChatBubble from './components/ChatBubble';
import Spinner from './components/Spinner';
import DiagnosisCard from './components/DiagnosisCard';
import PremiumFeatureCard from './components/PremiumFeatureCard';
import HealthTips from './components/HealthTips';
import { SendIcon } from './components/icons/SendIcon';
import { LockIcon } from './components/icons/LockIcon';
import { LinkIcon } from './components/icons/LinkIcon';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Initial);
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<Gender>(Gender.Male);
  const [symptoms, setSymptoms] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [attachments, setAttachments] = useState<{ name: string; mimeType: string; data: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState<string | null>(null);
  const [userApiKey, setUserApiKey] = useState<string>(localStorage.getItem('gemini_api_key') || '');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (userApiKey) {
      localStorage.setItem('gemini_api_key', userApiKey);
    }
  }, [userApiKey]);

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!age || !symptoms || !duration) {
      setError('Please enter your age, symptoms, and duration.');
      return;
    }
    setError(null);
    setAppState(AppState.Loading);
    
    const initialPrompt = `My age is ${age}, gender is ${gender}, my symptoms are: ${symptoms}, and I have had them for ${duration}.`;
    const userMessage: Message = { id: Date.now().toString(), sender: Sender.User, text: initialPrompt };
    
    setMessages([userMessage]);
    setInput('');
    await processStream(initialPrompt);
  };
  
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;

    const userMessage: Message = { 
      id: Date.now().toString(), 
      sender: Sender.User, 
      text: input,
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setAppState(AppState.Loading);
    
    await processStream(currentInput, currentAttachments);
  };
  
  const processStream = useCallback(async (prompt: string, currentAttachments?: { mimeType: string; data: string }[]) => {
    try {
      // Build history for the API call
      const history: Content[] = messages.map(msg => {
        const parts: any[] = [{ text: msg.text }];
        if (msg.attachments) {
          msg.attachments.forEach(att => {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.data
              }
            });
          });
        }
        return {
          role: msg.sender === Sender.User ? 'user' : 'model',
          parts
        };
      });
      
      const stream = await sendMessageToAI(prompt, history, currentAttachments, userApiKey);

      let currentAiMessage: Message = {
        id: Date.now().toString(),
        sender: Sender.AI,
        text: '',
      };
      setMessages(prev => [...prev, currentAiMessage]);

      let fullResponseText = '';
      let groundingChunks: any[] = [];

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        fullResponseText += chunkText;
        if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            groundingChunks.push(...chunk.candidates[0].groundingMetadata.groundingChunks);
        }
        
        setMessages(prev =>
          prev.map(msg =>
            msg.id === currentAiMessage.id ? { ...msg, text: fullResponseText } : msg
          )
        );
      }
      
      const { result, error: parseError } = parseDiagnosis(fullResponseText);
      if (result) {
        const uniqueSources: Source[] = groundingChunks
            .filter(chunk => chunk.web && chunk.web.uri)
            .map(chunk => ({ title: chunk.web.title || chunk.web.uri, uri: chunk.web.uri }))
            .filter((source, index, self) => self.findIndex(s => s.uri === source.uri) === index);

        const diagnosesWithSources = result.diagnoses.map(diag => ({...diag, sources: uniqueSources}));
        setDiagnosisResult({diagnoses: diagnosesWithSources});
        setAppState(AppState.Done);

      } else {
        if (parseError && fullResponseText.includes("diagnoses")) {
          setError(parseError);
        }
        setAppState(AppState.Chatting);
      }

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to get response from AI. ${errorMessage}`);
      const systemMessage: Message = {
        id: Date.now().toString(),
        sender: Sender.System,
        text: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
      };
      setMessages(prev => [...prev, systemMessage]);
      setAppState(AppState.Chatting);
    }
  }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setAttachments(prev => [...prev, {
          name: file.name,
          mimeType: file.type,
          data: base64String
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleReset = () => {
    setAppState(AppState.Initial);
    setAge('');
    setGender(Gender.Male);
    setSymptoms('');
    setDuration('');
    setMessages([]);
    setInput('');
    setAttachments([]);
    setError(null);
    setDiagnosisResult(null);
  };

  const handleDownloadReport = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(20);
    doc.setTextColor(0, 128, 128);
    doc.text("NaijaHealth AI - Consultation Report", 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Date: ${new Date().toLocaleString()}`, 20, y);
    y += 10;

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Age: ${age} | Gender: ${gender}`, 20, y);
    y += 7;
    doc.text(`Symptoms: ${symptoms}`, 20, y, { maxWidth: 170 });
    y += 10;
    doc.text(`Duration: ${duration}`, 20, y);
    y += 15;

    doc.setFontSize(14);
    doc.setTextColor(0, 128, 128);
    doc.text("Consultation History", 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(0);
    messages.forEach(msg => {
      const sender = msg.sender === Sender.User ? 'User' : 'AI';
      const cleanText = msg.text.replace(/```json\s*[\s\S]*?\s*```/g, '').trim();
      
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.text(`[${sender}]`, 20, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(cleanText, 170);
      doc.text(lines, 20, y);
      y += (lines.length * 5) + 5;
    });

    if (diagnosisResult) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(0, 128, 128);
      doc.text("Suggested Diagnoses", 20, y);
      y += 10;

      doc.setFontSize(10);
      doc.setTextColor(0);
      diagnosisResult.diagnoses.forEach((diag, idx) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.text(`${idx + 1}. ${diag.name} (${diag.probability}%)`, 20, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        const descLines = doc.splitTextToSize(`Description: ${diag.description}`, 170);
        doc.text(descLines, 20, y);
        y += (descLines.length * 5) + 2;
        doc.text(`Investigations: ${diag.investigations.join(', ')}`, 20, y, { maxWidth: 170 });
        y += 7;
        doc.text(`Treatment: ${diag.treatment}`, 20, y, { maxWidth: 170 });
        y += 15;
      });
    }

    doc.save(`NaijaHealth_Report_${Date.now()}.pdf`);
  };

  const handleListen = async (messageId: string, text: string) => {
    try {
      setIsGeneratingSpeech(messageId);
      // Clean text from JSON blocks before speech
      const cleanText = text.replace(/```json\s*[\s\S]*?\s*```/g, '').trim();
      const { data, mimeType } = await generateSpeech(cleanText, userApiKey);
      if (data) {
        let audioSrc = `data:${mimeType || 'audio/mp3'};base64,${data}`;
        
        // If it's raw PCM, we need to add a WAV header for the browser to play it
        if (mimeType?.includes('pcm')) {
           const wavData = addWavHeader(data);
           audioSrc = `data:audio/wav;base64,${wavData}`;
        }

        const audio = new Audio(audioSrc);
        audio.play();
      }
    } catch (err) {
      console.error("Speech generation failed", err);
    } finally {
      setIsGeneratingSpeech(null);
    }
  };

  const renderSettings = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="text-xl font-bold text-gray-800 mb-4">AI Configuration</h3>
        <p className="text-sm text-gray-600 mb-4">
          If you are experiencing "API key not valid" errors, you can enter your own Gemini API key here. 
          Your key is stored only in your browser's local storage.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
            <input 
              type="password" 
              value={userApiKey} 
              onChange={(e) => setUserApiKey(e.target.value)}
              placeholder="Paste your API key here..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Close
            </button>
            <button 
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
            >
              Save & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (appState) {
      case AppState.Initial:
        return renderInitialForm();
      case AppState.Loading:
      case AppState.Chatting:
      case AppState.Done:
        return renderChatInterface();
      default:
        return null;
    }
  };

  const renderInitialForm = () => (
    <div className="w-full max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">AI Pre-Consultation Triage</h2>
      <p className="text-gray-600 mb-6 text-center">Tell us about yourself and your symptoms to begin.</p>
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">{error}</div>}
      <form onSubmit={handleInitialSubmit} className="space-y-6 max-w-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">Age</label>
            <input type="number" id="age" value={age} onChange={(e) => setAge(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
              placeholder="e.g., 35" required />
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select id="gender" value={gender} onChange={(e) => setGender(e.target.value as Gender)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition bg-white">
              <option value={Gender.Male}>Male</option>
              <option value={Gender.Female}>Female</option>
              <option value={Gender.Other}>Other</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="symptoms" className="block text-sm font-medium text-gray-700 mb-1">Symptoms & Signs</label>
          <textarea id="symptoms" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
            placeholder="Describe your symptoms in detail. For example: 'I have had a high fever and headache...'" required />
        </div>
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">Duration of Symptoms</label>
          <input type="text" id="duration" value={duration} onChange={(e) => setDuration(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
            placeholder="e.g., 3 days, 2 weeks" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Upload Medical Reports/Images (Optional)</label>
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm text-gray-600"
            >
              <div className="w-4 h-4"><LinkIcon /></div>
              Select Files
            </button>
            <span className="text-xs text-gray-500">
              {attachments.length > 0 ? `${attachments.length} file(s) selected` : 'No files selected'}
            </span>
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="bg-teal-50 text-teal-700 text-[10px] px-2 py-1 rounded border border-teal-100 flex items-center gap-1">
                  <span className="truncate max-w-[100px]">{att.name}</span>
                  <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="hover:text-teal-900 font-bold">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="submit" className="w-full bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-transform transform hover:scale-105">
          Start AI Consultation
        </button>
      </form>
      <div className="mt-12">
        <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Health Tips for Nigeria & Sub-Saharan Africa</h3>
        <HealthTips />
      </div>
    </div>
  );
  
  const renderChatInterface = () => (
    <div className="w-full max-w-4xl mx-auto h-[calc(100vh-160px)] flex flex-col bg-white shadow-2xl rounded-2xl border border-gray-200 overflow-hidden relative">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button 
          onClick={handleReset}
          className="bg-white/90 backdrop-blur-sm text-gray-600 hover:text-teal-600 px-3 py-1.5 rounded-full shadow-sm border border-gray-100 transition text-xs font-bold flex items-center gap-1"
          title="Reset Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Start Over
        </button>
      </div>
      <div ref={chatContainerRef} className="flex-1 p-6 space-y-4 overflow-y-auto">
        {messages.map((msg) => (
          <ChatBubble 
            key={msg.id} 
            message={msg} 
            onListen={msg.sender === Sender.AI ? () => handleListen(msg.id, msg.text) : undefined}
            isListening={isGeneratingSpeech === msg.id}
          />
        ))}
        {appState === AppState.Loading && (
          <div className="flex justify-center items-center py-4">
            <Spinner />
            <p className="text-gray-500 ml-3">NaijaHealth AI is thinking...</p>
          </div>
        )}
        {appState === AppState.Done && diagnosisResult && (
          <div className="space-y-6 pt-4 pb-10">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">Suggested Diagnoses</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={handleDownloadReport}
                    className="flex items-center gap-1 bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1 rounded-lg hover:bg-teal-100 transition text-[10px] font-bold"
                  >
                    Download PDF report
                  </button>
                  <button 
                    onClick={handleReset}
                    className="flex items-center gap-1 bg-gray-50 text-gray-700 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 transition text-[10px] font-bold"
                  >
                    Start Over
                  </button>
                </div>
              </div>
              <p className="text-center text-gray-600 text-sm">Based on your symptoms and uploaded files, here are the most probable conditions.</p>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {diagnosisResult.diagnoses.map((diag, index) => (
                    <DiagnosisCard key={index} diagnosis={diag} />
                ))}
              </div>
              <div className="pt-8">
                 <h3 className="text-2xl font-bold text-gray-800 text-center mb-6">Premium Services</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <PremiumFeatureCard title="Telemedicine" description="Consult a doctor online now."/>
                    <PremiumFeatureCard title="Find Doctors" description="Locate specialists near you."/>
                    <PremiumFeatureCard title="Book Labs" description="Schedule lab tests with ease."/>
                    <PremiumFeatureCard title="Pharmacies" description="Find pharmacies with your prescribed medication."/>
                 </div>
              </div>
              <div className="flex justify-center pt-8">
                  <button 
                    onClick={handleReset}
                    className="text-teal-600 hover:text-teal-800 font-bold flex items-center gap-2 transition text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Start Consultation Over
                  </button>
               </div>
               <p className="text-center text-gray-500 text-xs mt-6 italic">Have more questions or need clarification? Ask NaijaHealth AI below.</p>
          </div>
        )}
      </div>
       <div className="p-2 border-t border-gray-200 bg-gray-50">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-2">
            {attachments.map((att, idx) => (
              <div key={idx} className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-md flex items-center gap-1">
                <span className="truncate max-w-[100px]">{att.name}</span>
                <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="hover:text-teal-600">×</button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleChatSubmit} className="flex items-center space-x-2">
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-teal-600 transition flex-shrink-0"
            title="Upload medical reports or images"
          >
            <div className="w-5 h-5">
              <LinkIcon />
            </div>
          </button>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition text-sm"
            placeholder={appState === AppState.Done ? "Ask a follow-up question or clarify symptoms..." : "Type your response..."}
            disabled={appState === AppState.Loading} />
          <button type="submit" disabled={appState === AppState.Loading} className="bg-teal-600 text-white p-2 rounded-full hover:bg-teal-700 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition flex-shrink-0">
            <div className="w-5 h-5">
              <SendIcon />
            </div>
          </button>
        </form>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 font-sans">
      <Header />
      {showSettings && renderSettings()}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        multiple 
        accept="image/*,application/pdf"
      />
      <main className="flex-grow flex flex-col items-center p-4">
        <div className="w-full max-w-4xl flex justify-end mb-4">
          <button 
            onClick={() => setShowSettings(true)}
            className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-200 transition"
          >
            <LockIcon className="w-4 h-4" />
            API Settings
          </button>
        </div>
        <div className="w-full flex justify-center items-center">
          {renderContent()}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default App;
