import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Send, FileText, Loader2 } from "lucide-react";
import { VideoData } from "./VideoCard";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface TranscriptEntry {
  text: string;
  duration: number;
  offset: number;
}

interface VideoChatProps {
  video: VideoData;
  onBack: () => void;
  transcript?: TranscriptEntry[];
}

export const VideoChat = ({ video, onBack, transcript = [] }: VideoChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: `Hello! I'm ready to discuss "${video.title}". ${transcript.length > 0 ? "I have access to the video transcript and can answer detailed questions about the content." : "I can answer general questions about this video based on its title and description."}`,
      sender: "ai",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState<TranscriptEntry[]>(transcript);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sync local transcript state with prop changes
  useEffect(() => {
    console.log("Transcript prop changed:", transcript);
    console.log("Transcript prop structure:", JSON.stringify(transcript, null, 2));
    if (transcript.length > 0) {
      console.log("Setting currentTranscript from prop:", transcript.length, "segments");
      setCurrentTranscript(transcript);
      
      // Update welcome message when transcript becomes available
      setMessages(prev => prev.map(msg => 
        msg.id === "welcome" 
          ? { ...msg, content: `Hello! I'm ready to discuss "${video.title}". I now have access to the video transcript and can answer detailed questions about the content.` }
          : msg
      ));
    }
  }, [transcript, video.title]);

  // Load transcript if not provided
  const loadTranscript = async () => {
    if (currentTranscript.length > 0) return;
    
    setIsLoadingTranscript(true);
    try {
      // Method 1: Try YouTube Data API v3 (if we have the key)
      const youtubeKey = localStorage.getItem("youtube_api_key");
      if (youtubeKey) {
        try {
          const response = await fetch(
            `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${video.id}&key=${youtubeKey}`
          );
          
          if (response.ok) {
            const captionsData = await response.json();
            
            if (captionsData.items && captionsData.items.length > 0) {
              const captionId = captionsData.items[0].id;
              
              const transcriptResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${youtubeKey}`,
                {
                  headers: {
                    'Accept': 'application/json'
                  }
                }
              );
              
              if (transcriptResponse.ok) {
                const transcriptText = await transcriptResponse.text();
                const transcriptData = parseTranscriptText(transcriptText);
                setCurrentTranscript(transcriptData);
                
                // Update welcome message
                setMessages(prev => prev.map(msg => 
                  msg.id === "welcome" 
                    ? { ...msg, content: `Hello! I'm ready to discuss "${video.title}". I now have access to the video transcript and can answer detailed questions about the content.` }
                    : msg
                ));
                
                toast({
                  title: "Transcript Loaded",
                  description: "Video transcript loaded via YouTube API for better AI responses.",
                });
                return;
              }
            }
          }
        } catch (apiError) {
          console.log("YouTube API method failed:", apiError);
        }
      }
      
      // Method 2: Fallback to timedtext API
      const response = await fetch(`https://www.youtube.com/api/timedtext?v=${video.id}&lang=en`);
      
      if (response.ok) {
        const xmlText = await response.text();
        const transcriptData = parseTranscriptXML(xmlText);
        setCurrentTranscript(transcriptData);
        
        // Update welcome message
        setMessages(prev => prev.map(msg => 
          msg.id === "welcome" 
            ? { ...msg, content: `Hello! I'm ready to discuss "${video.title}". I now have access to the video transcript and can answer detailed questions about the content.` }
            : msg
        ));
        
        toast({
          title: "Transcript Loaded",
          description: "Video transcript loaded via fallback method.",
        });
      } else {
        throw new Error("No transcript available");
      }
    } catch (error) {
      console.error("Error loading transcript:", error);
      toast({
        title: "Transcript Error",
        description: "Could not load transcript. This video may not have captions enabled. Chat will work with limited context.",
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

  const parseTranscriptText = (text: string): TranscriptEntry[] => {
    // Handle different transcript formats
    if (text.includes('<transcript>')) {
      return parseTranscriptXML(text);
    }
    
    // Handle plain text with timestamps
    const lines = text.split('\n');
    const entries: TranscriptEntry[] = [];
    
    for (const line of lines) {
      // Look for timestamp patterns like [00:00] or (00:00)
      const timestampMatch = line.match(/[\[\(](\d{1,2}):(\d{2})[\]\)]/);
      if (timestampMatch) {
        const minutes = parseInt(timestampMatch[1]);
        const seconds = parseInt(timestampMatch[2]);
        const offset = minutes * 60 + seconds;
        
        // Extract text after timestamp
        const textContent = line.replace(/[\[\(]\d{1,2}:\d{2}[\]\)]\s*/, '').trim();
        
        if (textContent) {
          entries.push({
            text: textContent,
            duration: 0,
            offset: offset
          });
        }
      }
    }
    
    return entries;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const geminiKey = localStorage.getItem("gemini_api_key");
      if (!geminiKey) {
        throw new Error("Gemini API key not found in localStorage. Please go back to setup and enter your API key.");
      }

      if (geminiKey.trim() === "") {
        throw new Error("Gemini API key is empty. Please go back to setup and enter a valid API key.");
      }

      // Build context for AI
      let context = `YouTube Video: "${video.title}"\nDescription: ${video.description}`;
      
      console.log("Building AI context. Current transcript segments:", currentTranscript.length);
      if (currentTranscript.length > 0) {
        const transcriptText = currentTranscript.map(entry => entry.text).join(" ");
        context += `\n\nVideo Transcript: ${transcriptText}`;
        console.log("Added transcript to context. First 200 chars:", transcriptText.substring(0, 200));
      } else {
        console.log("No transcript available for AI context");
      }

      const prompt = `You are an AI assistant helping someone understand a YouTube video. 

Context:
${context}

User Question: ${input.trim()}

Please provide a helpful, accurate response based on the video content. If the question is about specific details and you have transcript access, use that information. If not, answer based on the title and description. Be conversational and helpful.`;

      console.log("Sending request to Gemini API...");
      console.log("API Key (first 10 chars):", geminiKey.substring(0, 10) + "...");
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        }),
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", errorText);
        
        let errorMessage = "Failed to get AI response";
        
        if (response.status === 400) {
          errorMessage = "Invalid request to Gemini API. Please check your API key format.";
        } else if (response.status === 401) {
          errorMessage = "Unauthorized. Your Gemini API key is invalid or expired.";
        } else if (response.status === 403) {
          errorMessage = "Access denied. Your Gemini API key may not have the required permissions.";
        } else if (response.status === 429) {
          errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
        } else if (response.status === 500) {
          errorMessage = "Gemini API server error. Please try again later.";
        }
        
        throw new Error(`${errorMessage} (Status: ${response.status})`);
      }

      const data = await response.json();
      console.log("API Response data:", data);
      
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response. Please try again.";

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: "ai",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      
      let errorMessage = "Failed to get AI response. Please check your API key.";
      
      if (error instanceof Error) {
        if (error.message.includes("API key")) {
          errorMessage = error.message;
        } else if (error.message.includes("fetch")) {
          errorMessage = "Network error. Please check your internet connection.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Chat Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const testApiKey = async () => {
    setIsLoading(true);
    try {
      const geminiKey = localStorage.getItem("gemini_api_key");
      if (!geminiKey) {
        throw new Error("Gemini API key not found in localStorage. Please go back to setup and enter your API key.");
      }

      if (geminiKey.trim() === "") {
        throw new Error("Gemini API key is empty. Please go back to setup and enter a valid API key.");
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "Hello, Gemini!"
            }]
          }]
        }),
      });

      if (response.ok) {
        toast({
          title: "API Key Test Successful",
          description: "Your Gemini API key is working correctly!",
        });
      } else {
        const errorText = await response.text();
        console.error("API Key Test Error Response:", errorText);
        throw new Error(`API Key Test Failed: ${response.status} - ${response.statusText}`);
      }
    } catch (error) {
      console.error("API Key Test Error:", error);
      toast({
        title: "API Key Test Failed",
        description: error instanceof Error ? error.message : "Failed to test API key.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="p-4 border-b">
        <Button 
          onClick={onBack}
          variant="ghost"
          className="mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Search
        </Button>
        <h1 className="text-xl font-bold line-clamp-2">Chat: {video.title}</h1>
        
        {/* Transcript Status */}
        <div className="mt-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <span className="text-sm text-muted-foreground">
            {currentTranscript.length > 0 
              ? `Transcript loaded (${currentTranscript.length} segments)`
              : "No transcript available"
            }
          </span>
          {currentTranscript.length === 0 && (
            <Button 
              onClick={loadTranscript}
              disabled={isLoadingTranscript}
              size="sm"
              variant="outline"
            >
              {isLoadingTranscript ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Load Transcript
            </Button>
          )}
        </div>
        
        {/* Transcript Available Indicator */}
        {currentTranscript.length > 0 && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              🎯 <strong>AI Enhanced:</strong> I have access to the full video transcript! 
              I can now answer detailed questions about specific content, timestamps, and what was said at any point in the video.
            </p>
          </div>
        )}
        
        {/* Helpful Tip */}
        {currentTranscript.length === 0 && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Tip:</strong> Load the transcript first for much better AI responses! 
              The AI can then answer detailed questions about specific content in the video.
            </p>
            <p className="text-xs text-blue-700 mt-1">
              <strong>Note:</strong> Not all videos have transcripts available. This depends on whether the video creator enabled closed captions.
            </p>
          </div>
        )}
        
        {/* No Transcript Available Explanation */}
        {currentTranscript.length === 0 && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Transcript Status:</strong> This video may not have closed captions enabled by the creator.
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              <strong>What this means:</strong> The AI can still help with general questions based on the video title and description, but won't have access to the exact spoken content or timestamps.
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              <strong>Try:</strong> Videos from educational channels, official company channels, or videos with CC (closed captions) enabled are more likely to have transcripts.
            </p>
          </div>
        )}
        
        {/* API Key Status */}
        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">
                API Key Status: 
                {localStorage.getItem("gemini_api_key") ? (
                  <span className="text-green-600 font-medium"> ✓ Configured</span>
                ) : (
                  <span className="text-red-600 font-medium"> ✗ Missing</span>
                )}
              </span>
            </div>
            <div className="flex gap-2">
              {localStorage.getItem("gemini_api_key") && (
                <Button 
                  onClick={testApiKey}
                  size="sm"
                  variant="outline"
                  disabled={isLoading}
                >
                  Test API Key
                </Button>
              )}
              {!localStorage.getItem("gemini_api_key") && (
                <Button 
                  onClick={onBack}
                  size="sm"
                  variant="outline"
                >
                  Go to Setup
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <Card className={`p-3 max-w-[80%] ${
                message.sender === "user" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted"
              }`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </Card>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <Card className="p-3 bg-muted">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p>AI is thinking...</p>
                </div>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="p-4 border-t">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about this video..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};