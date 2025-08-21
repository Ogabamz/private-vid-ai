import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { VideoData } from "./VideoCard";

interface VideoPlayerProps {
  video: VideoData;
  onBack: () => void;
}

export const VideoPlayer = ({ video, onBack }: VideoPlayerProps) => {
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
        <h1 className="text-xl font-bold line-clamp-2">{video.title}</h1>
      </div>
      
      <div className="aspect-video bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${video.id}?autoplay=1&modestbranding=1&rel=0`}
          title={video.title}
          className="w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
      
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-2">About this video</h2>
        <p className="text-muted-foreground">{video.description}</p>
      </div>
    </div>
  );
};