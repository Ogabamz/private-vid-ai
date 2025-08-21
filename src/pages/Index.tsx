import { useState, useEffect } from "react";
import { ApiKeySetup } from "@/components/ApiKeySetup";
import { VideoSearch } from "@/components/VideoSearch";
import { VideoCard, VideoData } from "@/components/VideoCard";
import { VideoPlayer } from "@/components/VideoPlayer";
import { VideoChat } from "@/components/VideoChat";
import { useToast } from "@/hooks/use-toast";

type AppView = "setup" | "search" | "player" | "chat";

const Index = () => {
  const [currentView, setCurrentView] = useState<AppView>("setup");
  const [apiKeys, setApiKeys] = useState<{ youtube: string; gemini: string } | null>(null);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
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
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKeys.gemini}`,
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
    setCurrentView("player");
  };

  const handleChatWithVideo = (video: VideoData) => {
    setSelectedVideo(video);
    setCurrentView("chat");
  };

  const handleBackToSearch = () => {
    setCurrentView("search");
    setSelectedVideo(null);
  };

  if (currentView === "setup") {
    return <ApiKeySetup onKeysSet={handleKeysSet} />;
  }

  if (currentView === "player" && selectedVideo) {
    return <VideoPlayer video={selectedVideo} onBack={handleBackToSearch} />;
  }

  if (currentView === "chat" && selectedVideo) {
    return <VideoChat video={selectedVideo} onBack={handleBackToSearch} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">PrivateTube</h1>
          <p className="text-muted-foreground">Search, watch, and chat with YouTube videos</p>
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
