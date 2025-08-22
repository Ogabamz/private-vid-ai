import { useState, useEffect } from "react";
import { ApiKeySetup } from "@/components/ApiKeySetup";
import { VideoSearch } from "@/components/VideoSearch";
import { VideoCard, VideoData } from "@/components/VideoCard";
import { VideoPlayer } from "@/components/VideoPlayer";
import { VideoChat } from "@/components/VideoChat";
import { useToast } from "@/hooks/use-toast";

type AppView = "setup" | "search" | "player" | "chat";

interface TranscriptEntry {
  text: string;
  duration: number;
  offset: number;
}

const Index = () => {
  const [currentView, setCurrentView] = useState<AppView>("setup");
  const [apiKeys, setApiKeys] = useState<{ youtube: string; gemini: string } | null>(null);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [videoTranscript, setVideoTranscript] = useState<TranscriptEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if API keys are already stored
    const youtubeKey = localStorage.getItem("youtube_api_key");
    const geminiKey = localStorage.getItem("gemini_api_key");
    
    if (youtubeKey && geminiKey) {
      setApiKeys({ youtube: youtubeKey, gemini: geminiKey });
      setCurrentView("search");
    }
  }, []);

  const handleKeysSet = (youtubeKey: string, geminiKey: string) => {
    setApiKeys({ youtube: youtubeKey, gemini: geminiKey });
    setCurrentView("search");
  };

  const searchVideos = async (query: string) => {
    if (!apiKeys) return;
    
    setIsLoading(true);
    try {
      // Search for videos using YouTube API
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=3&q=${encodeURIComponent(query)}&key=${apiKeys.youtube}`
      );

      if (!searchResponse.ok) {
        throw new Error("Failed to search videos");
      }

      const searchData = await searchResponse.json();
      
      // Process videos and generate summaries
      const videoResults: VideoData[] = await Promise.all(
        searchData.items.map(async (item: any) => {
          const videoData: VideoData = {
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            description: item.snippet.description,
          };

          // Generate summary using Gemini API
          try {
            const summaryResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeys.gemini}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  contents: [{
                    parts: [{
                      text: `Please provide a 3-5 sentence summary of this YouTube video based on its title and description. Title: "${item.snippet.title}" Description: "${item.snippet.description}"`
                    }]
                  }]
                }),
              }
            );

            if (summaryResponse.ok) {
              const summaryData = await summaryResponse.json();
              videoData.summary = summaryData.candidates?.[0]?.content?.parts?.[0]?.text || videoData.description;
            }
          } catch (error) {
            console.warn("Failed to generate summary for video:", error);
          }

          return videoData;
        })
      );

      setVideos(videoResults);
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search Error",
        description: "Failed to search videos. Please check your API keys.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayVideo = (video: VideoData) => {
    setSelectedVideo(video);
    setVideoTranscript([]); // Reset transcript when switching videos
    setCurrentView("player");
  };

  const handleChatWithVideo = async (video: VideoData) => {
    setSelectedVideo(video);
    setCurrentView("chat");
    
    // Try to automatically load transcript using YouTube Data API v3
    if (apiKeys?.youtube) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${video.id}&key=${apiKeys.youtube}`
        );
        
        if (response.ok) {
          const captionsData = await response.json();
          
          if (captionsData.items && captionsData.items.length > 0) {
            // Get the first available caption track (usually English)
            const captionId = captionsData.items[0].id;
            
            // Now fetch the actual transcript content
            const transcriptResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${apiKeys.youtube}`,
              {
                headers: {
                  'Accept': 'application/json'
                }
              }
            );
            
            if (transcriptResponse.ok) {
              const transcriptText = await transcriptResponse.text();
              // Parse the transcript (it comes in various formats)
              const transcriptData = parseTranscriptText(transcriptText);
              setVideoTranscript(transcriptData);
            }
          }
        }
      } catch (error) {
        console.log("Could not auto-load transcript via API:", error);
        // Fallback to the old method
        try {
          const response = await fetch(`https://www.youtube.com/api/timedtext?v=${video.id}&lang=en`);
          if (response.ok) {
            const xmlText = await response.text();
            const transcriptData = parseTranscriptXML(xmlText);
            setVideoTranscript(transcriptData);
          }
        } catch (fallbackError) {
          console.log("Could not auto-load transcript via fallback:", fallbackError);
        }
      }
    }
  };

  const handleBackToSearch = () => {
    setCurrentView("search");
    setSelectedVideo(null);
    setVideoTranscript([]);
  };

  const handleTranscriptUpdate = (transcript: TranscriptEntry[]) => {
    setVideoTranscript(transcript);
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

  if (currentView === "setup") {
    return <ApiKeySetup onKeysSet={handleKeysSet} />;
  }

  if (currentView === "player" && selectedVideo) {
    return (
      <VideoPlayer 
        video={selectedVideo} 
        onBack={handleBackToSearch}
        onTranscriptUpdate={handleTranscriptUpdate}
      />
    );
  }

  if (currentView === "chat" && selectedVideo) {
    return (
      <VideoChat 
        video={selectedVideo} 
        onBack={handleBackToSearch}
        transcript={videoTranscript}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">PLAY AND TAKE NOTES</h1>
          <p className="text-muted-foreground">Search, watch, and take notes on YouTube videos</p>
        </div>
        
        <VideoSearch onSearch={searchVideos} isLoading={isLoading} />
        
        {videos.length > 0 && (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto px-4">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onPlayVideo={handlePlayVideo}
                onChatWithVideo={handleChatWithVideo}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
