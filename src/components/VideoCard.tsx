import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, MessageCircle } from "lucide-react";

export interface VideoData {
  id: string;
  title: string;
  thumbnail: string;
  description: string;
  summary?: string;
}

interface VideoCardProps {
  video: VideoData;
  onPlayVideo: (video: VideoData) => void;
  onChatWithVideo: (video: VideoData) => void;
}

export const VideoCard = ({ video, onPlayVideo, onChatWithVideo }: VideoCardProps) => {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="aspect-video rounded-lg overflow-hidden bg-muted">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        </div>
        <CardTitle className="text-lg line-clamp-2">{video.title}</CardTitle>
        <CardDescription className="text-sm line-clamp-3">
          {video.summary || video.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button 
          onClick={() => onPlayVideo(video)}
          className="flex-1"
          variant="default"
        >
          <Play className="w-4 h-4 mr-2" />
          Play Video
        </Button>
        <Button 
          onClick={() => onChatWithVideo(video)}
          className="flex-1"
          variant="outline"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Chat with Video
        </Button>
      </CardContent>
    </Card>
  );
};