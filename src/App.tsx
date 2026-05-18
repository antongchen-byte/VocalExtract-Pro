import { useState } from "react";
import { VideoUploader } from "./components/VideoUploader";
import { TextOutput } from "./components/TextOutput";
import { extractTextFromChunk } from "./lib/gemini";
import { extractAudioSegment, getFileDuration, cleanupFFmpeg } from "./lib/videoProcessor";
import { Loader2, Sparkles, History, Trash2, Mic, Brain, Clock } from "lucide-react";
import { Button } from "./components/ui/button";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { ExtractionResult } from "./types";
import { cn } from "./lib/utils";

type ProcessingStep = "idle" | "analyzing" | "processing" | "complete";

export default function App() {
  const [step, setStep] = useState<ProcessingStep>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentAction, setCurrentAction] = useState("");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [history, setHistory] = useState<ExtractionResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleFileSelect = async (file: File) => {
    setStep("analyzing");
    setResult(null);
    setProgress({ current: 0, total: 0 });
    setCurrentAction("Analyzing video duration...");
    
    try {
      // Step 1: Get total duration
      const duration = await getFileDuration(file);
      const chunkDuration = 30; // 30s chunks
      const totalChunks = Math.ceil(duration / chunkDuration);
      
      if (duration === 0) {
        throw new Error("Could not determine video duration. The file might be corrupted or unsupported.");
      }

      setStep("processing");
      setProgress({ current: 0, total: totalChunks });
      
      let fullTranscript = "";
      
      // Step 2: Process sequentially to save memory
      for (let i = 0; i < totalChunks; i++) {
        const startTime = i * chunkDuration;
        setProgress(prev => ({ ...prev, current: i + 1 }));
        
        // Step 2a: Extract voice for this specific section directly from source
        setCurrentAction(`Extracting voice: ${Math.floor(startTime/60)}m ${startTime%60}s...`);
        const audioBlob = await extractAudioSegment(file, startTime, chunkDuration);
        
        if (!audioBlob) {
          console.warn(`No audio found at ${startTime}s, skipping...`);
          continue;
        }
        
        // Step 2b: Recognize voice for this specific section
        setCurrentAction(`Recognizing speech in section ${i + 1}...`);
        const partText = await extractTextFromChunk(audioBlob, i, totalChunks);
        
        // Step 2c: Append transcript incrementally
        fullTranscript += (fullTranscript ? "\n\n" : "") + `[${Math.floor(startTime/60)}:${(startTime%60).toString().padStart(2, '0')}] ` + partText;
        
        // Update result state incrementally so user sees progress
        setResult({
          text: fullTranscript,
          timestamp: new Date().toLocaleString(),
          fileName: file.name,
        });
      }

      // Step 3: Cleanup
      await cleanupFFmpeg(file);

      const finalResult: ExtractionResult = {
        text: fullTranscript,
        timestamp: new Date().toLocaleString(),
        fileName: file.name,
      };
      
      setHistory(prev => [finalResult, ...prev].slice(0, 10));
      setStep("complete");
      toast.success("Full transcript generated successfully!");
    } catch (error) {
      console.error("Processing error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process video.");
      setStep("idle");
    }
  };

  const clearHistory = () => {
    setHistory([]);
    toast.success("History cleared");
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans selection:bg-primary/20">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">VocalExtract Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowHistory(!showHistory)}
              className="gap-2"
            >
              <History className="w-4 h-4" />
              History
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12 md:py-20">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-b from-zinc-900 to-zinc-600 bg-clip-text text-transparent"
          >
            Large Video? <br className="hidden md:block" /> No Problem.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-zinc-500 max-w-2xl mx-auto"
          >
            We now automatically split long videos into 1-minute segments 
            to ensure reliable transcription without timeouts.
          </motion.p>
        </div>

        {/* Uploader Section */}
        <div className="mb-12">
          <VideoUploader onFileSelect={handleFileSelect} disabled={step !== "idle" && step !== "complete"} />
        </div>

        {/* Processing State */}
        <AnimatePresence>
          {step !== "idle" && step !== "complete" && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center py-12 gap-6"
            >
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500",
                    step === "analyzing" ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground"
                  )}>
                    <Clock className={cn("w-6 h-6", step === "analyzing" && "animate-pulse")} />
                  </div>
                  <span className="text-xs font-medium">Analyzing</span>
                </div>
                
                <div className="w-12 h-px bg-muted" />

                <div className="flex flex-col items-center gap-2">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500",
                    step === "processing" ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground"
                  )}>
                    <Brain className={cn("w-6 h-6", step === "processing" && "animate-pulse")} />
                  </div>
                  <span className="text-xs font-medium">Processing</span>
                </div>
              </div>

              <div className="text-center">
                <p className="font-semibold text-lg">
                  {currentAction}
                </p>
                {step === "processing" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Section {progress.current} of {progress.total}
                  </p>
                )}
                <div className="w-64 h-2 bg-muted rounded-full mt-4 overflow-hidden mx-auto">
                  <motion.div 
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: step === "analyzing" ? "30%" : `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result Section */}
        {result && (
          <TextOutput text={result.text} fileName={result.fileName} />
        )}

        {/* History Section */}
        <AnimatePresence>
          {showHistory && history.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="mt-20 border-t pt-12"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Recent Extractions</h2>
                <Button variant="ghost" size="sm" onClick={clearHistory} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear History
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map((item, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ y: -4 }}
                    className="p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all cursor-pointer"
                    onClick={() => {
                      setResult(item);
                      setStep("complete");
                    }}
                  >
                    <p className="font-medium truncate mb-1">{item.fileName}</p>
                    <p className="text-xs text-muted-foreground mb-3">{item.timestamp}</p>
                    <p className="text-sm text-zinc-600 line-clamp-2 italic">
                      "{item.text.substring(0, 100)}..."
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by Gemini 3 Flash & FFmpeg.wasm • Built with React
          </p>
        </div>
      </footer>
    </div>
  );
}
