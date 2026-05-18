import React from "react";
import { Download, FileText, File as FileIcon, Copy, Check } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { exportToTxt, exportToWord } from "@/src/lib/export";
import { toast } from "sonner";

interface TextOutputProps {
  text: string;
  fileName: string;
}

export function TextOutput({ text, fileName }: TextOutputProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto mt-8"
    >
      <Card className="overflow-hidden border-muted-foreground/20 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Extracted Transcript</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToTxt(text, fileName)}
              className="gap-2"
            >
              <FileIcon className="w-4 h-4" />
              .TXT
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => exportToWord(text, fileName)}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Word
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[400px] p-6 bg-background">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 font-sans">
            {text}
          </div>
        </ScrollArea>
      </Card>
    </motion.div>
  );
}
