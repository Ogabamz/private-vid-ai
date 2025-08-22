import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Download, FileText, Loader2 } from "lucide-react";
import { VideoData } from "./VideoCard";
import { useToast } from "@/hooks/use-toast";

interface VideoPlayerProps {
  video: VideoData;
  onBack: () => void;
  onTranscriptUpdate?: (transcript: TranscriptEntry[]) => void;
}

interface TranscriptEntry {
  text: string;
  duration: number;
  offset: number;
}

export const VideoPlayer = ({ video, onBack, onTranscriptUpdate }: VideoPlayerProps) => {
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Load existing notes for this video from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem(`video_notes_${video.id}`);
    if (savedNotes) {
      setNotes(savedNotes);
    }
  }, [video.id]);

  // Auto-save notes as user types
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (notes.trim()) {
        localStorage.setItem(`video_notes_${video.id}`, notes);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [notes, video.id]);

  const fetchTranscript = async () => {
    setIsLoadingTranscript(true);
    try {
      // Try to get transcript using YouTube's transcript API
      const response = await fetch(`https://www.youtube.com/api/timedtext?v=${video.id}&lang=en`);
      
      if (response.ok) {
        const xmlText = await response.text();
        const transcriptData = parseTranscriptXML(xmlText);
        setTranscript(transcriptData);
        setShowTranscript(true);
        
        // Notify parent component about transcript update
        if (onTranscriptUpdate) {
          onTranscriptUpdate(transcriptData);
        }
        
        toast({
          title: "Transcript Loaded",
          description: "Video transcript has been loaded successfully.",
        });
      } else {
        // Fallback: try to extract from embedded player
        const fallbackTranscript = await extractTranscriptFromPlayer();
        if (fallbackTranscript.length > 0) {
          setTranscript(fallbackTranscript);
          setShowTranscript(true);
          
          // Notify parent component about transcript update
          if (onTranscriptUpdate) {
            onTranscriptUpdate(fallbackTranscript);
          }
          
          toast({
            title: "Transcript Loaded",
            description: "Video transcript extracted from player.",
          });
        } else {
          throw new Error("No transcript available");
        }
      }
    } catch (error) {
      console.error("Error fetching transcript:", error);
      toast({
        title: "Transcript Error",
        description: "Could not load transcript. Not all videos have transcripts available.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  const parseTranscriptXML = (xmlText: string): TranscriptEntry[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const textElements = xmlDoc.getElementsByTagName("text");
    
    const entries: TranscriptEntry[] = [];
    for (let i = 0; i < textElements.length; i++) {
      const element = textElements[i];
      const start = parseFloat(element.getAttribute("start") || "0");
      const duration = parseFloat(element.getAttribute("dur") || "0");
      
      entries.push({
        text: element.textContent || "",
        duration,
        offset: start
      });
    }
    
    return entries;
  };

  const extractTranscriptFromPlayer = async (): Promise<TranscriptEntry[]> => {
    // This is a fallback method that tries to extract captions from the embedded player
    // Note: This may not work due to CORS restrictions, but worth trying
    try {
      const iframe = document.querySelector('iframe[src*="youtube.com"]') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        // This approach has limitations due to CORS, but we can try
        return [];
      }
    } catch (error) {
      console.warn("Could not extract transcript from player:", error);
    }
    return [];
  };

  const handleSaveNotes = async () => {
    if (!notes.trim() && transcript.length === 0) {
      toast({
        title: "No Content",
        description: "Please write some notes or load a transcript before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Create the note content with metadata and transcript
      const noteContent = createNoteContent();
      
      // Create and download the file
      const blob = new Blob([noteContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `notes_${video.id}_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Notes Saved",
        description: "Your notes and transcript have been saved to your device.",
      });
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({
        title: "Save Error",
        description: "Failed to save notes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const createNoteContent = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    
    const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
    
    let content = `NOTES ON YOUTUBE VIDEO
================================

Video Title: ${video.title}
Video URL: ${videoUrl}
Date Notes Taken: ${currentDate}

================================

`;

    // Add notes if they exist
    if (notes.trim()) {
      content += `YOUR NOTES:
${notes}

================================

`;
    }

    // Add transcript if available
    if (transcript.length > 0) {
      content += `VIDEO TRANSCRIPT:
`;
      transcript.forEach((entry, index) => {
        const minutes = Math.floor(entry.offset / 60);
        const seconds = Math.floor(entry.offset % 60);
        const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        content += `[${timestamp}] ${entry.text}\n`;
      });
      content += `\n================================\n`;
    }

    content += `Generated by PrivateTube AI`;
    
    return content;
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 border-b">
        <Button 
          onClick={onBack}
          variant="ghost"
          className="mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Search
        </Button>
        <h1 className="text-xl font-bold line-clamp-2 mb-4">{video.title}</h1>
        
        {/* BACK TO HOME Button */}
        <Button 
          onClick={onBack}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-lg"
        >
          BACK TO HOME
        </Button>
      </div>
      
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Video Player Section */}
        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="aspect-video bg-black rounded-t-lg">
              <iframe
                src={`https://www.youtube.com/embed/${video.id}?autoplay=1&modestbranding=1&rel=0&cc_load_policy=1`}
                title={video.title}
                className="w-full h-full rounded-t-lg"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </CardContent>
        </Card>

        {/* Transcript Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>VIDEO TRANSCRIPT</span>
              <Button 
                onClick={fetchTranscript}
                disabled={isLoadingTranscript}
                size="sm"
                className="ml-2"
              >
                {isLoadingTranscript ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                {isLoadingTranscript ? "Loading..." : "Load Transcript"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transcript.length > 0 && showTranscript ? (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {transcript.map((entry, index) => (
                  <div key={index} className="flex items-start space-x-3 p-2 bg-muted rounded">
                    <span className="text-sm font-mono text-muted-foreground min-w-[50px]">
                      {formatTime(entry.offset)}
                    </span>
                    <span className="text-sm">{entry.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Click "Load Transcript" to get the video transcript</p>
                <p className="text-xs mt-1">Note: Not all videos have transcripts available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>SIMPLE EDITOR</span>
              <Button 
                onClick={handleSaveNotes}
                disabled={isSaving || (!notes.trim() && transcript.length === 0)}
                size="sm"
                className="ml-2"
              >
                <Download className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Download Notes"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Start taking notes about this video..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[200px] resize-none"
            />
            <div className="mt-2 text-sm text-muted-foreground">
              Notes are automatically saved as you type. Use the Download button to save to your device.
              {transcript.length > 0 && " Transcript will be included in the download."}
            </div>
          </CardContent>
        </Card>

        {/* Video Description */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>About this video</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{video.description}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};